#include "stdafx.h"
#include "WebServerLWS.h"

#include <algorithm>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string.h>
#include <thread>

#include <assert.h>
#include <direct.h>
//#include <winsock2.h>

//#ifdef __cplusplus
//extern "C" {
//#endif

//#include <windows.h>


//#ifdef __cplusplus
//}
//#endif

#ifdef CMAKE_BUILD
#include "lws_config.h"
#endif

#include <stdio.h>
#include <stdlib.h>
//#include <getopt.h>
#include <signal.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <assert.h>

#ifdef _WIN32
#include <io.h>
#ifdef EXTERNAL_POLL
#define poll WSAPoll
#endif
#else
#include <syslog.h>
#include <sys/time.h>
#include <unistd.h>
#endif

#include "libwebsockets.h"


using namespace std;

static std::thread m_webServerThread;

static int callback_http(struct libwebsocket_context *context,
	struct libwebsocket *wsi,
	enum libwebsocket_callback_reasons reason, void *user,
		void *in, size_t len);


static bool s_connectionReset = true; //assumes 1 connection only
std::map<std::string, std::string> s_lastSentDataStrMap;

static int callback_iracing_data(struct libwebsocket_context *context,
	struct libwebsocket *wsi,
	enum libwebsocket_callback_reasons reason,
		void *user, void *in, size_t len);

static void writeToSocket(struct libwebsocket *wsi, std::string strOutput);

static bool invalidChar(char c);
static void stripUnicode(std::string& str);


// pass a pointer to shared data and a mutex (not needed for webserver, do for websocketserver)(same server?)

WebServerLWS::WebServerLWS(const int listenPort)
{
	m_listenPort = listenPort;
    this->setIsThreadRunning(false);
	m_sharedDataP = NULL;

	// session variables
    m_resetConnection = false;
    m_updateClient = false;
}

WebServerLWS::~WebServerLWS()
{
	this->stop();
}

void WebServerLWS::updateClient(void)
{
    // should really be made thread safe, but is not critical...
    m_updateClient = true;
}

void WebServerLWS::resetConnection(void)
{
    // should really be made thread safe, but is not critical...
    m_resetConnection = true;
}

void WebServerLWS::start(SharedData *sharedData)
{
    this->setIsThreadRunning(true);

	// Keep a pointer to the thread safe shared data
	assert(sharedData != NULL);
	m_sharedDataP = sharedData;

	// reset session variables
    m_resetConnection = false;
    m_updateClient = false;
    
	// start thread for object instance function
	m_webServerThread = std::thread(&WebServerLWS::runThread, std::ref(*this));

    // not required, added getIsThreadRunning() to kill the thread.
	//m_webServerThread.detach();  // otherwise errors on close due to thread being alive after the main program?
}

// doesn't work, blocks on accept
void WebServerLWS::stop(void)
{
    // Stop the thread, then wait for it to finish.
    //
	this->setIsThreadRunning(false);

	//// Wait for thread to finish current operation and exit
	////Sleep(500);

	//// If didn't finish, close the socket to unblock accept() call.
	//// Could also use setsockopt linger options...
	//struct linger a;
	//a.l_onoff = 1;
	//a.l_linger = 1; // linger for a second before closing the socket
	//setsockopt(listenSocket, SOL_SOCKET, SO_LINGER, (const char*)&a, sizeof(a));

	//closesocket(listenSocket);

	if (m_webServerThread.joinable())
	{
		// Wait for thread to end
		m_webServerThread.join();
	}
}

bool WebServerLWS::getIsThreadRunning(void)
{
    bool isRunning = false;
    
    m_isThreadRunningMutex.lock();
    {
        isRunning = m_isRunning;
    }
    m_isThreadRunningMutex.unlock();

    return isRunning;
}

void WebServerLWS::setIsThreadRunning(const bool isRunning)
{
    m_isThreadRunningMutex.lock();
    {
        m_isRunning = isRunning;
    }
    m_isThreadRunningMutex.unlock();
}


enum protocols_index {
    /* always first */
    PROTOCOL_HTTP = 0,

