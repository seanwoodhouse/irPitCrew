#include "LapFuelData.h"

#include <algorithm>
#include <cassert>
#include <fstream>
#include <iostream>
#include <list>
#include <string>
#include <utility>
#include <vector>
#include <stdio.h>  /* defines FILENAME_MAX */

#include <windows.h>

// Always store at least this many values.
//
const int DATA_COUNT_MIN = 10;

using namespace std;

LapFuelData::LapFuelData(const std::string strDataDir)
{
    // Car/track session files named using GetSessionDataFileName() are saved here.
    //
    
    // Create dir if doesn't exist.
    //
    bool dataDirectoryExists = true;

    if (NULL == CreateDirectory(strDataDir.c_str(), NULL))
    {
        if (ERROR_ALREADY_EXISTS != GetLastError())
        {
            // Failed to create directory (and doesn't exist)
            //
            dataDirectoryExists = false;

            // Print error message if can't save.
            //
            std::cout << "Error: Failed to create Data directory:" << std::endl << strDataDir << std::endl;
        }
    }
    
    m_strLapDataDir = strDataDir + "\\LapData";

    m_lastFuelValue = -1.0;

    // Not used until calculated.
    // First lap added will not adjust list size.
    // Will be calculated when retrieving estimated values, will affect next lap.
    // If set, will have a minimum value of DATA_COUNT_MIN
    //
    m_dataCountMax = 0;
}

LapFuelData::~LapFuelData()
{
}

const char* LapFuelData::GetSessionDataDirectoryName(void)
{
    return m_strLapDataDir.c_str();
}

// Combines car and track name to create file name for session data.
//
void LapFuelData::GetSessionDataFileName(
    const std::string& trackName, 
    const std::string& carName, 
    std::string& outputFileName)
{
    outputFileName = std::string(this->GetSessionDataDirectoryName()) +
        "\\" + carName + "_" + trackName + ".txt";
}

void LapFuelData::SaveSessionData(const std::string& trackName, const std::string& carName)
{
    // Create dir if doesn't exist.
    //
    bool dataDirectoryExists = true;

    if (NULL == CreateDirectory(this->GetSessionDataDirectoryName(), NULL))
    {
        if (ERROR_ALREADY_EXISTS != GetLastError())
        {
            // Failed to create directory (and doesn't exist)
            //
            dataDirectoryExists = false;

            // Print error message if can't save.
            //
            std::cout << "Error: Failed to save lap data. Directory doesn't exist: " << std::endl
                << this->GetSessionDataDirectoryName() << std::endl;
        }
    }

    // Save the current list to file. 
    //
    if (dataDirectoryExists &&
        !trackName.empty() &&
        !carName.empty() &&
        !m_dataLapTimeList.empty() &&
        !m_dataLapFuelList.empty())
    {
        std::string strFileName;
        this->GetSessionDataFileName(trackName, carName, strFileName);

        // Open file, create if doesn't exist
        //
        ofstream outputFile;
        outputFile.open(strFileName, ios::out | ios::trunc);
        if (outputFile.is_open())
        {
            std::list<float>::iterator it;

            for (it = m_dataLapTimeList.begin();
                it != m_dataLapTimeList.end();
                ++it)
            {
                outputFile << *it << "\n";
            }

            // Separator between Time and Fuel values
            //
            outputFile << "---\n";

            for (it = m_dataLapFuelList.begin();
                it != m_dataLapFuelList.end();
                ++it)
            {
                outputFile << *it << "\n";
            }
        }

        outputFile.close();
    }
}

void LapFuelData::LoadSessionData(const std::string& trackName, const std::string& carName)
{
    // Load the new list from file, if it exists
    //
    if (!trackName.empty() &&
        !carName.empty())
    {
        std::string strFileName;
        this->GetSessionDataFileName(trackName, carName, strFileName);

        // Open file for reading, if it exists
        //
        ifstream inputFile;
        std::string strLine;

        inputFile.open(strFileName, ios::in);
        if (inputFile.is_open())
        {
            // Get lap times
            while (getline(inputFile, strLine))
            {
                if (strLine.compare("---") == 0)
                {
                    break;
                }

                if (!strLine.empty())
                {
                    m_dataLapTimeList.push_back(
                        (float)atof(strLine.c_str()));
                }
            }

            // Get lap Fuel
            while (getline(inputFile, strLine))
            {
                if (!strLine.empty())
                {
                    double fuelValue = atof(strLine.c_str());

                    // Add each line
                    //
                    m_dataLapFuelList.push_back((float)fuelValue);
                }
            }
        }

        inputFile.close();
    }
}

