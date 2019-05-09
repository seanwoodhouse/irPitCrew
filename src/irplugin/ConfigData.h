#pragma once

#include <string>


class ConfigData
{
public:
    ConfigData(const std::string& strDataDir);
    virtual ~ConfigData();

    void readConfigData(
        const std::string& currentCar,
        bool& isDisplayFuelImperial,
        bool& isUseDriverLapsRemaining,
        bool& isSkipClearOnApply,
        int& serverPort,
        double& extraLapsOfFuel,
        bool& isDisplayCarFuelAsWeight);

private:

    ConfigData(void);

    const bool parseAttributeValue(
        const std::string& strLine, const std::string& strAttributeString, bool& isValueSet, int& valueAsInt, double& doubleValue);

    // trim from start
    static std::string &ltrim(std::string &s);
    // trim from end
    static std::string &rtrim(std::string &s);
    // trim from both ends
    static std::string &trim(std::string &s);


    std::string m_strConfigFile;
};