    PROTOCOL_IRACING_DATA,

    /* always last */
    DEMO_PROTOCOL_COUNT
};
// list of supported protocols and callbacks
static struct libwebsocket_protocols protocols[] = {
    // first protocol must always be HTTP handler
    {
        "http-only",        // name
        callback_http,      // callback
        0                   // per_session_data_size, allocated internally shared between calls to callback
    },
    {
        "iracing-data-protocol", // protocol name - very important!
        callback_iracing_data,     // callback
        0

    },
    {
        NULL, NULL, 0       // end of list
    }
};


void WebServerLWS::runThread(void)
{	
	// server url will be http://localhost:port

	int port = m_listenPort;
	const char *interface = NULL;
	struct libwebsocket_context *context;
	   

	struct lws_context_creation_info info;
	memset(&info, 0, sizeof info);
	info.port = m_listenPort;
	info.iface = NULL; // must be null
	
	info.protocols = protocols;

	// we're not using ssl
	info.ssl_cert_filepath = NULL;
	info.ssl_private_key_filepath = NULL;
	info.gid = -1;
	info.uid = -1;
	// no special options
	info.options = 0;

	// can get this in static callback 
    info.user = m_sharedDataP;
    //info.user = this;

	//info.extensions = libwebsocket_get_internal_extensions();

	// create libwebsocket context representing this server
	context = libwebsocket_create_context(&info);	

	if (context == NULL) {
		fprintf(stderr, "libwebsocket init failed\n");
		return;
	}

	printf("starting server...\n");
	

   // lws_set_log_level(ERR|WARN|NOTICE|INFO);

	// infinite loop, to end this server send SIGTERM. (CTRL+C)
	//while (1) {
    while (this->getIsThreadRunning())
    {
        libwebsocket_service(context, 50);
        // libwebsocket_service will process all waiting events with their
        // callback functions and then wait 50 ms.
        // (this is a single threaded webserver and this will keep our server
        // from generating load while there are not requests to process)

        /*
        * This invokes the LWS_CALLBACK_SERVER_WRITEABLE for every
        * live websocket connection using the DUMB_INCREMENT protocol,
        * as soon as it can take more packets (usually immediately)
        */

        if (m_updateClient)
        {
            m_updateClient = false;

            // set connection status to the static variable for the callback
            // to resend all data
            if (m_resetConnection)
            {
                s_connectionReset = true; // will be set to false when data sent in callback
                m_resetConnection = false;
            }

        	libwebsocket_callback_on_writable_all_protocol(
                &protocols[PROTOCOL_IRACING_DATA]);
        }

        // MULTIPLE CLIENTS (state data, if not sending everything)
        //... to handle multiple connections, can store last_sent type data in the user allocation
        //    see test server for example using individual counts, dumb_increment
        //    (needs internal allocation of full data size (is variable), or use an index in 
        //     the shared data, but need to make sure they go away on close...
        //
        // add a breakpoint and check what is sent when closing client.
	}

	libwebsocket_context_destroy(context);
	
	cout << " Exiting Webserver..." << endl;
}

