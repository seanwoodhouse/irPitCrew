// irplugin.cpp : Defines the entry point for the console application.
//
// an example iracing plug applcation displaying drivers nam, number and car
// and real time rpm and gear.
//
// provided as is and has been tested to compile correctly on my machine.
// no warranty or otherwise esponsablilty implied.
//
// some sections of code are from community and iracing staff feedback and are referenced
// throughout where appropriate.
//
// ive added an additional header (irplugin.h) where i stick all my own functions as a habit
// and to neaten up the code to save from twalling lines for debugging issues.
//
// p.s i havne gone through and update the c string to c++ string declarations, but they work ok.
//
// have fun! :-)
//

#include "stdafx.h"

//bring in some usual headers for various tasks////
#include <windows.h>

#include <cassert>
#include <conio.h>
#include <exception>
#include <list>
#include <mmsystem.h>
#include <signal.h>
#include <sstream>
#include <stdio.h>
#include <string>
#include <thread>
#include <time.h>
#include <utility>
#include <winsock.h>

#include "ConfigData.h"
#include "LapFuelData.h"
#include "WebServerLWS.h"
#include "SharedData.h"

#include <iostream>

// for timeBeginPeriod()
//#pragma comment(lib, "Winmm")
// for RegisterWindowMessageA() and SendMessage()
//#pragma comment(lib, "User32")

/////////////////
//bring in the irsdk headers
#include "irsdk_defines.h"	//irsdk
#include "yaml_parser.h"	//irsdk
/////////////////////////////////////////////////////////
#include "irplugin.h"  //imports application specific custom functions
////////////////////////////////////////////////////////

// set standard namespace
using namespace std;

// Forward declarations
//
//void updateGlovePieData(float fuelLevel, double raceStartOffset, double sessionTime);
void handlePitCommandMessage(std::string& message);
int irsdk_getNumVars_local(void);
bool irsdk_getVarData_local(int index, char* pData, int precision, std::string &varName, std::string &varData);
BOOL WINAPI CloseConsoleHandler(DWORD dwCtrlType);

const double convertFuelLitresToDisplay(const double fuelValueInLitres);
const double convertFuelDisplayToLitres(const double fuelValueDisplay);
void calculateFuelDisplayConversionFactor(
    const bool isDisplayFuelImperial, const bool isDisplayCarFuelWeight,
    double& fuelDisplayConversionFactor, std::string& strFuelDisplayUnits);
void convertSecondsToTimeString(const double g_estimatedLapTime, std::string& strElapsedTime);

template<typename T>
bool readDataVarFromMap(std::map<std::string, std::string>& strDataMap, std::string varName, T& varData);
template<typename T>
void addDataVarToMap(std::map<std::string, std::string>& strDataMap, std::string& varName, T varData, int precision);
void addStringDataVarToMap(std::map<std::string, std::string>& strDataMap, std::string& varName, std::string& varDataStr);
void getDataFromSessionInfo(std::map<std::string, std::string>& strDataMap, int sessionNum, float estLapTime, 
    float& carAheadIntervalSec, float& carBehindIntervalSec,
    std::string& carAheadCarNumber, std::string& carBehindCarNumber,
    std::string& carAheadInitials, std::string& carBehindInitials, 
    int& carAheadPos, int& carBehindPos);
int displayIPs(int serverPort);

/////////////////////////////////////////
// Used for communication with GlovePIE voice commands script
//#include "osc/OscOutboundPacketStream.h"
//#include "ip/UdpSocket.h"

//#define OSC_ADDRESS "127.0.0.1"
//#define OSC_PORT 1945

//#define OSC_OUTPUT_BUFFER_SIZE 1024
//char osc_buffer[OSC_OUTPUT_BUFFER_SIZE];

//UdpTransmitSocket transmitSocket(IpEndpointName(OSC_ADDRESS, OSC_PORT));
///////////////////////////////////// End GlovePIE definitions

//#define BACKLOG 5
//#define PROTOCOL "HTTP/1.1"

// Mutex to stop multiple instances of app from running
//
HANDLE g_hOneInstanceMutex = NULL;

// Data shared between threads
SharedData sharedData;

// Run from the local directory
//
static const std::string DATA_DIR = ".\\Data";
const std::string CONFIG_FILE = DATA_DIR + "\\config.txt";

// The web server thread
//
WebServerLWS *webServerP = nullptr;

// LapFuelData will create the DATA_DIR if it doesn't exist.
// Config data will not (so keep this order).
//
LapFuelData g_LapFuelData(DATA_DIR);
ConfigData g_ConfigData(DATA_DIR);

// timeout in milliseconds for update loop
//#define TIMEOUT 16
//#define TIMEOUT 50
#define TIMEOUT 200
//#define TIMEOUT 250
//#define TIMEOUT 500
//#define TIMEOUT 1000

std::string strAppVers = 
    "irPitCrew v1.02                                          (c) 2019 Sean Woodhouse";
                                                                               
char *data = NULL;
int nData = 0;

#define BUFFER_SIZE 512
char g_buffer[BUFFER_SIZE] = "\0";

// Fuel conversion values
// (g_DriverCarFuelKgPerLtr is 0.75, except for Jetta)
//
bool g_isDisplayFuelImperial = false;
bool g_isUseDriverLapsRemaining = false;
bool g_isSkipClearOnApply = false;
int  g_serverPort = 80;
double g_extraLapsOfFuel = 0.0;
bool g_isDisplayCarFuelWeight = false;

// Value is read from API: if Litres mode, is required to convert kg back to L 
double g_DriverCarFuelKgPerLtr = 1.0;

// Accounts for litres/gallons/kgs/lbs conversions.
//
double g_FuelDisplayConversionFactor = 1.0;
std::string g_strFuelDisplayUnits;

// Any less and the car starts to stutter.
//
const double MIN_FUEL_LITRES = 0.4;


