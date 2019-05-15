# irPitCrew
Pitstop management app for iRacing.

Web Application Demo: [irPitCrew Demo](http://irpitcrewbucket.s3-website-us-west-2.amazonaws.com/irPitCrew.html)

The demo runs the Web Application portion of the software (in the irPitCrew_install/Client/ directory), with a few modifications to simulate an ongoing race. Click the link from a web browser on your PC, phone, tablet, or other device to try out the Web Application.

## Caveats (work in progress)

 * The Web Application currently has some issues with phone orientation and resizing. It only resizes on refresh, so turn the phone sideways and refresh the page. Refresh using web browser controls and/or the green circle at the bottom left of the app. (Reason: HTML, complications with controls inside tables)
 * Widescreen/fullscreen mode doesn't work well on most mobile browsers. On android, Opera currently has the best fullscreen mode. Other browsers work but the address bar takes up a lot of the screen. (Reason: Mobile browser security has changed since my last release. Display modes are limited without a secure (SSL) connection.) 
 * Your phone display will still time out as usual when the app is running. To avoid this, change your display timeout/lock settings when using the app. (Reason: As above, should be fixed when fullscreen allowed)
 * Only run one instance of the Web Application at a time (when connecting to Server, doesn't matter for the demo). The Server Application can only reliably connect to one Client. (Reason: On each update from Server to Web Application, the Server only sends data that has changed since the last update, and it only stores one version of the last sent data). 

## Overview

irPitCrew is a mobile application designed to make pitstops in iRacing easier to manage. Its primary goal is to answer the question "When do I need to pit?" in the least distracting way possible so you can keep your eyes on the road. The number of laps until you run out of fuel is displayed in the middle of the display.

Another very useful feature is the option to automatically apply the real-time fuel calculation when you enter pit lane. These two features alone allow you to:

 * Confidently stay on track until you really need fuel.
 * Pull into pit lane and automatically get the right amount to fuel, without touching anything.
 * Concentrate on racing.
 
## Design Objectives

The Web Application interface was purposely designed to be as simple and intuitive as possible, so it may not be the prettiest. I've tried a few things to make it look nice but it always seems to add distractions and make the information harder to read.

The goals when creating the interface were as follows:

 * Provide an interface that you can read in a glance. You should not need to look at it for more than 1/2 a second. In my experience, looking away from the track for any more than 1 second can easily put you in the wall and end your race.
 * If you need to manually adjust anything, a tap or swipe should be enough.
 * Avoid complex information. Minimize the effort spent thinking about fuel or calculating in your head during a race. At the very least, this will slow you down.
 * Use colors to indicate status at a glance (eg. green is good, red is bad, aqua is user editable)
 * Use intuitive controls and displays to consolidate information. Avoid forcing the user to read and interpret rows of text while driving.
 
## The Application

The app will run on any device with a wifi connection and a web browser, like a phone or tablet. You can also just run it from the browser on your PC and display it on a secondary display, or leave it in the background when racing (to auto apply the real-time fuel calculation when entering pit lane).

The full irPitCrew application has two components:
 * A Server Application that runs on your iRacing PC, interfaces with iRacing, and passes data to the web application.
 * A Web Application that provides the user interface in the web browser on your phone or PC.
 
For the real-time fuel calculation, the Server application will record lap time and lap fuel information for any car/track combination that you race or practice. These values are stored on your PC, so to get a good fuel estimate, run a few practice laps before you race to give the Server some data to work with. This calculation will also be updated while you race. Alternatively, you can just jump in a race and the fuel calculation should show up after a few laps.

## Features

Along with the laps of fuel until the next pitstop display, and the real-time fuel calculation, irPitCrew provides an interface to replace some of the iRacing black box controls for Fuel and Tires, since trying to use the mouse and keyboard while driving will end your race pretty quickly. It also displays race status information and includes information to help set required race fuel (pre-race) for races that do not require a pitstop.

Here is a summary of features:

 * **Display laps until next pit stop** (ie. "When do I need to pit?")
 * **Real-time fuel calculation** for any car/track combo you race or practice. Is saved between racing sessions (see Note 1 below).
 * **Auto Apply** displayed/calculated pit settings when entering pit lane (see Note 2 and Note 3 below).
 * **Low fuel indicator** flashes obnoxiously if you have less than 1 lap of fuel left.
   * If this is flashing and you drive by the pit entrance, you **will** run out of fuel.
 * **Interface to set Fuel Level** for next pitstop. 
   * Default: Calc (auto calculated)
   * Use the Full, Calc, None buttons.
   * Drag/Touch enabled fuel gauge to set a custom level.
   * Click/Tap the fuel gauge to switch to Fine Tuning mode.
 * **Interface to set Tires** for next pitstop.
   * Drag/Touch enabled.
   * Tap center to select/deselect all. Tap individual tires. Swipe left, right, up, down.
 * **Display Time and Laps Remaining.**
 * **Connection Status Indicator**
   * Green means connected.
   * Click/Tap to refresh Web Application (to reconnect and reset size/orientation).
 * **Pit Optional display**
   * Number of laps until pit optional. If -pit optional now- displayed, you can pit now and get enough fuel to finish the race.
   * Useful if you're stuck in traffic and choose to pit early.
 * Set whether **Windshield Tearoff** and **Fast Repair** are enabled for next pitstop.
   * Displayed as -WS- -FR-
 * **Pre-race fuel calculation**
   * Drag up from the bottom of the screen to show.
   * From the iRacing Garage interface, manually adjust the current fuel level to update the Time on Fuel and Laps on Fuel values.
   * Useful for races that do not require a pitstop.
   
Notes:*
 1. Real-time fuel calculation: Only the Server application is needed to run practice laps and get a fuel calculation, no need to connect with the Web application.
 2. Auto Apply: The Web Application must be running, and connected to the Server, to Auto Apply the fuel calculation during a race. If you are using VR, or don't have a secondary display available, the Web application can run in a web browser in the background on your PC.
 3. Auto Apply: Auto apply will set the currently diplayed pit settings to iRacing when you drive into the pit lane. If Auto is not enabled (it is by default), then the settings displayed on the Web Application will not be sent to iRacing. You can press Apply to send them manually any time.
 
## To Install and Run (TBD)

Unzip the irPitCrew_xxx folder anywhere on your PC. Run irPitCrew.exe to start the Server application. It runs locally so it doesn't matter where you put the folder.

To connect the Web Application, open a web browser on your phone or PC, then type in the address displayed by the Server.

If you have a previous installation of irPitCrew, you can copy your existing Data/ folder over the one in the new installation to keep your old config settings and lap time data (or back up the old Data directory and copy the new one over, safety first)
 
Optional, check out the configuration settings in Data/config.txt
