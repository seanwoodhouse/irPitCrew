#include "SharedData.h"

//#include <algorithm>
#include <map>
#include <mutex>
#include <string>


//bool invalidChar(char c)
//{
//    return !(c >= 0 && c <128);
//}

//void stripUnicode(std::string& str)
//{
//    str.erase(remove_if(str.begin(), str.end(), invalidChar), str.end());
//}


SharedData::SharedData(void)
{
}


SharedData::~SharedData(void)
{
}

void SharedData::setSessionInfo(std::string sessionInfo)
{
	m_mutex.lock();
	{
		m_sessionInfoStr = sessionInfo;
	}
	m_mutex.unlock();
}

std::string SharedData::getSessionInfo(void)
{
	std::string returnValue;

	m_mutex.lock();
	{
		returnValue = m_sessionInfoStr;
	}
	m_mutex.unlock();

	return returnValue;
}

void SharedData::setData(std::map<std::string, std::string> dataStrMap)
{
	m_mutex.lock();
	{
		m_dataStrMap = dataStrMap;
	}
	m_mutex.unlock();
}

std::map<std::string, std::string> SharedData::getData(void)
{
    std::map<std::string, std::string> returnValue;

	m_mutex.lock();
	{
        returnValue = m_dataStrMap;
	}
	m_mutex.unlock();

	return returnValue;
}

void SharedData::setFuelMessage(const std::string& fuelMessage)
{
    m_mutex.lock();
    {
        m_fuelMessage = fuelMessage;
    }
    m_mutex.unlock();
}

std::string SharedData::getFuelMessage(void)
{
    std::string returnValue;

    m_mutex.lock();
    {
        returnValue = m_fuelMessage;
        m_fuelMessage.clear();
    }
    m_mutex.unlock();

    return returnValue;
}