void _tmain(int argc, _TCHAR* argv[])
{
	//inital application startup.

    // Allow only once instance of this application
    //
    try {
        // Try to open the mutex.
        g_hOneInstanceMutex = OpenMutex(
            MUTEX_ALL_ACCESS, 0, "irPitCrew");

        if (!g_hOneInstanceMutex)
        {
            // Mutex doesn’t exist. This is
            // the first instance so create
            // the mutex.
            g_hOneInstanceMutex = CreateMutex(0, 0, "irPitCrew");
        }
        else
        {
            // The mutex exists so this is the
            // the second instance so return.
            return;
        }
    }
    catch (std::exception& e)
    {
        std::cout << "... Exception caught: " << e.what() << '\n';
    }

    system("cls"); //clear console
    printf("%s\n", strAppVers.c_str());

    //printf("Press CTRL-C to exit.\n");

    // trap ctrl-c
    //signal(SIGINT, ex_program);

    // capture close event, including X button
    //
    if (FALSE == SetConsoleCtrlHandler((PHANDLER_ROUTINE)CloseConsoleHandler, TRUE))
    {
        // unable to install handler... 
        // display message to the user
        printf("\n!! Unable to install Close handler !!\n   Close window and try again. Press any key to continue...\n\n");

        // For DisplayIPs.
        //WSACleanup();

        // read 1 char to keep the window up
        char ch = _getche();

        return;
    }

    // Read config file.
    // Leave car blank, we don't need the car setting yet.
    //
    const std::string currentCar = "";
    bool isDisplayFuelImperial = false;
    bool isUseDriverLapsRemaining = false;
    bool isSkipClearOnApply = false;
    int serverPort = 80;
    double extraLapsOfFuel = 0.0;
    bool isCarDisplayCarFuelWeight = false;

    g_ConfigData.readConfigData(
        currentCar,
        isDisplayFuelImperial,
        isUseDriverLapsRemaining,
        isSkipClearOnApply,
        serverPort,
        extraLapsOfFuel,
        isCarDisplayCarFuelWeight);

    g_isDisplayFuelImperial = isDisplayFuelImperial;
    g_isUseDriverLapsRemaining = isUseDriverLapsRemaining;
    g_isSkipClearOnApply = isSkipClearOnApply;
    g_serverPort = serverPort;
    g_extraLapsOfFuel = extraLapsOfFuel;
    g_isDisplayCarFuelWeight = isCarDisplayCarFuelWeight;

    if (g_serverPort <= 0 || g_serverPort > 65535)
    {
        // unable to install handler... 
        // display message to the user
        printf("\n Invalid ServerPort specified in configuration file: %d\n Press any key to continue...\n\n", g_serverPort);

        // read 1 char to keep the window up
        char ch = _getche();

        return;
    }
    
    // For displayIPs.
    // Each call to WASStartup needs a matching call to WSACleanup.
    // Last call to cleanup will actually clean up.
    // Call cleanup on close for this case.
    //
    WSAData wsaData;
    if (WSAStartup(MAKEWORD(1, 1), &wsaData) != 0) 
    {
        printf("WSAStartup failed...\n");
//        return 255;
    }

    printf("\n");
    displayIPs(g_serverPort);
    printf("\n");



    /*
    // test...
    g_LapFuelData.ResetSessionData("testTrack", "testCar");

    g_LapFuelData.AddLapData(10, 10);
    g_LapFuelData.AddLapData(12, 9);
    g_LapFuelData.AddLapData(8, 8.2f);
    g_LapFuelData.AddLapData(10, 6.4f);
    g_LapFuelData.AddLapData(14, 5);
    g_LapFuelData.AddLapData(16, 4.1f);
    g_LapFuelData.AddLapData(13, 3.2f);
    g_LapFuelData.AddLapData(19, 2.5f);

    g_LapFuelData.printListValues();

    return;
    */

    webServerP = new WebServerLWS(g_serverPort);

	// Start the web server thread
	//
    assert(webServerP != nullptr);
	webServerP->start(&sharedData);
	
    
    // Use this until there is a way to indicate whether the current car is 
    // Kg or L. (Should be 1.0 for L cars, but it isn't (is 0.75) so use modified value)
    // Also accounts for imperial units (gallons).
    //
    calculateFuelDisplayConversionFactor(
        g_isDisplayFuelImperial, g_isDisplayCarFuelWeight,
        g_FuelDisplayConversionFactor, g_strFuelDisplayUnits);

		
	// bump priority up so we get time from the sim
	SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS);

	// ask for 1ms timer so sleeps are more precise
	timeBeginPeriod(1);

	printf("Waiting for session to start...\n\n");
    
    double g_MaxFuelLitres = -1.0;
    double g_CarClassMaxFuelPct = -1.0;
    
    int g_SessionNum = -1;

    // cached sessionInfo data, only read on SessionNum change
    std::string g_SessionTotalLaps;
    std::string g_SessionTotalTime;
    double g_lastFuelValue = -1.0;

    // The currently estimated lap time and fuel values.
    // Only need to calculate this on new session (to reset or use stored values)
    // and on every new value (1x per lap).
    //
    float g_estimatedLapTime = -1.0f;
    float g_estimatedLapFuelLitres = -1.0f;
    float g_oldLapLastLapTime = -1.0;
    
    //////////////////////////////////////////////////////
        
	while(true)
	{
        Sleep(TIMEOUT);
		if(irsdk_waitForDataReady(TIMEOUT, data))
		{
			const irsdk_header *pHeader = irsdk_getHeader();
			if(pHeader)
			{
				// if header changes size, assume a new connection
				if(!data || nData != pHeader->bufLen)
				{
					if(data) 
						delete [] data;
					nData = pHeader->bufLen;
					data = new char[nData];

                    // irsdk Header has SessionInfo (string), varHeaders (struct)
                    // varHeaders include offset to specific data values in data
                    // Data is variable and from callback above
                    //
                    // Header and session info only change here?
                    // So only need to send on connection reset or session change. (confirm)
                    //
                    // SessionInfo has results info that can change!!!
                    // Need to resend on change if used.
                    // Need to design whether to send all on string change, or
                    // try to parse out certain info
                    // (hopefully doesn't change much)
                    //

					// Save session info to shared memory
					std::string strSessionInfo = irsdk_getSessionInfoStr();

                    sharedData.setSessionInfo(strSessionInfo);

                    // Clear old data
                    std::map<std::string, std::string> strDataMap;
                    sharedData.setData(strDataMap);

                    // Tell the webserver to resend the data (reset == send all again)
                    assert(webServerP != nullptr);
                    webServerP->resetConnection();
                    webServerP->updateClient();

                    //... add updateClientSessionInfo(), then won't need to compare for changes
                    //    or set automatically in setSessionInfo(), could do the same below for data...

                    // New session, reset data if required
                    //                    
                    // g_RaceStartOffset don't reset; only reset at race start (is exit/enter sim considered a new session?)
                    g_MaxFuelLitres = -1.0;
                    g_CarClassMaxFuelPct = -1.0;

                    g_SessionNum = -1; // is read from data, used to parse from header, so only parse when this value changes
                    g_SessionTotalLaps = "";
                    g_SessionTotalTime = "";

                    g_DriverCarFuelKgPerLtr         = 1.0;
                    g_FuelDisplayConversionFactor   = 1.0;

                    // SessionLaps: unlimited


                    // SessionTime : unlimited


					///////////////////////////
					system("cls");
					printf("%s\n", strAppVers.c_str());
                    printf("\n");
                    displayIPs(g_serverPort);
                    printf("\n");

					//printf("Press CTRL-C to exit.\n");
					printf("Connected to sim...\n\n");
					// process header here///////
					// this is where you access and display your session info, like track, driver, etc.
					// these are the 'sessioninfo' and 'weekendinfo' sections.
					//


					//////////////////////////////////////////
                    std::string newTrackName;
                    const char *newTrackNameStr;
					int valuelen;
                    if (parseYaml(irsdk_getSessionInfoStr(), "WeekendInfo:TrackName:", &newTrackNameStr, &valuelen))
                    {
                        printf("Track: %.*s\n", valuelen, newTrackNameStr);

                        newTrackName = std::string(newTrackNameStr, valuelen);
                    }
                    else
                    {
					    printf("Track: not found\n");
					}

                    
                    // note: printf: .* = The precision is not specified in the format string, 
					// but as an additional integer value argument preceding the argument that has to be formatted.
					// this code Thanks to Peter holt.
					//////////////////////////////////////////

					//////////////////////////////GET LOADED CAR AND DRIVER///////////////////////////////////
					////thx to Dave Tucker for this section
					const char *valstr;
					int valstrlen; 
					char str[512];
					//
					int carIdx = -1;
					char nameStr[512] = "\0";
                    char newCarNameStr[512] = "\0";
                    char numbStr[512] = "\0";
                    /*char buffer[512] = "\0";*/

                    // DriverInfo:DriverCarFuelKgPerLtr
                    //
                    if (parseYaml(irsdk_getSessionInfoStr(), "DriverInfo:DriverCarFuelKgPerLtr:", &valstr, &valstrlen))
                    {
                        g_DriverCarFuelKgPerLtr = atof(valstr);

                        // If invalid from API, crash (maybe change to just use 1.0)
                        //
                        assert(g_DriverCarFuelKgPerLtr > 0.0);
                    }

					//
					// get the playerCarIdx
					if(parseYaml(irsdk_getSessionInfoStr(), "DriverInfo:DriverCarIdx:", &valstr, &valstrlen))
						carIdx = atoi(valstr);
					////
					if(carIdx >= 0)
					{
						//////////////////////////////////
						// get drivers name
						sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}UserName:", carIdx);
						if(parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
						{
							strncpy_s(nameStr, 512, valstr, valstrlen);
							nameStr[valstrlen] = '\0'; //driversname
						}//
						//////////////////////////////////
						// get drivers car path
						sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarPath:", carIdx);
						if(parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
						{
                            strncpy_s(newCarNameStr, 512, valstr, valstrlen);
                            newCarNameStr[valstrlen] = '\0'; //drivers car
						}//
						//////////////////////////////////
						// get drivers car number
						sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarNumber:", carIdx);
						if(parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
						{
							strncpy_s(numbStr, 512, valstr, valstrlen);
							numbStr[valstrlen] = '\0'; //drivers number
						}//
                    
						//////////////////////////////////
					}////
                    
                    // Percentage of max fuel allowed for class
                    if (parseYaml(irsdk_getSessionInfoStr(), "DriverInfo:DriverCarMaxFuelPct:", &valstr, &valstrlen))
                    {
                        g_CarClassMaxFuelPct = atof(valstr);
                    }

                    // Max Fuel should be: DriverCarFuelMaxLtr
                    if (parseYaml(irsdk_getSessionInfoStr(), "DriverInfo:DriverCarFuelMaxLtr:", &valstr, &valstrlen))
                    {
                        g_MaxFuelLitres = atof(valstr);
                    }

                    // Account for L to Kg conversion
                    //g_MaxFuelLitres *= (float)g_DriverCarFuelKgPerLtr_Display;

                    // Percentage of max fuel
                    if (g_CarClassMaxFuelPct >= 0.0)
                    {
                        g_MaxFuelLitres *= g_CarClassMaxFuelPct;
                    }


                    
					//////////////////////////////GET LOADED CAR AND DRIVER///////////////////////////////////

                    printf("Driver: %s %s %s \n\n", numbStr, nameStr, newCarNameStr);
					//////////////////////////////GET LOADED CAR AND DRIVER///////////////////////////////////
					//where 
					// numbstr = drivers car number 
					// namestr = drivers text full name
					// namestr = car/chassis in use by driver.


					//
					//
					/////////////////////////////end process headers here


                    // Re-read config values for this car.
                    //
                    bool isDisplayFuelImperial = false;
                    bool isUseDriverLapsRemaining = false;
                    bool isSkipClearOnApply = false;
                    bool isDisplayCarFuelWeight = false;
                    double extraLapsOfFuel = 0.0;

                    // This value is not set globally since the web server is already
                    // running using the original port at this point.
                    //
                    int serverPortUnused = 0;

                    g_ConfigData.readConfigData(
                        newCarNameStr,
                        isDisplayFuelImperial,
                        isUseDriverLapsRemaining,
                        isSkipClearOnApply,
                        serverPortUnused,
                        extraLapsOfFuel,
                        isDisplayCarFuelWeight);

                    g_isDisplayFuelImperial = isDisplayFuelImperial;
                    g_isUseDriverLapsRemaining = isUseDriverLapsRemaining;
                    g_isSkipClearOnApply = isSkipClearOnApply;
                    g_isDisplayCarFuelWeight = isDisplayCarFuelWeight;
                    g_extraLapsOfFuel = extraLapsOfFuel;

                    // Use this until there is a way to indicate whether the current car is 
                    // Kg or L. (Should be 1.0 for L cars, but it isn't (is 0.75) so use modified value)
                    // Also accounts for imperial units (gallons).
                    //
                    calculateFuelDisplayConversionFactor(
                        g_isDisplayFuelImperial, g_isDisplayCarFuelWeight,
                        g_FuelDisplayConversionFactor, g_strFuelDisplayUnits);


                    // Apply the new track and car combo. Will also save the data file
                    // and load a new one.
                    //
                    g_LapFuelData.ResetSessionData(newTrackName, newCarNameStr);

                    // Reset the currently estimated lap time and fuel values.
                    // Only need to calculate this on new session (to reset or use stored values)
                    // and on every new value (1x per lap).
                    //
                    g_LapFuelData.calcOptimalLapTimeFuelValues(g_estimatedLapTime, g_estimatedLapFuelLitres, g_MaxFuelLitres);
                    g_oldLapLastLapTime = -1.0;
                    
                    const double estimatedLapFuelDisplay = convertFuelLitresToDisplay(g_estimatedLapFuelLitres);
                    std::string strEstLapTime;
                    convertSecondsToTimeString(g_estimatedLapTime, strEstLapTime);
                    std::cout << "Estimated Lap Time: " << strEstLapTime << ", Lap Fuel: " << estimatedLapFuelDisplay << " " << g_strFuelDisplayUnits << std::endl;

				}
				else if(data)
				{
					// process data here///////////
					// this is where you access and work with the telemitry vars, in 1/60th itterations.
					// see 'irsdk 1_0 data vars.csv' for specific ones you're after.
					//




                    // SessionInfo has results info that can change!!!
                    // Need to resend on change if used.
                    // Need to design whether to send all on string change, or
                    // try to parse out certain info
                    // (hopefully doesn't change much)
                    //

                    //// Save session info to shared memory
                    //std::string strSessionInfo = irsdk_getSessionInfoStr();

                    //sharedData.setSessionInfo(strSessionInfo);



                    
                    // truncate all floating point value to 3 decimal places to save
                    // bandwidth. Many of the sdk value fluctuate around 3 decimal 
                    // places. We don't generally care about this level of precision.
                    // (value also used in addDataVarToMap())
                    // 
                    int precision = 3;

                    int numVars = irsdk_getNumVars_local();

                    std::map<std::string, std::string> strDataMap;

                    // Get each data field and value from from SDK
                    // Data will be sent as a string in WebServerLWS:
                    //   Separate vars by '\n'   //'|'
                    //   Separate fields by ';'  
                    //   Arrays of values are comma separated
                    //   "|name;value|name;value1,value2|name;value|"
                    //
                    for (int ii = 0; ii < numVars; ++ii)
                    {
                        std::string varName;
                        std::string varDataStr;

                        if (irsdk_getVarData_local(ii, data, precision, varName, varDataStr))
                        {
                            addStringDataVarToMap(strDataMap, varName, varDataStr);
                        }
                    }

                    bool isReadSuccess = false;
                                        					
                    
					//FuelLevel
					//const char g_Fueloffset[] = "FuelLevel";
					//int Fueloffset = irsdk_varNameToOffset(g_Fueloffset);
                    //float fuelLevel = * ((float *)(data + Fueloffset));
                    float fuelLevelLitres = 0.0f;
                    isReadSuccess = readDataVarFromMap(strDataMap, "FuelLevel", fuelLevelLitres);
                    assert(isReadSuccess);
 
                    // Account for L to Kg conversion
                    //fuelLevelLitres *= (float)g_DriverCarFuelKgPerLtr_Display;

                    //FuelLevelPct
                    //const char g_FuelPctoffset[] = "FuelLevelPct";
                    //int FuelPctoffset = irsdk_varNameToOffset(g_FuelPctoffset);
                    //static float sOldFuelPct = -1.0f;
                    //float fuelLevelPct = *((float *)(data + FuelPctoffset));
                    float fuelLevelPct = 0.0f;
                    isReadSuccess = readDataVarFromMap(strDataMap, "FuelLevelPct", fuelLevelPct);
                    assert(isReadSuccess);

                    //LapLastLapTime
                    //const char g_LapLastLapTimeoffset[] = "LapLastLapTime";
                    //int LapLastLapTimeoffset = irsdk_varNameToOffset(g_LapLastLapTimeoffset);                    
                    //float lapLastLapTime = *((float *)(data + LapLastLapTimeoffset));
                    float lapLastLapTime = 0.0f;
                    isReadSuccess = readDataVarFromMap(strDataMap, "LapLastLapTime", lapLastLapTime);
                    assert(isReadSuccess);



					// SessionTime  Seconds since session start		double
					//const char g_SessionTimeoffset[] = "SessionTime";
					//int SessionTimeoffset = irsdk_varNameToOffset(g_SessionTimeoffset);
					//double sessionTime = *((double *)(data + SessionTimeoffset));
                    double sessionTime = 0.0;
                    isReadSuccess = readDataVarFromMap(strDataMap, "SessionTime", sessionTime);
                    assert(isReadSuccess);

	
					const char g_SessionFlagsoffset[] = "SessionFlags";
					int SessionFlagsoffset = irsdk_varNameToOffset(g_SessionFlagsoffset);
					
					irsdk_Flags sessionFlags = *((irsdk_Flags *)(data + SessionFlagsoffset));


                    // SessionNum   Session Number   int
                    int sessionNum = 0;
                    isReadSuccess = readDataVarFromMap(strDataMap, "SessionNum", sessionNum);
                    assert(isReadSuccess);

                    // If session number changes, re parse the required session info from the header
                    if (sessionNum != g_SessionNum &&
                        sessionNum >= 0)
                    {
                        g_SessionNum = sessionNum;

                        const char *valstr;
                        int valstrlen;
                        char str[512];

                        // SessionLaps
                        sprintf_s(str, 512, "SessionInfo:Sessions:SessionNum:{%d}SessionLaps:", sessionNum);
                        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
                        {
                            strncpy_s(g_buffer, 512, valstr, valstrlen);
                            g_buffer[valstrlen] = '\0';

                            g_SessionTotalLaps = g_buffer;
                        }
                        else
                        {
                            fprintf(stderr, "Parse error: SessionLaps\n");
                        }

                        // SessionTime
                        sprintf_s(str, 512, "SessionInfo:Sessions:SessionNum:{%d}SessionTime:", sessionNum);
                        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
                        {
                            strncpy_s(g_buffer, 512, valstr, valstrlen);
                            g_buffer[valstrlen] = '\0';

                            g_SessionTotalTime = g_buffer;
                        }
                        else
                        {
                            fprintf(stderr, "Parse error: SessionTime\n");
                        }
                    }
                    

                    // Calculate data and add to Data sent to Web Server
                    //
                    
                    const double maxFuelDisplay = convertFuelLitresToDisplay(g_MaxFuelLitres);
                    addDataVarToMap(strDataMap, std::string("MaxFuel"), maxFuelDisplay, precision);

                    // Calculate Time Remaining, Laps Remaining, Total Time, Total Laps
                    //
                    // total time:     if lap race, irrelevant
                    //                 if time race is SessionTotalTime, no padding
                    //
                    // remaining time: if lap race, irrelevant
                    //                 if time race is SessionTotalTime - Elapsed, no padding
                    //
                    // total laps:     if lap race, is SessionTotalLaps
                    //                 if time race, is calculated from SessionTotalTime (then padded)
                    //
                    // remaining laps: if lap race, is SessionTotalLaps - current lap
                    //                 if time race, is calculated from RemainingTime (then padded)
                    //
                    double sessionTotalTime = -1.0;
                    double remainingTime = -1.0;
                    double elapsedTime = -1.0;
                    double sessionTotalLapsMin = -1.0;
                    double sessionTotalLapsMax = -1.0;
                    double remainingLapsMin = -1.0;
                    double remainingLapsMax = -1.0;
                    
                    double minFuelLitres = MIN_FUEL_LITRES;
                                        
                    // When last lap time changes, add a new lap.
                    // Pass in the current fuel to calculate fuel usage.
                    // (NOTE: doing fuel this way skips the first valid lap)
                    //
                    if (g_oldLapLastLapTime != lapLastLapTime)
                    {
                        g_oldLapLastLapTime = lapLastLapTime;

                        const bool isUpdated = 
                            g_LapFuelData.AddLapData(lapLastLapTime, fuelLevelLitres);
                           
                        if (isUpdated)
                        {
                            //g_LapFuelData.printListValues();

                            // Calculate the currently estimated lap time and fuel values.
                            // Only need to calculate this on new session (to reset or use stored values)
                            // and on every new value (1x per lap).
                            //
                            g_LapFuelData.calcOptimalLapTimeFuelValues(g_estimatedLapTime, g_estimatedLapFuelLitres, g_MaxFuelLitres);
                            
                            const double estimatedLapFuelDisplay = convertFuelLitresToDisplay(g_estimatedLapFuelLitres);
                            std::string strEstLapTime;
                            convertSecondsToTimeString(g_estimatedLapTime, strEstLapTime);
                            std::cout << "Estimated Lap Time: " << strEstLapTime << ", Lap Fuel: " << estimatedLapFuelDisplay << " " << g_strFuelDisplayUnits << std::endl;

                            // Save the current status of the lap/fuel data (on every lap!)
                            //
                            //printf("Saving Lap/Fuel values...\n");
                            g_LapFuelData.SaveCurrentSessionData();
                            //printf(" Saved.\n");
                        }
                    }
                    
                    if (g_SessionTotalTime != "unlimited")
                    {
                        sessionTotalTime = atof(g_SessionTotalTime.c_str());
                        
                        // Remaining time can be unlimited, but probably only if session 
                        // total time is unlimited.
                        //
                        // Get remaining time
                        //
                        double sessionTimeRemain = 0.0;
                        isReadSuccess = readDataVarFromMap(strDataMap, "SessionTimeRemain", sessionTimeRemain);
                        assert(isReadSuccess);
                        if (sessionTimeRemain < IRSDK_UNLIMITED_TIME)
                        {
                            remainingTime = sessionTimeRemain;
                        }

                        // Calculate Elapsed Time since race start
                        //                        
                        elapsedTime = sessionTotalTime - remainingTime;
                        
                        // Only calculate Laps if estimated lap time is set
                        //
                        if (g_estimatedLapTime > 0.0f)
                        {
                            // Calculate laps based on time
                            sessionTotalLapsMin = sessionTotalTime / g_estimatedLapTime;
                            remainingLapsMin = remainingTime / g_estimatedLapTime;

                            // For session laps, we know the starting position is Start/Finish line,
                            // so we know the position around the track we will be at time end (remainingLapsMin fraction),
                            // we know at the end time we will need to finish the current lap, and possibly do 1 more.
                            // So pad the last lap and add the extra possible lap.
                            //
                            // Use ceil to make sure fuel reports use rounded-up laps.
                            //
                            sessionTotalLapsMax = ceil(sessionTotalLapsMin) + 1;

                            // For remaining laps, we don't know our current position so we don't know our position at the end time.
                            // We know we are somewhere on either our last or 2nd last lap, for a max of +2 from our current position.
                            // So don't pad, just add 2.
                            //
                            int additionalLapsAtEnd = 2;
                            remainingLapsMax = remainingLapsMin + additionalLapsAtEnd;
                        }
                    
                        // After lap calculations, stop remaining time/lap countdowns at 0
                        //
                        if (remainingTime < 0.0)
                        {
                            remainingTime = 0.0;
                        }
                        if (remainingLapsMin < 0.0)
                        {
                            remainingLapsMin = 0.0;
                        }
                        if (remainingLapsMax < 0.0)
                        {
                            remainingLapsMax = 0.0;
                        }
                    }
                     
                    // Can ignore lap based calculation if this is unlimited.
                    //
                    if (g_SessionTotalLaps != "unlimited")
                    {
                        // SessionLapsRemain (for races based on laps)
                        //
                        int sessionLapsRemainEx = 0;
                        isReadSuccess = readDataVarFromMap(strDataMap, "SessionLapsRemainEx", sessionLapsRemainEx);
                        assert(isReadSuccess);
                        
                        // Can ignore lap based calculation if this is unlimited.
                        //
                        if (sessionLapsRemainEx != IRSDK_UNLIMITED_LAPS)
                        {
                            const int sessionLaps = atoi(g_SessionTotalLaps.c_str());

                            // By default use session/leader laps.
                            //
                            double raceLapsRemain = sessionLapsRemainEx;

                            // If the user wants driver laps, calculate them.
                            //
                            if (g_isUseDriverLapsRemaining)
                            {
                                int driverLap = 0;
                                isReadSuccess = readDataVarFromMap(strDataMap, "Lap", driverLap);
                                assert(isReadSuccess);

                                // If 0, make it 1 so driverLapsRemain is not +1 at start.
                                //
                                if (driverLap < 1)
                                {
                                    driverLap = 1;
                                }

                                // Calculate driverLapsRemain.
                                // Session laps is usually ok, but if leader has a problem may need an extra pit.
                                // driverLapsRemain = Session laps - current lap + 1
                                // Quote: "I believe "Lap" is the lap you are on, while "RaceLaps" is the lap 
                                //         the leader is on".
                                //
                                const double driverLapsRemain = sessionLaps - driverLap + 1;

                                raceLapsRemain = driverLapsRemain;
                            }

                            // If both set, take the smallest number of laps 
                            // (compare (remaining laps) vs (max remaining laps based on time))
                            //
                            if (remainingLapsMax < 0 ||
                                remainingLapsMax > raceLapsRemain)
                            {
                                sessionTotalLapsMin = sessionLaps;
                                sessionTotalLapsMax = sessionLaps;
                                remainingLapsMin = raceLapsRemain;
                                remainingLapsMax = raceLapsRemain;

                                // Times are not set for lap counting races
                                sessionTotalTime = -1.0;
                                remainingTime = -1.0;
                                elapsedTime = -1.0;
                            }
                        }
                    }                    

                    addDataVarToMap(strDataMap, std::string("estimatedLapTime"), g_estimatedLapTime, precision);

                    const double estimatedLapFuelDisplay = convertFuelLitresToDisplay(g_estimatedLapFuelLitres);
                    addDataVarToMap(strDataMap, std::string("estimatedLapFuel"), estimatedLapFuelDisplay, precision);

                    addDataVarToMap(strDataMap, std::string("sessionTotalLapsMin"), sessionTotalLapsMin, precision);
                    addDataVarToMap(strDataMap, std::string("sessionTotalLapsMax"), sessionTotalLapsMax, precision);
                    addDataVarToMap(strDataMap, std::string("remainingLapsMin"), remainingLapsMin, precision);
                    addDataVarToMap(strDataMap, std::string("remainingLapsMax"), remainingLapsMax, precision);
                    addDataVarToMap(strDataMap, std::string("sessionTotalTime"), sessionTotalTime, precision);
                    addDataVarToMap(strDataMap, std::string("remainingTime"), remainingTime, precision);
                    addDataVarToMap(strDataMap, std::string("elapsedTime"), elapsedTime, precision);

                    addDataVarToMap(strDataMap, std::string("FuelDisplayConversionFactor"), g_FuelDisplayConversionFactor, precision);
                    addStringDataVarToMap(strDataMap, std::string("FuelDisplayUnits"), g_strFuelDisplayUnits);
                    

                    // Calculate Fuel Required to finish the race
                    //
                    double fuelRequiredLitres = -1.0;
                    if (remainingLapsMax > 0)
                    {
                        fuelRequiredLitres = (remainingLapsMax * g_estimatedLapFuelLitres) + minFuelLitres;

                        // Add the ExtraLapsOfFuel config value.
                        //
                        double additionalFuel = extraLapsOfFuel * g_estimatedLapFuelLitres;
                        fuelRequiredLitres += additionalFuel;
                    }
                    
                    const double fuelRequiredDisplay = convertFuelLitresToDisplay(fuelRequiredLitres);
                    addDataVarToMap(strDataMap, std::string("FuelRequired"), fuelRequiredDisplay, precision);


                    // Fuel required to make a single lap
                    //
                    double fuelForOneLapLitres = g_estimatedLapFuelLitres + minFuelLitres;
                    const double fuelForOneLapDisplay = convertFuelLitresToDisplay(fuelForOneLapLitres);
                    addDataVarToMap(strDataMap, std::string("FuelForOneLap"), fuelForOneLapDisplay, precision);


                    // Laps of Fuel remaining in tank
                    //
                    double lapsOfFuel = 0.0;
                    if (g_estimatedLapFuelLitres > 0.0 &&
                        (fuelLevelLitres - minFuelLitres) > 0.0)
                    {
                        lapsOfFuel = (fuelLevelLitres - minFuelLitres) / g_estimatedLapFuelLitres;
                    }
                    addDataVarToMap(strDataMap, std::string("LapsOfFuel"), lapsOfFuel, precision);


                    // Optional pit.
                    // Available when you can pit now instead of later and get
                    // enough fuel to finish the race.
                    // "Optional pit available [now][in 5.4 laps]”
                    //
                    bool isEnoughFuel = false;
                    if (lapsOfFuel >= remainingLapsMax)
                    {
                        isEnoughFuel = true;
                    }
                    
                    double optionalPit = -1;

                    // Get the number of laps in a full tank
                    if (g_estimatedLapFuelLitres > 0.0f)
                    {
                        double lapsOfFuelFullLitres = (g_MaxFuelLitres - minFuelLitres) / g_estimatedLapFuelLitres;

                        optionalPit = remainingLapsMax - lapsOfFuelFullLitres;

                        // Optional pit must be less than current laps of fuel, or
                        // there's no option for this pit (more pits coming).
                        // Laps of Fuel must be less than Laps Remaining, or we
                        // don't need to pit.
                        //
                        if (optionalPit < lapsOfFuel && isEnoughFuel == false)
                        {
                            // Output laps to Optional pit. If negative we're already
                            // passed it and can pit now.
                            if (optionalPit <= 0)
                            {
                                // can pit now
                                optionalPit = 0;
                            }
                            else
                            {
                                // available in optionalPit laps
                                //
                            }
                        }
                        // else, have enough fuel to finish, or optional not available 
                        // based on current fuel load and laps remaining
                        else
                        {
                            // Not available
                            optionalPit = -1;
                        }
                    }

                    addDataVarToMap(strDataMap, std::string("PitAvailable"), optionalPit, precision);


                    // Interval Calculation Notes:
                    // (current calculation is not very accurate. Should fix is using it)
                    //
                    // 1) Lap: gather data while running lap
                    //         if this lap is greater than the current best (from the lap history, use it)
                    //         (expired best laps will eventually be replaced)
                    // 2) Data
                    //         gather data in a Map using ~1% data points
                    //         when lap set for use, interpolate to 1% points, put in array of 100
                    //         fill in missing points if necessary
                    //         data is stored in the car/track laps file (on save with the other data)
                    //
                    //         To use data, convert %distance from API to %time of best lap using array to map
                    //         Interpolate between points
                    //         Calculate distance
                    //         Distance ahead is my pace to that point.
                    //         Distance behind is same distance wise (my pace, not car behind)
                    //
                    // API loop is currently 200 ms, so 5 calls per second
                    // of most concern is when to start/stop the timer
                    // my indication of lap start is LastLapTime value changes
                    // this could be off due to latency
                    // Could use % values, start is meant to represent position at time 0/ 0% after all, is not really related directly to lap time
                    // - Lap does not always end at 100% (ie. 98-102)
                    // - Lap counter will try to increment at exactly 100
                    // - These differences are in the <100 ms range, could ignore, (or skip updates during s/f area for a short interval)
                    // - Times are written to file when laplastlaptime triggers, so should use this for my timer.
                    // - Assume is fired at 0% distance? (is it?) need time at 0%,1%; what if message fires at 5%
                    // - does actual time start need to align with this change?
                    // - I know a lap takes 1:30, so does it matter if this is 10%-10% or 0% to 0%? No.
                    // - What does matter is that I need % values when lap time received
                    //
                    // - Easiest is to start the timer on lap time message
                    //    - with timer started, get the value for 0% (do what if value is 5%)
                    // ! No timer, use LapCurrentLapTime as the map value
                    //    - as Dist% changes, add CurrentTime values to the map for %
                    //    - when LapLast changes, gather the current map and save.
                    //    - deal with strange % values at start and end of list
                    //    - ie is 102% Dist == current time of 0 (drop these, or use in mapping somehow? 
                    //      Consider how values will be used: have 2 %dist values: 5% Me, 10% other driver
                    //        at 5% I'm generally 8% around, at 10%: 16% time, so diff is 8% of Saved Time
                    //        at 5% I'm 0%time, at 10% I'm 8% time?, still 8%
                    //        at 3%? what is %time? Is previous lap. Use map not array?
                    // 1) don't account for rollovers like this (ie 3% is not at the end of the lap)
                    //    if 0% time starts at 5% distance, don't have 0-4% distance data, interpolate, or call it missing data (-1)
                    //    if 102% time happens, ignore it
                    //    
                    //  why not just roll over %data when it reaches 0% dist again
                    //  what if cross happens at 98%, receive lap time but data not ready 
                    //  (if receive lap time, grab the data) (if current data is new (<50 points), use last data; if current data is old use it) (still let the data collection roll at 0%dist)

                    // Solution:
                    //
                    // 1) Data collection (based on %dist, rolls at 0%, keep current and last map, use CurrentTime, 
                    //    ignore cases where CurrentTime goes down (clear previous data? no, handle when reading into array interpolated,
                    //    could use these in interpolation if required, maybe)
                    // 2) Retrieval (on LapLastLapTime, grab either the current or last data, probably last)
                    //      - if lap time is best, use this data. Read it into an array interpolating to exact 1% increments 
                    //       (no, don't interpolate, save map as is and iterate to access; if can't interpolate based on given values (out of range, like 1% in 3-100%), do nothing
                    //           (or use previous %Dist value) (in one case, car doesn't move, in the other the interval doesn't change)
                    //           (only matters around s/f line, if parked there, need the interval to change, so use last value; if cruising past may see a blip, no problem)
                    //           !(may be better to interpolate so there's always a value(on Access, not within map))
                    //
                    // 3) Access: get current %Dist values. Iterate map to convert to %Time values. Subtract and display time difference.
                    //            handle issues (ie if car ahead appears behind, do nothing (just a lap counter bug, use old value so interval still works, if there is one for this car))
                    //            WebApp will have the old value, just don't change it; if the car changes, ensure interval is either set or cleared(-1)
                    //            No, WebApp has interval, not "per car last used %time" value, need to save this for cases when have only 1 value for calculation)
                    //            Last: myLap,my%Time, car,CarLap,Car%Time
                    //
                    // (^ but do simple case first)


                    // 
                    // - OR, start timer when %Dist value changes from high to low (current is < last)
                    //    - when this happens, save the current (last) data, start saving new data
                    //    - check if lapTime message received yet. If yes, check whether to apply new data
                    //                                              If no, wait for it
                    //    - On LapTime message...
                    //   (this means tracking another static value separate from lap time)
                    //    Instead, assume laptime always appears at the same %Dist (it should be close)
                    //    Use Easiest method above...

                    float carAheadInterval = -1.0;
                    float carBehindInterval = -1.0;
                    std::string carAheadCarNumber("");
                    std::string carBehindCarNumber("");
                    std::string carAheadCarInitials("");
                    std::string carBehindCarInitials("");
                    int carAheadPos = -1;
                    int carBehindPos = -1;
                
                    if (g_estimatedLapTime > 0)
                    {
                        getDataFromSessionInfo(strDataMap, sessionNum, 
                                               g_estimatedLapTime, 
                                               carAheadInterval, carBehindInterval, 
                                               carAheadCarNumber, carBehindCarNumber,
                                               carAheadCarInitials, carBehindCarInitials,
                                               carAheadPos, carBehindPos);
                    }
                    
                    //... also pass "relPosition carnumber initials interval"                    
                    addStringDataVarToMap(strDataMap, std::string("CarAheadNumber"), carAheadCarNumber);
                    addStringDataVarToMap(strDataMap, std::string("CarBehindNumber"), carBehindCarNumber);
                    addStringDataVarToMap(strDataMap, std::string("CarAheadInitials"), carAheadCarInitials);
                    addStringDataVarToMap(strDataMap, std::string("CarBehindInitials"), carBehindCarInitials);
                    addDataVarToMap(strDataMap, std::string("CarAheadPos"), carAheadPos, precision);
                    addDataVarToMap(strDataMap, std::string("CarBehindPos"), carBehindPos, precision);
                    addDataVarToMap(strDataMap, std::string("CarAheadInterval"), carAheadInterval, precision);
                    addDataVarToMap(strDataMap, std::string("CarBehindInterval"), carBehindInterval, precision);                    

                    // Save data to shared memory for the Webserver
                    //
                    sharedData.setData(strDataMap);

                    // Tell the webserver to resend the data
                    assert(webServerP != nullptr);
                    webServerP->updateClient();



                    // Handle "callbacks" from webServer using SharedData.
                    // 
                    std::string fuelMessage = sharedData.getFuelMessage();
                    handlePitCommandMessage(fuelMessage);
              


                    // Send data to GlovePIE voice commands script as it changes.
                    //                    
                    //updateGlovePieData(fuelLevel, g_RaceStartOffset, sessionTime);                 


					//
					//
					/////////////////////////////// end process data here
				}
			}//no data being recieved.
		}

		//optional test, in case you need to close out a file...
		else if(!irsdk_isConnected())
		{
			// session ended
			if(data)
				delete[] data;
			data = NULL;
		}
	}

    WSACleanup();

	// call on exit to close memory mapped file
	irsdk_shutdown();    	
}

// Convert to litres from display units
//
const double convertFuelLitresToDisplay(const double fuelValueInLitres)
{
    // Apply conversion factor to get display value.
    //
    double fuelValueDisplay = 
        fuelValueInLitres * g_FuelDisplayConversionFactor;

    return fuelValueDisplay;
}

// Convert to litres from display units
//
const double convertFuelDisplayToLitres(const double fuelValueDisplay)
{
    assert(0 < g_FuelDisplayConversionFactor);

    // Apply conversion factor to convert from display value.
    //
    const double fuelValueInLitres = 
        fuelValueDisplay / g_FuelDisplayConversionFactor;

    return fuelValueInLitres;
}

// Multiply fuel values by this factor to convert to display units.
// Divide by it to get litres back.
//
// If fuel (for car) is in weight:
//   Metric: litres -> kgs
//   Imperial: litres -> kgs -> lbs
//
// If fuel (for car) is in volume:
//   Metric: litres
//   Imperial: gallons
//
void calculateFuelDisplayConversionFactor(
    const bool isDisplayFuelImperial, const bool isDisplayCarFuelWeight,
    double& fuelDisplayConversionFactor, std::string& strFuelDisplayUnits)
{
    if (isDisplayCarFuelWeight)
    {
        fuelDisplayConversionFactor = g_DriverCarFuelKgPerLtr;
        strFuelDisplayUnits = "kg";

        // For imperial weight, need to convert kg to lbs.
        // (x lb per kg)
        //
        if (isDisplayFuelImperial)
        {
            const double poundsPerKg = 2.20462;
            fuelDisplayConversionFactor *= poundsPerKg;
            strFuelDisplayUnits = "lb";
        }
    }
    else
    {
        fuelDisplayConversionFactor = 1.0;
        strFuelDisplayUnits = "ltr";

        // For imperial volume, need to convert litres to gallons.
        //
        if (g_isDisplayFuelImperial)
        {
            const double gallonsPerLitre = 0.264151;
            fuelDisplayConversionFactor *= gallonsPerLitre;
            strFuelDisplayUnits = "gal";
        }
    }
}


void convertSecondsToTimeString(const double inputSeconds, std::string& strTime)
{
    const int inputSecondsInt = (int)inputSeconds;
    double secondsWithDecimal = inputSeconds - inputSecondsInt;

    const int days = inputSecondsInt / 60 / 60 / 24;
    const int hours = (inputSecondsInt / 60 / 60) % 24;
    const int minutes = (inputSecondsInt / 60) % 60;
    const int seconds = inputSecondsInt % 60;

    bool hasHours = false;
    bool hasMinutes = false;

    secondsWithDecimal += seconds;    

    stringstream stream;
    
    // Format: 2 days, 2:07:04.131
    //Days
    //
    if (days == 1)
    {
        stream << "1 day, ";
    }
    else if (days > 1)
    {
        stream << days << " days, ";
    }

    // Hours
    //
    if (hours >= 1)
    {
        stream << hours << ":";
        hasHours = true;
    }

    // Minutes
    //
    if (minutes >= 1 || hasHours)
    {
        if (minutes < 10 && hasHours)
        {
            stream << "0";
        }

        stream << minutes << ":";

        hasMinutes = true;
    }
    
    // Seconds
    //
    if (seconds < 10 && hasMinutes)
    {
        stream << "0";
    }

    stream << secondsWithDecimal;

    strTime = stream.str();
}

/////////////////////////////////////////////////////////
void end_session(bool shutdown)
{
	//close_file(g_file, g_ttime);

	if (data)
	{
		//delete[] data;
		data = NULL;
	}

	if (shutdown)
	{
		irsdk_shutdown();
		timeEndPeriod(1);
	}
}

BOOL WINAPI CloseConsoleHandler( DWORD dwCtrlType )
{
    printf("\nReceived Close event: ");
    switch (dwCtrlType)
    {
        case CTRL_C_EVENT:
            printf("CTRL_C_EVENT\n");
            break;
        case CTRL_BREAK_EVENT:
            printf("CTRL_BREAK_EVENT\n");
            break;
        case CTRL_CLOSE_EVENT:
            printf("CTRL_CLOSE_EVENT\n");
            break;
        case CTRL_LOGOFF_EVENT:
            printf("CTRL_LOGOFF_EVENT\n");
            break;
        case CTRL_SHUTDOWN_EVENT:
            printf("CTRL_SHUTDOWN_EVENT\n");
            break;
        default:
            printf("unknown type\n");
            break;
    }

    // The app is closing so release
    // the mutex.
    ReleaseMutex(g_hOneInstanceMutex);

    // Save the current status of the lap/fuel data
    //
    printf("Saving Lap/Fuel values...\n");    
    g_LapFuelData.ResetSessionData("", "");
    printf(" Saved.\n");
    
    // end the webserver thread
    //assert(webServerP != nullptr);
    if (webServerP != nullptr)
    {
        webServerP->stop();

        delete webServerP;
        webServerP = nullptr;
    }
    
    // end iracing sdk session
    end_session(true);

    // For DisplayIPs.
    WSACleanup();

    printf("Exiting.\n");
    ExitProcess(0);

    // Event Handled? true, exit called.
    return TRUE;
}

void handlePitCommandMessage(std::string& message)
{
    if (!message.empty())
    {
        // Message format: "|Fuel;value|LeftFront|RightFront|LeftRear|RightRear|"
        // Tire values only sent if should be checked. If not there, clear it.
        // 0 Fuel means to uncheck fuel and add none.

        // Possible issue: this value is rounded to the nearest increment, and so it
        //                 can round down in some cases (skip barber) and you don't 
        //                 get the fuel required.
        //                 Caddy, 5L increments, "#fuel 7.4 liter" gives you 5 liters
        //

        int fuelToAddDisplay = 0;

        // Find Fuel value.
        //
        size_t pos = message.find("Fuel");
        if (std::string::npos != pos)
        {
            size_t posVal = message.find(";", pos);
            if (std::string::npos != posVal)
            {
                posVal++;
                if (posVal < message.length())
                {
                    std::string valueStr = message.substr(posVal);
                    stringstream stream(valueStr);
                    stream >> fuelToAddDisplay;
                }
            }
        }

        double dFuelToAdd = convertFuelDisplayToLitres(fuelToAddDisplay);
        // round double value, rather an truncate
        dFuelToAdd += 0.5;        
        int fuelToAddInLitres = (int)dFuelToAdd;

        printf("Pit Command: %s\n", message.c_str());
        
        // Get tires to check.
        //
        bool isCheckedLeftFront = false;
        bool isCheckedRightFront = false;
        bool isCheckedLeftRear = false;
        bool isCheckedRightRear = false;

        pos = message.find("LeftFront");
        if (std::string::npos != pos)
        {
            isCheckedLeftFront = true;
        }
        pos = message.find("RightFront");
        if (std::string::npos != pos)
        {
            isCheckedRightFront = true;
        }
        pos = message.find("LeftRear");
        if (std::string::npos != pos)
        {
            isCheckedLeftRear = true;
        }
        pos = message.find("RightRear");
        if (std::string::npos != pos)
        {
            isCheckedRightRear = true;
        }

        // Fast Repair and Windshield Tearoff options.
        //
        bool isCheckedFastRepair = false;
        bool isCheckedWindshield = false;

        pos = message.find("FastRepair");
        if (std::string::npos != pos)
        {
            isCheckedFastRepair = true;
        }
        pos = message.find("Windshield");
        if (std::string::npos != pos)
        {
            isCheckedWindshield = true;
        }
        
        // Config file has an option to skip this step.
        //
        if (!g_isSkipClearOnApply)
        {
            // This clears Fuel, WS, Tire checkboxes.
            // Doesn't change any toggles.
            //printf("Clear all pit commands\n");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_Clear, 0);
        }

        if (isCheckedWindshield)
        {
            //printf("Clean window\n");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_WS, 0);
        }

        if (isCheckedFastRepair)
        {
            //printf("Enable fast repair\n");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_FR, 0);
        }

        //printf("Fuel: %d L", fuelToAddInLitres);
        if (fuelToAddInLitres > 0)
        {
            // add 10 liters (2.7 gallon), or pass '0' to leave level at previous value
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_Fuel, fuelToAddInLitres);
        }

        if (isCheckedLeftFront)
        {
            //printf(", LF");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_LF, 0); // leave pressure alone
        }
        if (isCheckedRightFront)
        {
            //printf(", RF");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_RF, 0); // leave pressure alone
        }
        if (isCheckedLeftRear)
        {
            //printf(", LR");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_LR, 0); // leave pressure alone
        }
        if (isCheckedRightRear)
        {
            //printf(", RR");
            irsdk_broadcastMsg(irsdk_BroadcastPitCommand, irsdk_PitCommand_RR, 0); // leave pressure alone
        }      

        //printf("\n");
    }
}

