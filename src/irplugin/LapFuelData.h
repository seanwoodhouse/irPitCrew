#pragma once
#ifndef _LAPFUELDATA_H
#define _LAPFUELDATA_H

#include <list>
#include <string>

class LapFuelData
{
public:
    LapFuelData(const std::string strDataDir);
    virtual ~LapFuelData();

    // To allows saving after every lap.
    // Saves data for the current car and track without clearing anything.
    //
    void SaveCurrentSessionData(void);

    // Call on Header change (open/switch sessions) and on Exit (save session).
    // Saves current track/car data and opens new data.
    // To save current data without loading new data (on exit), pass "" for newTrack 
    // and newCar.
    //
    void ResetSessionData(
        const std::string& newTrack,
        const std::string& newCar);

    // lapLastLapTime: from irsdk
    // fuelLevel: fuel level when lastLapTime changes/updated
    // (Pass -1 for unknown values)
    // Call for each lap (when lapLastLapTime changes) and grab current
    // fuel level for lap.  Fuel level is stored and will be compared 
    // to the last Fuel Level to calculate the fuel used on the lap.
    // Note, no data will be captured until 2 laps: 
    //   first lap gives lap time and starting fuel, next lap gives 
    //   another lap time and next fuel, then so fuel delta can be calculated.
    bool AddLapData(
        const float lapLastLapTime, 
        const float fuelLevel);

    // Calculate optimal values using the median of collected results.
    // Will calculate Median and Median Absolute Deviation.
    //
    // Estimate faster lap time.
    // Go 1 MAD lower/faster than median lap.
    // (lower lap time = more estimated Laps = more estimated Fuel = safer)
    //
    // Estimate higher fuel usage.
    // Go 1 MAD higher than median fuel.
    // (higher lap fuel = more estimated Fuel = safer)
    //
    //
    void calcOptimalLapTimeFuelValues(float& calculatedLapTime, float& calculatedLapFuel, const double maxFuel);
    // void calcOptimalLapTimeFuelValuesAvg(float& calculatedLapTime, float& calculatedLapFuel);

    void printListValues(void);

private:

    LapFuelData(void);

    const char* GetSessionDataDirectoryName(void);
    void GetSessionDataFileName(const std::string& trackName, const std::string& carName, std::string& outputFileName);
    void SaveSessionData(const std::string& newTrack, const std::string& newCar);
    void LoadSessionData(const std::string& trackName, const std::string& carName);

//    void calcAverage(float& avgLapTime, float& avgFuel);
//    void calcStandardDeviation(const float avgLapTime, const float avgFuel, float& stdDevLapTime, float& stdDevFuel);

    // Calculate Median and Median Absolute Deviation (MAD)
    //
    void calcMedian(const std::list<float>& valuesList, const bool excludeOutliers, float &medianValue, float& madValue);
    void calcMedianValues(float& medLapTime, float& medFuel, float &madLapTime, float& madFuel);

    std::string m_strLapDataDir;

    unsigned int m_dataCountMax;

    // Store the LapTime and LapFuel values for car/track combo here.
    // Each Car/Track combo gets a file.
    // File is read in when Header changes, saved on Ctrl-c or Exit, 
    // saved when header Changes (when exit sim, on overview screen).
    // Buffer certain number of values (30/50).
    //

    // For Median
    std::list<float> m_dataLapTimeList;
    std::list<float> m_dataLapFuelList;
    // For Avg, StdDev method
    //std::list< std::pair<float, float> > m_dataLapFuelPairList;

    std::string m_currentTrack;
    std::string m_currentCar;

    float m_lastFuelValue;
};

#endif
