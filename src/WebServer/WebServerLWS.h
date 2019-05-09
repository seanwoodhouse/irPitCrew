#pragma once
#ifndef _WebServerLWS_H
#define _WebServerLWS_H

#include "SharedData.h"

class WebServerLWS
{
public:

    static void setDataDirectory(const std::string& strDataDir);
    static std::string& getDataDirectory(void);

	WebServerLWS(const int listenPort);
	~WebServerLWS();

	void start(SharedData *sharedData);
	void stop(void);

    // set to trigger a client update
    void updateClient(void);
    void resetConnection(void);

    //int callback_dumb_increment(
    //    struct libwebsocket_context *context,
    //    struct libwebsocket *wsi,
    //    enum libwebsocket_callback_reasons reason,
    //    void *user, 
    //    void *in, 
    //    size_t len);

    //int callback_http(
    //    struct libwebsocket_context *context,
    //    struct libwebsocket *wsi,
    //    enum libwebsocket_callback_reasons reason, void *user,
    //        void *in, size_t len);

private:

    WebServerLWS();

	void runThread(void);

    // Set isThreadRunning to false to stop the thread.
    //
    bool getIsThreadRunning(void);
    void setIsThreadRunning(const bool isRunning);

	// must be static
	// so, can only access static data
	// data in pointer will not be static

	// could set it to a static pointer internally?
	// callback accesses static pointer to non static data?

	// pass data to callback registration?
	// 
    
    //static std::string s_strDataDirectory;

	int m_listenPort;
    
	SharedData *m_sharedDataP;

	// assume only a single connection
	bool m_resetConnection;
        
    bool m_updateClient;
    
    std::mutex m_isThreadRunningMutex;
    bool m_isRunning;

};

#endif