/*
void updateGlovePieData(
    float fuelLevel, 
    double raceStartOffset,
    double sessionTime)
{    
    static float sOldFuelLevel = -1.0f;
    static double sOldSessionTime = -1.0;    

    if (fabs(sOldFuelLevel - fuelLevel) > 0.01f)
    {
        sOldFuelLevel = fuelLevel;

        osc::OutboundPacketStream p(osc_buffer, OSC_OUTPUT_BUFFER_SIZE);

        p << osc::BeginBundleImmediate
            << osc::BeginMessage("/fuel")
            << fuelLevel << osc::EndMessage
            << osc::EndBundle;

        transmitSocket.Send(p.Data(), p.Size());

        //printf("Fuel Sent! %0.2f\n", fuel);
    }

    if (fabs(sOldSessionTime - sessionTime) > 1.0)
    {
        sOldSessionTime = sessionTime;

        // Calculate Elapsed Time since race start
        //
        double elapsedTime = 0.0;
        if (raceStartOffset >= 0 &&
            sessionTime >= 0)
        {
            elapsedTime = sessionTime - raceStartOffset;
        }

        osc::OutboundPacketStream p(osc_buffer, OSC_OUTPUT_BUFFER_SIZE);

        p << osc::BeginBundleImmediate
            << osc::BeginMessage("/RaceTime")
            << elapsedTime << osc::EndMessage
            << osc::EndBundle;

        transmitSocket.Send(p.Data(), p.Size());

        //printf("Elapsed Time Sent! %0.2f\n", elapsedTime);
    }
}
*/

