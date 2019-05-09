#ifndef _SHAREDDATA_H
#define _SHAREDDATA_H
#pragma once

#include <string>
#include <map>
#include <mutex>

class SharedData
{
public:

    //static void stripUnicode(std::string& str);

	SharedData(void);
	virtual ~SharedData(void);

	void setSessionInfo(std::string headerSessionInfo);
	std::string getSessionInfo(void);

    void SharedData::setData(std::map<std::string, std::string> dataStrMap);
    std::map<std::string, std::string> getData(void);

    void setFuelMessage(const std::string& fuelMessage);
    std::string getFuelMessage(void);

private:
    
    // used by stripUnicode
    //static bool invalidChar(char c);

	std::mutex  m_mutex;

	std::string m_sessionInfoStr;
    std::map<std::string, std::string> m_dataStrMap;

    std::string m_fuelMessage;
};

#endif