void LapFuelData::SaveCurrentSessionData(void)
{
    if (!m_currentTrack.empty() &&
        !m_currentCar.empty())
    {
        SaveSessionData(m_currentTrack, m_currentCar);
    }
}


void LapFuelData::ResetSessionData(
    const std::string& newTrack,
    const std::string& newCar)
{
    // Create the output directory and save the data to a text file.
    //
    SaveSessionData(m_currentTrack, m_currentCar);

    // Set the new values, reset session variables.
    //
    m_currentTrack = newTrack;
    m_currentCar = newCar;
    m_dataLapTimeList.clear();
    m_dataLapFuelList.clear();
    m_lastFuelValue = -1.0;
    m_dataCountMax = 0;

    // Load the new list from file, if it exists
    //
    LoadSessionData(m_currentTrack, m_currentCar);
}

// Return whether values added to the list.
//
bool LapFuelData::AddLapData(const float lapLastLapTime, const float fuelLevel)
{
    // No fuel level, set -1.
    // (I don't think this ever happens)
    //
    if (fuelLevel < 0)
    {
        m_lastFuelValue = -1.0;
        return false;
    }

    // Have fuel level, but no lap time. Save the fuel level.
    // (Value is -1 after getting out of the car, and on black flag laps.
    //  Setting this allows data on the first valid lap, after getting out of the
    //  car. First starting the sim still requires 2 valid laps for fuel.
    //  This check will add crazy times for black flag laps, but they will be ignored.)
    //
    if (lapLastLapTime <= 0)
    {
        m_lastFuelValue = fuelLevel;
        return false;
    }

    // More fuel than last time, must have restarted, or pitted.
    // Save the fuel level.
    //
    if (fuelLevel >= m_lastFuelValue)
    {
        m_lastFuelValue = fuelLevel;
        return false;
    }

    // We have a fuel level, a lap time, and the 
    // fuel level has gone down since last time.
    // Save the lap.
    //

    // Calculate the last lap fuel using the stored value, if it was valid.
    //
    float lastLapFuel = m_lastFuelValue - fuelLevel;

    // Save the new "last" value.
    //
    m_lastFuelValue = fuelLevel;
    
    // If this value is calculated, use it to adjust list size.
    //
    if (m_dataCountMax > 0)
    {
        // If there are more than Max values in the current list
        // drop the oldest.
        // 
        //if (m_dataLapFuelPairList.size() > m_dataCountMax)
        //{
        //    m_dataLapFuelPairList.pop_front();
        //}
        if (m_dataLapTimeList.size() > m_dataCountMax)
        {
            m_dataLapTimeList.pop_front();
        }
        if (m_dataLapFuelList.size() > m_dataCountMax)
        {
            m_dataLapFuelList.pop_front();
        }
    }

    // Add the new values to the back of the list
    //

    //std::pair<float, float> newPair;
    //newPair = std::make_pair(lapLastLapTime, lastLapFuel);
    //m_dataLapFuelPairList.push_back(newPair);

    m_dataLapTimeList.push_back(lapLastLapTime);
    m_dataLapFuelList.push_back(lastLapFuel);

    return true;
}

void LapFuelData::calcMedian(const std::list<float>& valuesList, const bool excludeOutliers, float &medianValue, float& madValue)
{
    const float inputMedianValue = medianValue;
    const float inputMadValue = madValue;

    medianValue = 0.0f;
    madValue = 0.0f;

    if (valuesList.size() > 0)
    {
        // Copy to a temp vector for sorting to preserve history for dropping oldest
        // and for efficient sorting.
        //
        std::vector<float> tempValuesList;

        // If excluding outliers, exclude from the calculation all values that are more
        // than 3 MAD from the Median.
        // The input median and MAD need to have values to do this, so call this function 
        // with excludeOutliers = false to calculate them, then true to recalculate.
        //
        if (excludeOutliers && inputMedianValue > 0.0f && inputMadValue > 0.0f)
        {
            const float highLimit = inputMedianValue + (inputMadValue * 3.0f);
            const float lowLimit  = inputMedianValue - (inputMadValue * 3.0f);

            std::list<float>::const_iterator valueslistIter;
            for (valueslistIter = valuesList.begin();
                 valueslistIter != valuesList.end();
                 valueslistIter++)
            {
                const float value = *valueslistIter;
                if (value >= lowLimit && value <= highLimit)
                {
                    tempValuesList.push_back(value);
                }
            }
        }
        else
        {
            tempValuesList.assign(valuesList.begin(), valuesList.end());
        }

        int numValues = tempValuesList.size();

        // Ensure that we still have some values.
        //
        if (numValues > 0)
        {
            std::sort(tempValuesList.begin(), tempValuesList.end());

            // Get the median value.
            //
            int middleIndex = (int)(numValues / 2.0f);
            medianValue = tempValuesList[middleIndex];

            // Is even number of values, average with second middle value.
            //
            if (numValues % 2 == 0)
            {
                medianValue += tempValuesList[middleIndex - 1];
                medianValue /= 2.0f;
            }

            // Calculate Median Absolute Deviation
            //
            for (int index = 0; index < numValues; ++index)
            {
                tempValuesList[index] = fabs(medianValue - tempValuesList[index]);
            }

            std::sort(tempValuesList.begin(), tempValuesList.end());

            madValue = tempValuesList[middleIndex];
            if (numValues % 2 == 0)
            {
                madValue += tempValuesList[middleIndex - 1];
                madValue /= 2.0f;
            }
        }
    }
}