/////////// custom, to get name-value pairs to send
//MOVED OUT OF IRSDK_UTILS

// Returns the number of Vars in the Header.
//
int irsdk_getNumVars_local(void)
{
    const irsdk_header *pHeader = irsdk_getHeader();

    if (pHeader != NULL)
    {
        return pHeader->numVars;
    }

    return 0;
}

// Returns the Var Name and Var Data at this index in pData.
// The Header contains an entry for each Var together with an index
// into the pData portion where the Var Data is located (and the type 
// of the data).
// This function takes the index of a Var and a pointer to the pData 
// portion. It gets the Var from the Header for the index, gets the 
// data offset and type, then retrieves the Var Data from pData.
//
bool irsdk_getVarData_local(
    int index,
    char* pData,
    int precision,
    std::string &varName,
    std::string &varData)
{
    if (index >= irsdk_getNumVars_local() ||
        pData == NULL)
    {
        return false;
    }

    // Get the Var at index
    const irsdk_varHeader *pVar = irsdk_getVarHeaderEntry(index);

    // Get the Name
    varName = pVar->name;

    // Get the Offset into pData
    int varOffset = pVar->offset;

    // Get the Value as string
    // If more than 1, comma separate
    //
    std::stringstream stream;

    double roundMultiplier = pow(10.0, precision);
    
    for (int itemNum = 0; itemNum < pVar->count; ++itemNum)
    {
        if (itemNum != 0)
        {
            // add array separator
            stream << ",";
        }

        switch (pVar->type)
        {
            // 1 byte
            case irsdk_char:
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(char), "invalid data size");
                stream << (*((char *)(pData + varOffset)));
                varOffset += sizeof(char);
                break;
            case irsdk_bool:
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(bool), "invalid data size");
                stream << (*((bool *)(pData + varOffset)));
                varOffset += sizeof(bool);
                break;

                // 4 bytes
            case irsdk_int:
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(int), "invalid data size");
                stream << (*((int *)(pData + varOffset)));
                varOffset += sizeof(int);
                break;
                // set int to string, can cast back to int to check bits
            case irsdk_bitField:
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(int), "invalid data size");
                stream << std::fixed << (*((int *)(pData + varOffset)));
                varOffset += sizeof(int);
                break;
            case irsdk_float:
            {
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(float), "invalid data size");
                //stream << (*((float *)(pData + varOffset)));

                float fValue = (*((float *)(pData + varOffset)));

                // round to precision
                if (roundMultiplier > 0)
                {
                    fValue *= (float)roundMultiplier;
                    fValue =  (float)round(fValue);
                    fValue /= (float)roundMultiplier;
                }
                
                stream << fValue;

                varOffset += sizeof(float);
                break;
            }

                // 8 bytes
            case irsdk_double:
            {
                _ASSERT_EXPR(irsdk_VarTypeBytes[pVar->type] == sizeof(double), "invalid data size");
                //stream << (*((double *)(pData + varOffset)));

                double dblValue = (*((double *)(pData + varOffset)));

                // round to precision
                if (roundMultiplier > 0)
                {
                    dblValue *= roundMultiplier;
                    dblValue = round(dblValue);
                    dblValue /= roundMultiplier;
                }

                stream << dblValue;

                varOffset += sizeof(double);

                break;
            }

            default:
                _ASSERT_EXPR(false, "irsdk_getVar: unknown var type");
                break;
        }
    }

    // Get the Value
    varData = stream.str();

    return true;
}
///////////////////