// Used to call the class member function from a static callback
//
static int /*WebServerLWS::*/callback_http(
    struct libwebsocket_context *context,
    struct libwebsocket *wsi,
    enum libwebsocket_callback_reasons reason, void *user,
	void *in, size_t len)
{
    std::string strBaseDirectory = "./Client";
    std::string strIndexFileName("irPitCrew.html");
	
	switch (reason) 
	{
		// http://git.warmcat.com/cgi-bin/cgit/libwebsockets/tree/lib/libwebsockets.h#n260
		case LWS_CALLBACK_CLIENT_WRITEABLE:

			printf("websocket connection established\n");

			break;

		// http://git.warmcat.com/cgi-bin/cgit/libwebsockets/tree/lib/libwebsockets.h#n281
		case LWS_CALLBACK_HTTP:
		{
			char *requested_uri = (char *)in;
			std::string strFileName(requested_uri);

			//printf("requested URI: %s\n", strFileName.c_str());

			if (strFileName.compare("/") == 0)
			{
				//char *universal_response = "Hello, World!";
				std::string universal_response = strBaseDirectory + strFileName + strIndexFileName;
				
				char* other_headers = NULL;
				char* mime = "text/html";

                // >0 done
                // 0, more to send
                // -1 error  (only close socket here?) orig impl says close socket unless more to send, is not an error
                int retVal = libwebsockets_serve_http_file(context, wsi, universal_response.c_str(),
                    mime, other_headers);
                if (retVal)
				{
                    if (retVal < 0)
                    {
                        fprintf(stderr, "Error sending file:\n%s\n", universal_response.c_str());
                    }

					return -1; // through completion or error, close the socket 
				}
	
				break;

			}
			else 
			{
				if (strFileName.length() > 0)
				{
					if (strFileName.find("..") != string::npos)
					{
						strFileName = "";
					}
				}

				if (strFileName.length() < 0)
				{
					return -1;
				}
				
				std::string strResponse = strBaseDirectory + strFileName;
				//printf("resource path: %s\n", strResponse.c_str());
                				
				int pos = strResponse.rfind(".");
				std::string strExt;
				if (pos != std::string::npos)
				{
					strExt = strResponse.substr(pos, strResponse.length() - pos);
				}
				
				char *mime;
				// choose mime type based on the file extension
				if (strExt.empty()) {
					mime = "text/plain";
				}
				else if (strExt.compare(".png") == 0) {
					mime = "image/png";
				}
				else if (strExt.compare(".jpg") == 0) {
					mime = "image/jpg";
				}
				else if (strExt.compare(".gif") == 0) {
					mime = "image/gif";
				}
				else if (strExt.compare(".html") == 0) {
					mime = "text/html";
				}
				else if (strExt.compare(".css") == 0) {
					mime = "text/css";
				}
                else if (strExt.compare(".js") == 0) {
                    mime = "text/javascript";
                }
				else {
					mime = "text/plain";
				}

				// by default non existing resources return code 400
				// for more information how this function handles headers
				// see it's source code
				// http://git.warmcat.com/cgi-bin/cgit/libwebsockets/tree/lib/parsers.c#n1896
				//libwebsockets_serve_http_file(wsi, resource_path, mime);

				char* other_headers = NULL;

				if (libwebsockets_serve_http_file(context, wsi, strResponse.c_str(),
					mime, other_headers))
				{
					return -1; // through completion or error, close the socket 
				}
			}

			// close connection
			//libwebsocket_close_and_free_session(context, wsi,
			//	LWS_CLOSE_STATUS_NORMAL);

		
		}
		break;
	
	case LWS_CALLBACK_GET_THREAD_ID:
		//do nothing
        //m_webServerThread.get_id();
		break;

	default:
		//printf("unhandled callback: %d\n", reason);
		break;
	}
	
	return 0;
}


