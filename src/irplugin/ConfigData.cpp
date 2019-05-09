#include "ConfigData.h"

#include <fstream>
#include <sstream>
#include <list>
#include <algorithm> 
#include <functional> 
#include <cctype>
#include <locale>


ConfigData::ConfigData(const std::string& strDataDir)
{
    m_strConfigFile = strDataDir + "\\config.txt";
}

ConfigData::~ConfigData()
{
}

void ConfigData::readConfigData(
    const std::string& currentCar,
    bool& isDisplayFuelImperial,
    bool& isUseDriverLapsRemaining,
    bool& isSkipClearOnApply,
    int& serverPort,
    double& extraLapsOfFuel,
    bool& isDisplayCarFuelAsWeight)
{
    const std::string strDisplayFuelImperial = "DisplayFuelImperial";
    const std::string strUseDriverLapsRemaining = "UseDriverLapsRemaining";
    const std::string strSkipClearOnApply = "SkipClearOnApply";
    const std::string strServerPort = "ServerPort";
    const std::string strExtraLapsOfFuel = "ExtraLapsOfFuel";

    const std::string strDisplayCarFuelAsWeightBase = "DisplayCarFuelAsWeight";
    const std::string strDisplayCarFuelAsWeightForCar = strDisplayCarFuelAsWeightBase + "_" + currentCar;

    const bool isCurrentCarSpecified = (!currentCar.empty());

    // Set Defaults.
    //
    isDisplayFuelImperial = false;
    isUseDriverLapsRemaining = true;
    isSkipClearOnApply = false;
    serverPort = 48900;
    extraLapsOfFuel = 0.0;
    isDisplayCarFuelAsWeight = false;

    bool isDisplayFuelImperialFound = false;
    bool isUseDriverLapsRemainingFound = false;
    bool isSkipClearOnApplyFound = false;
    bool isServerPortValueFound = false;
    bool isExtraLapsOfFuelValueFound = false;
    bool isDisplayCarFuelAsWeightFound = false;

    bool isUpdateRequired = false;
    //std::list<std::string> originalFileContents;
    std::list<std::string> origCarSettings;

    // Open file for reading, if it exists.
    //
    std::ifstream inputFile;
    std::string strLine;

    inputFile.open(m_strConfigFile, std::ios::in);
    if (inputFile.is_open())
    {
        while (getline(inputFile, strLine))
        {
            //originalFileContents.push_back(strLine);

            strLine = ConfigData::trim(strLine);

            if (strLine.empty())
            {
                continue;
            }
            if ('#' == strLine[0])
            {
                continue;
            }

            bool isValueSet = false;
            int valueAsInt = 0;
            double valueAsDouble = 0.0;

            // Get the isDisplayFuelImperial value, if set.
            //
            isValueSet = false;
            valueAsInt = 0;
            valueAsDouble = 0.0;
            if (!isDisplayFuelImperialFound && 
                ConfigData::parseAttributeValue(strLine, strDisplayFuelImperial, isValueSet, valueAsInt, valueAsDouble))
            {
                isDisplayFuelImperial = isValueSet;
                isDisplayFuelImperialFound = true;
            }

            // Get the isUseDriverLapsRemaining value, if set.
            //
            isValueSet = false;
            valueAsInt = 0;
            valueAsDouble = 0.0;
            if (!isUseDriverLapsRemainingFound &&
                ConfigData::parseAttributeValue(strLine, strUseDriverLapsRemaining, isValueSet, valueAsInt, valueAsDouble))
            {
                isUseDriverLapsRemaining = isValueSet;
                isUseDriverLapsRemainingFound = true;
            }

            // Get the isSkipClearOnApply value, if set.
            //
            isValueSet = false;
            valueAsInt = 0;
            valueAsDouble = 0.0;
            if (!isSkipClearOnApplyFound &&
                ConfigData::parseAttributeValue(strLine, strSkipClearOnApply, isValueSet, valueAsInt, valueAsDouble))
            {
                isSkipClearOnApply = isValueSet;
                isSkipClearOnApplyFound = true;
            }

            // Get the serverPortValue, if set.
            //
            isValueSet = false;
            valueAsInt = 0;
            valueAsDouble = 0.0;
            if (!isServerPortValueFound &&
                ConfigData::parseAttributeValue(strLine, strServerPort, isValueSet, valueAsInt, valueAsDouble))
            {
                // Use the returned integer. Don't bother with error checking on port number.
                //
                serverPort = valueAsInt;
                isServerPortValueFound = true;
            }

            // Get the extraLapsOfFuelValue, if set.
            //
            isValueSet = false;
            valueAsDouble = 0.0;
            if (!isExtraLapsOfFuelValueFound &&
                ConfigData::parseAttributeValue(strLine, strExtraLapsOfFuel, isValueSet, valueAsInt, valueAsDouble))
            {
                // Use the returned double.
                //
                extraLapsOfFuel = valueAsDouble;
                isExtraLapsOfFuelValueFound = true;
            }

            // Get the isDisplayCarFuelAsWeight value, if set.
            //
            if (isCurrentCarSpecified)
            {
                isValueSet = false;
                valueAsInt = 0;
                valueAsDouble = 0.0;
                if (!isDisplayCarFuelAsWeightFound &&
                    ConfigData::parseAttributeValue(strLine, strDisplayCarFuelAsWeightForCar, isValueSet, valueAsInt, valueAsDouble))
                {
                    isDisplayCarFuelAsWeight = isValueSet;
                    isDisplayCarFuelAsWeightFound = true;
                }
            }

            // Save all current DisplayCarFuelAsWeight values so they can be written to the
            // new file if necessary.
            //
            if (strLine.length() >= (strDisplayCarFuelAsWeightBase.length()) &&
                0 == strLine.compare(0, strDisplayCarFuelAsWeightBase.length(), strDisplayCarFuelAsWeightBase))
            {
                origCarSettings.push_back(strLine);
            }
        }
        inputFile.close();

        // Regenerate the whole file if any of these are missing. Keep existing settings.
        //
        if (!isDisplayFuelImperialFound ||
            !isUseDriverLapsRemainingFound ||
            !isSkipClearOnApplyFound ||
            !isServerPortValueFound ||
            !isExtraLapsOfFuelValueFound)
        {
            isUpdateRequired = true;
        }

        // If current car is specified but was not found, add the new car to the end of the file.
        //
        if (!isDisplayCarFuelAsWeightFound && isCurrentCarSpecified)
        {
            // Add default for isDisplayCarFuelAsWeight to the end of the exising file contents.
            //
            isUpdateRequired = true;
        }
    }
    else
    {
        // The file doesn't exist, create one.
        //
        isUpdateRequired = true;
    }

    // If any update is required, the entire file is recreated, keeping the original settings.
    //
    if (isUpdateRequired)
    {
        std::list<std::string> fileContents;

        // Create data for a new config file.
        //
        fileContents.push_back("# Configuration File for irPitCrew.");
        fileContents.push_back("# ");
        fileContents.push_back("# This file is automatically created on startup if it does not exist.");
        fileContents.push_back("# ");
        fileContents.push_back("# New attributes will be added dynamically; for example, when a new car");
        fileContents.push_back("# is first encountered, a new DisplayCarFuelAsWeight_ value will be ");
        fileContents.push_back("# added to the file, which can then be configured manually.");
        fileContents.push_back("# ");
        fileContents.push_back("");

        // Add value for DisplayFuelImperial.
        //
        fileContents.push_back("");
        fileContents.push_back("# Specify the fuel units to use on the remote display.");
        fileContents.push_back("# 0 for Metric, 1 for Imperial.");
        fileContents.push_back("# ");

        std::string newLine = strDisplayFuelImperial + " ";
        (isDisplayFuelImperial) ? (newLine.append("1")) : (newLine.append("0"));
        fileContents.push_back(newLine);

        // Add value for UseDriverLapsRemaining.
        //
        fileContents.push_back("");
        fileContents.push_back("# This applies to races based on number of laps (not relevant in timed races).");
        fileContents.push_back("# If this is set to 0, will use the session (race leader) remaining laps");
        fileContents.push_back("# to calculate fuel.");
        fileContents.push_back("# Set to 1 to use the your (driver) remaining laps instead.");
        fileContents.push_back("# Setting this to 1 gives you more fuel (unless you are the leader).");
        fileContents.push_back("# ");

        newLine = strUseDriverLapsRemaining + " ";
        (isUseDriverLapsRemaining) ? (newLine.append("1")) : (newLine.append("0"));
        fileContents.push_back(newLine);

        // Add value for SkipClearOnApply.
        //
        fileContents.push_back("");
        fileContents.push_back("# Skip the \"clear\" command on Apply.");
        fileContents.push_back("# If set to 1, irPitCrew will not unset the current iRacing black box settings for");
        fileContents.push_back("# tires, fuel, fast repair, etc. before applying the new settings.");
        fileContents.push_back("# This means values currently selected in iRacing will not be unset by irPitCrew.");
        fileContents.push_back("# ");
        fileContents.push_back("# This setting is useful if you are only using the App for fuel and don't ");
        fileContents.push_back("# want it to clear your tires / fast repair settings on Apply.");
        fileContents.push_back("# ");
        fileContents.push_back("# Another option if using this setting is to set \"autoResetPitBox = 0\" in");
        fileContents.push_back("# iRacing's app.ini file, which should give you one \"clear\" when you leave");
        fileContents.push_back("# the pit stall, then Auto Apply will do one Apply when driving back in.");
        fileContents.push_back("# ");        

        newLine = strSkipClearOnApply + " ";
        (isSkipClearOnApply) ? (newLine.append("1")) : (newLine.append("0"));
        fileContents.push_back(newLine);
        
        // Add value for ServerPort.
        //
        fileContents.push_back("");
        fileContents.push_back("# Port to use for server.");
        fileContents.push_back("# Change this value if the current port is blocked for some reason and the remote display");
        fileContents.push_back("# is unable to connect to the server. In general, select from the range 1024 - 49151.");
        fileContents.push_back("# When connecting from the remote display, specify the port by adding it to the");
        fileContents.push_back("# target address, for example:");
        fileContents.push_back("# For address 192.168.1.45 and port 5000, specify 192.168.1.45:5000 in the browser address bar.");
        fileContents.push_back("# ");

        newLine = strServerPort + " ";
        std::ostringstream oss;        
        oss << serverPort;
        newLine.append(oss.str());
        fileContents.push_back(newLine);

        // Add value for ExtraLapsOfFuel.
        //
        fileContents.push_back("");
        fileContents.push_back("# Laps of Fuel to add to the calculated fuel value for an extra margin of safety.");
        fileContents.push_back("# For example: Set to 2 for two extra laps of fuel, or 0.5 for an extra half lap.");
        fileContents.push_back("# Default: 0");
        fileContents.push_back("# ");

        newLine = strExtraLapsOfFuel + " ";
        oss.clear();
        oss.str("");
        oss << extraLapsOfFuel;
        newLine.append(oss.str());
        fileContents.push_back(newLine);
       
        // Add values for DisplayCarFuelAsWeight for each car.
        //
        fileContents.push_back("");
        fileContents.push_back("# DisplayCarFuelAsWeight: 0 for volume (litres), 1 for weight (kg).");
        fileContents.push_back("# Manually adjust these per car based on how the car displays fuel.");
        fileContents.push_back("# ");

        // Add all cars and settings from the original file.
        //
        for (const std::string& strOrigCarLine : origCarSettings)
        {
            fileContents.push_back(strOrigCarLine);
        }

        // If current car is specified but was not found, add the new car to the end of the file.
        //
        if (!isDisplayCarFuelAsWeightFound && isCurrentCarSpecified)
        {
            // Add default for isDisplayCarFuelAsWeight to the end of the exising file contents.
            //
            std::string newCarLine = strDisplayCarFuelAsWeightForCar + " ";
            (isDisplayCarFuelAsWeight) ? (newCarLine.append("1")) : (newCarLine.append("0"));

            fileContents.push_back(newCarLine);
        }

        fileContents.push_back("");
        
        // Write back to the file.
        //
        // Open file, create if doesn't exist, delete existing contents.
        //
        std::ofstream outputFile;
        outputFile.open(m_strConfigFile, std::ios::out | std::ios::trunc);
        if (outputFile.is_open())
        {
            for (const std::string& strOutLine : fileContents)
            {
                outputFile << strOutLine << "\n";
            }

            outputFile.close();
        }
    }
}