template<typename T>
bool readDataVarFromMap(
    std::map<std::string, std::string>& strDataMap,
    std::string varName,
    T& varData)
{
    bool success = false;
    std::map<std::string, std::string>::iterator iter;

    iter = strDataMap.find(varName);
    if (iter != strDataMap.end())
    {
        success = true;

        std::stringstream stream(iter->second);
        stream >> varData;
    }

    return success;
}

template<typename T>
void addDataVarToMap(
    std::map<std::string, std::string>& strDataMap,
    std::string& varName,
    T varData,
    int precision )
{
    // truncate all data to specified number of decimal places 
    double roundMultiplier = pow(10.0, precision);    
    double dblValue = (double)varData;

    // round to precision
    if (roundMultiplier > 0)
    {
        dblValue *= roundMultiplier;
        dblValue =  round(dblValue);
        dblValue /= roundMultiplier;
    }

    // add to map as string
    std::stringstream stream;
    stream << dblValue;

    strDataMap.insert(
        std::pair<std::string, std::string>(
        varName, stream.str()));
}

void addStringDataVarToMap(std::map<std::string, std::string>& strDataMap, std::string& varName, std::string& varDataStr)
{
    strDataMap.insert(
        std::pair<std::string, std::string>(
        varName, varDataStr));
}