void LapFuelData::calcMedianValues(float& medLapTime, float& medFuel, float &madLapTime, float& madFuel)
{   
    // If excluding outliers, exclude from the calculation all values that are more
    // than 3 MAD from the Median.
    // The input median and MAD need to have values to do this, so call this function 
    // with excludeOutliers = false to calculate them, then true to recalculate.
    //
    bool excludeOutliers = false;
    calcMedian(m_dataLapTimeList, excludeOutliers, medLapTime, madLapTime);
    excludeOutliers = true;
    calcMedian(m_dataLapTimeList, excludeOutliers, medLapTime, madLapTime);

    excludeOutliers = false;
    calcMedian(m_dataLapFuelList, excludeOutliers, medFuel, madFuel);
    excludeOutliers = true;
    calcMedian(m_dataLapFuelList, excludeOutliers, medFuel, madFuel);
}

// Use maxFuel to calculate number of items to keep in the list.
// Will be used on the need addLap() to change list size.
//
void LapFuelData::calcOptimalLapTimeFuelValues(float& calculatedLapTime, float& calculatedLapFuel, const double maxFuel)
{
    calculatedLapTime = 0.0f;
    calculatedLapFuel = 0.0f;

    float medianLapTime = 0.0f;
    float medianLapFuel = 0.0f;
    float madLapTime = 0.0f;
    float madLapFuel = 0.0f;

    // Mean doesn't work well for Lap time as high values have too much effect											
    // Mean might be ok for fuel as values should be more central, but Median should be more precise.											
    // Median automatically deals with outliers, use it instead of mean.											
    //
    calcMedianValues(medianLapTime, medianLapFuel, madLapTime, madLapFuel);

    // Estimate faster lap time.
    // Go 1 MAD lower/faster than median lap.
    // (lower lap time = more estimated Laps = more estimated Fuel = safer)
    //
    if (medianLapTime > 0.0f)
    {
        if (madLapTime < 0.0f)
        {
            madLapTime = 0.0f;
        }

        calculatedLapTime = medianLapTime - madLapTime;
    }

    // Estimate high fuel usage.
    // Go 1 MAD higher than median fuel.
    // (higher lap fuel = more estimated Fuel = safer)
    //
    if (medianLapFuel > 0.0f)
    {
        if (madLapFuel < 0.0f)
        {
            madLapFuel = 0.0f;
        }

        calculatedLapFuel = medianLapFuel + madLapFuel;
    }

    // Calculate the number of items to keep in the list.
    // Value will be either:
    //  - 0 if not calculated yet (don't use)
    //  - DATA_COUNT_MIN min value (10)
    //  - number of estimated laps in a full tank (if greater than 10)
    //
    if (maxFuel > 0 && 
        calculatedLapFuel > 0)
    {
        const double dataCount = maxFuel / calculatedLapFuel;
    
        if (dataCount > DATA_COUNT_MIN)
        {
            m_dataCountMax = (int)dataCount;
        }
        else
        {
            m_dataCountMax = DATA_COUNT_MIN;
        }
    }
}