static int callback_iracing_data(
	struct libwebsocket_context *context,
	struct libwebsocket *wsi,
	enum libwebsocket_callback_reasons reason,
	void *user, void *in, size_t len)
{	
	char* dataP = NULL;
	char* buffer = NULL;
	int   bufferLen = 0;

    SharedData* sharedDataP = NULL;

	string strInput;
	string strOutput;
    
	switch (reason)
	{
		case LWS_CALLBACK_ESTABLISHED: // just log message that someone is connecting
			printf("client connected.\n");
			s_connectionReset = true;
			break;

		case LWS_CALLBACK_RECEIVE:

			if (in == NULL || len == 0)
			{
				break;
			}			
            
            sharedDataP = (SharedData*)libwebsocket_context_user(context);
            if (sharedDataP == NULL)
            {
                break;
            }

			strInput = (char*)in;

            //printf("Received data: %s\n", strInput.c_str());
            
            // Receive Heartbeat, send it back.
            // If Client doesn't get the heartbeat back, refresh the webpage.
            //
            if (strInput == "heartbeat")
            {
                // respond to heartbeat
                //
                //printf("heartbeat response\n");
                writeToSocket(wsi, strInput);
            }
            else
            {
                // Set fuel update message from client shared data.
                // Will be read and handled by irPlugin loop.
                //
                sharedDataP->setFuelMessage(strInput);
            }
			
			break;

        case LWS_CALLBACK_SERVER_WRITEABLE:
        {
            sharedDataP = (SharedData*)libwebsocket_context_user(context);
            if (sharedDataP == NULL)
            {
                break;
            }
            
            //strOutput = sharedDataP->getSessionInfo();
            //strOutput += "\n";
            //strOutput += sharedDataP->getData();
            //s_connectionReset = false;
            
            std::map<std::string, std::string> dataStrMap = sharedDataP->getData();

            strOutput = "";

            // If reset (by client, or irsdk), send all data
            // (SessionInfo only set here)
            //
            if (s_connectionReset)
            {
                // Add SessionInfo
                strOutput.append(sharedDataP->getSessionInfo());
                strOutput.append("\n");

                // Clear the last sent map
                //
                s_lastSentDataStrMap.clear();
            }

            // Tag to split between Session Info and Data portion.
            // (This will be output even when session info is not)
            //
            strOutput.append("***D.A.T.A***\n");
            
            // Construct Data string. Start with "\n" so the first value has one.
            // Get each data field and value
            //   Separate vars by '\n'
            //   Separate fields by ';'  
            //   Arrays of values are comma separated
            //   eg. "\nName;Value\nName;Value1,Value2\nName;Value\n"
            //
            //
            strOutput += "\n";

            std::map<std::string, std::string>::iterator it;
            std::map<std::string, std::string>::iterator itFound;
                
            for (it = dataStrMap.begin(); it != dataStrMap.end(); ++it)
            {
                std::string varName = it->first;
                std::string varData = it->second;

                // Decide whether to send this data.
                //
                bool isSendValue = true;

                // If the last sent data exists, and this Name exists,
                // and the Data has not changed, then don't send this value.
                //
                if (!s_lastSentDataStrMap.empty())
                {
                    itFound = s_lastSentDataStrMap.find(varName);                    

                    if (itFound != s_lastSentDataStrMap.end())
                    {
                        if (itFound->second.compare(varData) == 0)
                        {
                            isSendValue = false;
                        }
                    }
                }

                // If sending, add the value.
                //
                if (isSendValue)
                {
                    strOutput.append(varName);
                    strOutput.append(";");
                    strOutput.append(varData);

                    // put separator after each value, even the last
                    strOutput.append("\n");
                }

                //if (varName == "FuelLevel" && isSendValue)
                //{
                //    printf("-- Sending fuel level, len: %s\n", varData.c_str());
                //}
            }
        
            // strip any unicode characters before sending over socket
            //
            stripUnicode(strOutput);

            // Store last sent data
            //
            s_lastSentDataStrMap = dataStrMap;
            s_connectionReset = false;

            //printf("writing data, len: %d\n", strOutput.length());

            writeToSocket(wsi, strOutput);

            break;
        }

		default:
			break;
	}

	return 0;
}


static void writeToSocket(struct libwebsocket *wsi, std::string strOutput)
{
    if (strOutput.length() > 0)
    {
        // Allocate buffer for entire message
        int bufferLen = LWS_SEND_BUFFER_PRE_PADDING + strOutput.length() + LWS_SEND_BUFFER_POST_PADDING;
        char* buffer = (char*)malloc(bufferLen*sizeof(*buffer));
        memset(buffer, 0, bufferLen*sizeof(*buffer));

        // Get a pointer to the data portion of the buffer
        char* dataP = &(buffer[LWS_SEND_BUFFER_PRE_PADDING]);

        // Copy output to data portion
        memcpy(dataP, strOutput.c_str(), strOutput.length()*sizeof(*dataP));

        // Write to websocket
        libwebsocket_write(
            wsi,
            (unsigned char*)dataP,
            strOutput.length(),
            LWS_WRITE_TEXT);

        free(buffer);
    }
}

static bool invalidChar(char c)
{
    return !(c >= 0 && c <128);
}

static void stripUnicode(std::string& str)
{
    str.erase(remove_if(str.begin(), str.end(), invalidChar), str.end());
}