void getDataFromSessionInfo(
    std::map<std::string, std::string>& strDataMap, 
    int sessionNum,
    float estLapTime,
    float& carAheadIntervalSec,
    float& carBehindIntervalSec,
    std::string& carAheadCarNumber,
    std::string& carBehindCarNumber,
    std::string& carAheadInitials,
    std::string& carBehindInitials,    
    int& carAheadPos, 
    int& carBehindPos)
{
    const char *valstr;
    int valstrlen;
    char str[512];
    
    int myCarIdx = -1;

    // get the playerCarIdx
    if (parseYaml(irsdk_getSessionInfoStr(), "DriverInfo:DriverCarIdx:", &valstr, &valstrlen))
    {
        myCarIdx = atoi(valstr);
    }

    if (myCarIdx < 0)
    {
        return;
    }

    std::string myName;
    std::string myCarClass;

    //////////////////////////////////
    // get my name
    sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}UserName:", myCarIdx);
    if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
    {
        //strncpy_s(g_buffer, 512, valstr, valstrlen);
        //nameStr[valstrlen] = '\0'; //driversname

        myName = std::string(valstr, valstrlen);
    }

    // get my class
    sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarClassShortName:", myCarIdx);
    if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
    {
        //strncpy_s(g_buffer, 512, valstr, valstrlen);
        //nameStr[valstrlen] = '\0'; //driversname

        myCarClass = std::string(valstr, valstrlen);
    }

    // Get my position
    // - Go through each position looking for my carIdx
    // - Get my ClassPosition
    // - Do +/- on ClassPosition,
    // - get carIdx of next/prev positions (ClassPosition)
    // - CarIdx to get values from data for Lap (in sessioninfo too?), dist around lap

    bool isMyPositionFound = false;
    int myPosition = 0;
    std::map<int, int> classPosToCarIdxMap;

    // Create a map of ClassPosition -> CarIdx containing all positions
    int position = 1;
    sprintf_s(str, 512, "SessionInfo:Sessions:SessionNum:{%d}ResultsPositions:Position:{%d}CarIdx:", sessionNum, position);

    // While still finding carIdx values at position,
    // map ClassPos to carIdx.
    //
    while (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
    {
        int thisCarIdx = atoi(valstr);

        std::string driverCarClass;
        
        // get driver's class
        sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarClassShortName:", thisCarIdx);
        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
        {
            //strncpy_s(g_buffer, 512, valstr, valstrlen);
            //nameStr[valstrlen] = '\0'; //driversname

            driverCarClass = std::string(valstr, valstrlen);
        }

        // Only add cars of the same class
        //
        if (driverCarClass == myCarClass)
        {
            //debug
            std::string driverName;
            // get driver's class
            sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}UserName:", thisCarIdx);
            if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
            {
                driverName = std::string(valstr, valstrlen);
            }

            //sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}UserName:", myCarIdx);
            //sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}Initials:", myCarIdx);
            //sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarNumberRaw:", myCarIdx); // Raw means no ""
            //sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarPath:", myCarIdx); // car, not class
            //sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarClassShortName:", myCarIdx); // car, not class

            // Get ClassPosition
            sprintf_s(str, 512, "SessionInfo:Sessions:SessionNum:{%d}ResultsPositions:Position:{%d}ClassPosition:", sessionNum, position);
            if (false == parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
            {
                // If a ClassPosition is not found for some reason (while a CarIdx is),
                // just stop.
                break;
            }
            
            int classPosition = atoi(valstr);

            // Add to map
            classPosToCarIdxMap.insert(std::pair<int, int>(classPosition, thisCarIdx));

            // While we are here, get my classPosition based on carIdx
            //
            if (!isMyPositionFound &&
                thisCarIdx == myCarIdx)
            {
                myPosition = classPosition;
                isMyPositionFound = true;
            }
        }

        // increment to the next position
        ++position;
        sprintf_s(str, 512, "SessionInfo:Sessions:SessionNum:{%d}ResultsPositions:Position:{%d}CarIdx:", sessionNum, position);
    }

    //debug
    //static bool s_isMyPositionFound = false;
    //static int s_myPosition = -1;
    //if (s_isMyPositionFound != isMyPositionFound ||
    //    s_myPosition != myPosition)
    //{
    //    s_isMyPositionFound = isMyPositionFound;
    //    s_myPosition = myPosition;

    //    //fprintf(stderr, "  myPosition: %d, %d\n", s_isMyPositionFound, s_myPosition);
    //}
        

    // Use my position to get the carIdx of the next and prev position cars.
    //
    int nextCarIdx = 0;
    int prevCarIdx = 0;
    bool nextCarIdxFound = false;
    bool prevCarIdxFound = false;

    if (isMyPositionFound)
    {
        std::map<int, int>::iterator iter;

        int nextPosition = myPosition - 1;
        int prevPosition = myPosition + 1;

        // find idx based on class position
        if (nextPosition >= 0)
        {
            iter = classPosToCarIdxMap.find(nextPosition);
            if (iter != classPosToCarIdxMap.end())
            {
                nextCarIdx = iter->second;
                nextCarIdxFound = true;

                // Save the position for output (add 1, 0 based)
                carAheadPos = nextPosition + 1; 
            }
        }

        if (prevPosition >= 0)
        {
            iter = classPosToCarIdxMap.find(prevPosition);
            if (iter != classPosToCarIdxMap.end())
            {
                prevCarIdx = iter->second;
                prevCarIdxFound = true;

                // Save the position for output (add 1, 0 based)
                carBehindPos = prevPosition + 1;
            }
        }
    }

    // Get ahead and behind car numbers
    // next = ahead
    //
    if (prevCarIdxFound)
    {
        sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarNumber:", prevCarIdx);
        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
        {
            //carBehindCarNumber = atoi(valstr);
            carBehindCarNumber = std::string(valstr, valstrlen);

            // strip off the quotes
            //
            size_t startpos = carBehindCarNumber.find_first_not_of(" \"");
            if (string::npos != startpos)
            {
                carBehindCarNumber = carBehindCarNumber.substr(startpos);
            }
            size_t endpos = carBehindCarNumber.find_last_not_of(" \"");
            if (string::npos != endpos)
            {
                carBehindCarNumber = carBehindCarNumber.substr(0, endpos + 1);
            }
        }

        sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}Initials:", prevCarIdx);
        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
        {
            carBehindInitials = std::string(valstr, valstrlen);
        }
    }

    if (nextCarIdxFound)
    {
        sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}CarNumber:", nextCarIdx);
        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
        {
            //carAheadCarNumber = atoi(valstr);
            carAheadCarNumber = std::string(valstr, valstrlen);

            // strip off the quotes
            //
            size_t startpos = carAheadCarNumber.find_first_not_of(" \"");
            if (string::npos != startpos)
            {
                carAheadCarNumber = carAheadCarNumber.substr(startpos);
            }
            size_t endpos = carAheadCarNumber.find_last_not_of(" \"");
            if (string::npos != endpos)
            {
                carAheadCarNumber = carAheadCarNumber.substr(0, endpos + 1);
            }
        }

        sprintf_s(str, 512, "DriverInfo:Drivers:CarIdx:{%d}Initials:", nextCarIdx);
        if (parseYaml(irsdk_getSessionInfoStr(), str, &valstr, &valstrlen))
        {
            carAheadInitials = std::string(valstr, valstrlen);
        }
    }


    //debug
    //static bool s_nextCarIdxFound = false;
    //static int s_nextCarIdx = 0;
    //if (s_nextCarIdxFound != nextCarIdxFound ||
    //    s_nextCarIdx != nextCarIdx)
    //{
    //    s_nextCarIdxFound = nextCarIdxFound;
    //    s_nextCarIdx = nextCarIdx;

    //    //fprintf(stderr, "  nextCarIdx: %d, %d\n", s_nextCarIdxFound, s_nextCarIdx);
    //}
    //static bool s_prevCarIdxFound = false;
    //static int s_prevCarIdx = 0;
    //if (s_prevCarIdxFound != prevCarIdxFound ||
    //    s_prevCarIdx != prevCarIdx)
    //{
    //    s_prevCarIdxFound = prevCarIdxFound;
    //    s_prevCarIdx = prevCarIdx;

    //    //fprintf(stderr, "  prevCarIdx: %d, %d\n", s_prevCarIdxFound, s_prevCarIdx);
    //}

    // Calculate intervals (carIdx is 1 based)        
    // will need estLapTime to make this calculation..., pass it in, call function later

    bool isReadSuccess = false;

    // First get my lap.percent value        
    int myLap = 0;
    isReadSuccess = readDataVarFromMap(strDataMap, "Lap", myLap);
    assert(isReadSuccess);

    float myDistAroundLap = 0.0f;
    isReadSuccess = readDataVarFromMap(strDataMap, "LapDistPct", myDistAroundLap);
    assert(isReadSuccess);

    float myTotalDistLaps = (float)myLap + myDistAroundLap;

    // Get Next and Prev lap.percent values
        
    std::string carIdxLap;
    isReadSuccess = readDataVarFromMap(strDataMap, "CarIdxLap", carIdxLap);
    assert(isReadSuccess);

    std::string carIdxLapDistPct;
    isReadSuccess = readDataVarFromMap(strDataMap, "CarIdxLapDistPct", carIdxLapDistPct);
    assert(isReadSuccess);


    // debug
    //static float s_myTotalDistLaps = 0.0;
    //if (s_myTotalDistLaps + 0.2 < myTotalDistLaps ||
    //    s_myTotalDistLaps - 0.2 > myTotalDistLaps)
    //{
    //    s_myTotalDistLaps = myTotalDistLaps;

    //    fprintf(stderr, "  myIdx/ Pos: %d, %d (%d)\n", s_isMyPositionFound, myCarIdx, s_myPosition);
    //    fprintf(stderr, "  nextCarIdx: %d, %d\n", s_nextCarIdxFound, s_nextCarIdx);
    //    fprintf(stderr, "  prevCarIdx: %d, %d\n", s_prevCarIdxFound, s_prevCarIdx);
    //    fprintf(stderr, "  s_myTotalDistLaps: %f\n", s_myTotalDistLaps);
    //    fprintf(stderr, "  carIdxLap: %s\n", carIdxLap.c_str());
    //    fprintf(stderr, "  carIdxLapDistPct: %s\n\n", carIdxLapDistPct.c_str());
    //}



    int nextCarLap = 0;
    bool nextCarLapFound = false;
    int prevCarLap = 0;
    bool prevCarLapFound = false;

    if (nextCarIdxFound)
    {
        int lapValue = 0;
        stringstream stream(carIdxLap);

        char delim = ',';
        std::string item;

        // CarIdx is a 0 based index
        int count = 0;

        while (std::getline(stream, item, delim))
        {
            /*elems.push_back(item);*/

            if (nextCarIdx == count)
            {
                stream.clear();
                stream.str(item);
                stream >> nextCarLap;

                // ignore -1 values
                if (nextCarLap >= 0)
                {
                    nextCarLapFound = true;
                }
                break;
            }

            ++count;
        }
    }

    if (prevCarIdxFound)
    {
        int lapValue = 0;
        stringstream stream(carIdxLap);

        char delim = ',';
        std::string item;

        // CarIdx is a 0 based index
        int count = 0;

        while (std::getline(stream, item, delim))
        {
            /*elems.push_back(item);*/

            if (prevCarIdx == count)
            {
                stream.clear();
                stream.str(item);
                stream >> prevCarLap;

                // ignore -1 values
                if (prevCarLap >= 0)
                {
                    prevCarLapFound = true;
                }
                break;
            }

            ++count;
        }
    }



    // Get lap %
    float nextCarLapPct = 0;
    bool nextCarLapPctFound = false;
    float prevCarLapPct = 0;
    bool prevCarLapPctFound = false;

    if (nextCarIdxFound)
    {
        int lapValue = 0;
        stringstream stream(carIdxLapDistPct);

        char delim = ',';
        std::string item;

        // CarIdx is a 0 based index
        int count = 0;

        while (std::getline(stream, item, delim))
        {
            /*elems.push_back(item);*/

            if (nextCarIdx == count)
            {
                stream.clear();
                stream.str(item);
                stream >> nextCarLapPct;
                    
                // ignore -1 values
                if (nextCarLapPct >= 0)
                {
                    nextCarLapPctFound = true;
                }
                break;
            }

            ++count;
        }
    }

    if (prevCarIdxFound)
    {
        int lapValue = 0;
        stringstream stream(carIdxLapDistPct);

        char delim = ',';
        std::string item;

        // CarIdx is a 0 based index
        int count = 0;

        while (std::getline(stream, item, delim))
        {
            /*elems.push_back(item);*/

            if (prevCarIdx == count)
            {
                stream.clear();
                stream.str(item);
                stream >> prevCarLapPct;

                // ignore -1 values
                if (prevCarLapPct >= 0)
                {
                    prevCarLapPctFound = true;
                }
                break;
            }

            ++count;
        }
    }




    // Calculate estimated seconds to next (ahead) and prev (behind) cars.
    //
    //myTotalDistLaps = 3;
    //nextCarLapFound = nextCarLapPctFound = true;
    //prevCarLapFound = prevCarLapPctFound = true;
    //nextCarLap = 4;
    //nextCarLapPct = 0.75;
    //prevCarLap = 2;
    //prevCarLapPct = 0.50;


    if (nextCarLapFound && nextCarLapPctFound)
    {
        float nextTotalDistLaps = (float)nextCarLap + nextCarLapPct;

        if (myTotalDistLaps <= nextTotalDistLaps)
        {
            float delta = nextTotalDistLaps - myTotalDistLaps;

            carAheadIntervalSec = delta * estLapTime;
        }
    }

    if (prevCarLapFound && prevCarLapPctFound)
    {
        float prevTotalDistLaps = (float)prevCarLap + prevCarLapPct;

        if (myTotalDistLaps >= prevTotalDistLaps)
        {
            float delta = myTotalDistLaps - prevTotalDistLaps;

            carBehindIntervalSec = delta * estLapTime;
        }
    }
}