const bool ConfigData::parseAttributeValue(const std::string& strLine, const std::string& strAttributeString, bool& isValueSet, int& intValue, double& doubleValue)
{
    bool isValueFound = false;
    isValueSet = false;
    intValue = 0;

    std::string strLineMod(strLine);
    ConfigData::trim(strLineMod);

    std::string strAttributeStringMod(strAttributeString);
    ConfigData::trim(strAttributeStringMod);
    // Must be a space after attribute.
    //
    strAttributeStringMod += " ";

    // Check if isDisplayFuelImperial is specified.
    // Length should be at least comparison string (including a space after) + 1.
    //
    if (strLineMod.length() >= (strAttributeStringMod.length() + 1) &&
        0 == strLineMod.compare(0, strAttributeStringMod.length(), strAttributeStringMod))
    {
        std::string strValue = strLineMod.substr(strAttributeStringMod.length());
        strValue = ConfigData::trim(strValue);
        if (!strValue.empty())
        {
            // If it's a 0, value is false, else it's true.
            //
            if (strValue[0] != '0')
            {
                isValueSet = true;
            }

            intValue = atoi(strValue.c_str());
            doubleValue = atof(strValue.c_str());

            isValueFound = true;
        }
    }

    return isValueFound;
}

// trim from start
std::string& ConfigData::ltrim(std::string& s) 
{
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), std::not1(std::ptr_fun<int, int>(std::isspace))));
    return s;
}
// trim from end
std::string& ConfigData::rtrim(std::string& s)
{
    s.erase(std::find_if(s.rbegin(), s.rend(), std::not1(std::ptr_fun<int, int>(std::isspace))).base(), s.end());
    return s;
}
// trim from both ends
std::string& ConfigData::trim(std::string &s)
{
    return ltrim(rtrim(s));
}