void LapFuelData::printListValues(void)
{
    // Calculate using median values
    //
    float calculatedLapTime = 0.0f;
    float calculatedLapFuel = 0.0f;
    float maxFuel = -1.0;
    calcOptimalLapTimeFuelValues(calculatedLapTime, calculatedLapFuel, maxFuel);

    float medianLapTime = 0.0f;
    float medianLapFuel = 0.0f;
    float madLapTime = 0.0f;
    float madLapFuel = 0.0f;
    calcMedianValues(medianLapTime, medianLapFuel, madLapTime, madLapFuel);

    // Print values
    //
    std::string strUnits = "L";

    std::list<float>::iterator itTime = m_dataLapTimeList.begin();
    std::list<float>::iterator itFuel = m_dataLapFuelList.begin();

    int index = 0;

    while (itTime != m_dataLapTimeList.end() && 
            itFuel != m_dataLapFuelList.end())
    {
        std::cout << ++index << ". Time: " << *itTime << " ; Fuel: " << *itFuel << " " << strUnits << std::endl;
        ++itTime;
        ++itFuel;
    }

    std::cout << std::endl;

    std::cout << "Median Lap Time: " << medianLapTime << " ; Fuel: " << medianLapFuel << " " << strUnits << std::endl;
    std::cout << "Median Absolute Deviation Lap Time: " << madLapTime << " ; Fuel: " << madLapFuel << " " << strUnits << std::endl;
    std::cout << "Median Calculated Lap Time; " << calculatedLapTime << " ; Calculated Fuel: " << calculatedLapFuel << " " << strUnits << std::endl;
}

/*  Functions for average, replaced with median.
void LapFuelData::calcAverage(float& avgLapTime, float& avgFuel)
{
int numElements = m_dataLapFuelPairList.size();
std::list< std::pair<float, float> >::iterator it;

avgLapTime = 0.0;
avgFuel = 0.0;

// Calculate the current average fuel and laptimes.
//
if (numElements > 0.0)
{
float totalLapTimes = 0.0;
float totalFuel = 0.0;

std::list< std::pair<float, float> >::iterator it;
for (it = m_dataLapFuelPairList.begin();
it != m_dataLapFuelPairList.end();
++it)
{
std::pair<float, float> element = *it;

totalLapTimes = totalLapTimes + element.first;
totalFuel = totalFuel + element.second;
}

avgLapTime = totalLapTimes / numElements;
avgFuel = totalFuel / numElements;
}
}

void LapFuelData::calcStandardDeviation(
const float avgLapTime, const float avgFuel, float& stdDevLapTime, float& stdDevFuel)
{
int numElements = m_dataLapFuelPairList.size();
std::list< std::pair<float, float> >::iterator it;

stdDevLapTime = 0.0f;
stdDevFuel = 0.0f;

if (numElements > 0)
{
for (it = m_dataLapFuelPairList.begin();
it != m_dataLapFuelPairList.end();
++it)
{
std::pair<float, float> element = *it;

stdDevLapTime = stdDevLapTime + fabs(element.first - avgLapTime);
stdDevFuel = stdDevFuel + fabs(element.second - avgFuel);
}

stdDevLapTime = stdDevLapTime / numElements;
stdDevFuel = stdDevFuel / numElements;
}
}

void LapFuelData::calcOptimalLapTimeFuelValuesAvg(float& calculatedLapTime, float& calculatedLapFuel)
{
calculatedLapTime = 0.0; // use lowest
calculatedLapFuel = 0.0; // highest may be too high, use average + 1*StdDev?

float avgLapTime;
float avgFuel;
calcAverage(avgLapTime, avgFuel);

float stdDevLapTime = 0.0;
float stdDevFuel = 0.0;
calcStandardDeviation(avgLapTime, avgFuel, stdDevLapTime, stdDevFuel);

float boundsLapTime = stdDevLapTime * 3.0f;
float boundsFuel = stdDevFuel * 3.0f;

std::list< std::pair<float, float> >::iterator it;
for (it = m_dataLapFuelPairList.begin();
it != m_dataLapFuelPairList.end();
++it)
{
std::pair<float, float> element = *it;

float diffLapTime = fabs(element.first - avgLapTime);
float diffFuel = fabs(element.second - avgFuel);

// Skip outliers
//
if (diffLapTime > boundsLapTime ||
diffFuel > boundsFuel)
{
continue;
}

// Take the lowest lap time in the list
//
if (element.first < calculatedLapTime ||
calculatedLapTime <= 0.0)
{
calculatedLapTime = element.first;
}

// Take the highest fuel value
//
if (element.second > calculatedLapFuel)
{
calculatedLapFuel = element.second;
}
}

// Fuel is average + 1 standard deviation.
//... alternatively, drop the outliers and take the largest value ...
//
//calculatedLapFuel = avgFuel + stdDevFuel;
}
*/