// Code from the Internet. Seems to work.
// Displays connection options. Type IP into browser to connect.
// (Found that in Safari can also type host name)
//
int displayIPs(int serverPort)
{
    //WSAData wsaData;
    //if (WSAStartup(MAKEWORD(1, 1), &wsaData) != 0) {
    //    return 255;
    //}
    
    char ac[80];
    if (gethostname(ac, sizeof(ac)) == SOCKET_ERROR) {
        cerr << "Error " << WSAGetLastError() <<
            " when getting local host name." << endl;
        return 1;
    }
    cout << "Host name is \"" << ac << "\"." << endl;

    struct hostent *phe = gethostbyname(ac);
    if (phe == 0) {
        cerr << "Yow! Bad host lookup." << endl;
        return 1;
    }

    for (int i = 0; phe->h_addr_list[i] != 0; ++i) {
        struct in_addr addr;
        memcpy(&addr, phe->h_addr_list[i], sizeof(struct in_addr));

        if (serverPort == 80)
        {
            cout << "Address " << i << ": " << inet_ntoa(addr) << endl;
        }
        else
        {
            cout << "Address " << i << ": " << inet_ntoa(addr) << ":" << serverPort << endl;
        }
    }

    cout << endl;
    cout << "* Type Address above into web browser on client device to start remote display." << endl
        << "* For full screen on a phone, select \"Add to Home Screen\" in browser then" << endl
        << "* launch using the new icon on home screen." << endl << endl;


    // NON DEPRECATED METHOD

    //struct addrinfo *res, *p;    
    //struct addrinfo hints;
    //memset(&hints, 0, sizeof hints);
    //hints.ai_family = AF_UNSPEC; // AF_INET or AF_INET6 to force version
    //hints.ai_socktype = SOCK_STREAM;
    //struct addrinfo *servinfo;  // will point to the results
    //int status = getaddrinfo(name, NULL, &hints, &servinfo);

    //if (status != 0)
    //{
    //    fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(status));
    //}

    //for (p = res; p != NULL; p = p->ai_next) {
    //    void *addr;
    //    char *ipver;

    //    // get the pointer to the address itself,
    //    // different fields in IPv4 and IPv6:
    //    if (p->ai_family == AF_INET) { // IPv4
    //        struct sockaddr_in *ipv4 = (struct sockaddr_in *)p->ai_addr;
    //        addr = &(ipv4->sin_addr);
    //        ipver = "IPv4";
    //    }
    //    else { // IPv6
    //        struct sockaddr_in6 *ipv6 = (struct sockaddr_in6 *)p->ai_addr;
    //        addr = &(ipv6->sin6_addr);
    //        ipver = "IPv6";
    //    }

    //    // convert the IP to a string and print it:
    //    inet_ntop(p->ai_family, addr, ipstr, sizeof ipstr);
    //    printf("  %s: %s\n", ipver, ipstr);
    //}

    //freeaddrinfo(servinfo);


    //WSACleanup();

    return 0;
}
