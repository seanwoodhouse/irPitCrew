
// Create global variable for websocket object.
//
var websocket;

function irPitCrew_Initialize()
{
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // Handle screen orientation.
    //
    /*
    screen.addEventListener("orientationchange", function() {
        console.log("The orientation of the screen is: " + screen.orientation);
        alert(screen.orientation);
    });
    screen.lockOrientation('landscape');
    var lockAllowed = window.screen.lockOrientation('landscape');
    */

    // or
    /*
    var lockOrientation = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;

    if (lockOrientation("landscape")) {
     orientation was locked
       alert("locked");
    } else {
     orientation lock failed
     alert("not locked");
    }
    */

    // This (almost) works on Android, Chrome. Doesn't refresh size after lock.
    // Breaks Safari though...
    //
    /*
    var lockFunction =  window.screen.orientation.lock;
    if (lockFunction.call(window.screen.orientation, 'landscape')) {
        console.log('Orientation locked')
       //alert('Orientation locked')
    } else {
        console.error('There was a problem in locking the orientation')
       // alert('There was a problem in locking the orientation')
    }
    */

    websocket = createWebSocket();

    // Set heartbeat interval.
    setInterval(heartbeatSend, 2000);

    // Draw the status image.
    setConnectionStatusColor("");

    // Initialize default control colors
    //
    if (globalData.isFastRepairChecked)
    {
        document.getElementById("fastRepairLabel").style.color = "aqua";
    }
    else
    {
        document.getElementById("fastRepairLabel").style.color = "grey";
    }

    if (globalData.isWindshieldChecked)
    {
        document.getElementById("windshieldLabel").style.color = "aqua";
    }
    else
    {
        document.getElementById("windshieldLabel").style.color = "grey";
    }

    UpdateData_ClearDataUpdated();


    // Get the height of the window and calculate the desired
    // canvas height to fill the screen.
    // Window, subtract top and bottom rows, subtract borders and padding (guess).

    // From above:
    // table style="position:relative; width:100%; height:70px; ...
    //
    var headerHeight = 65;
    var newCanvasHeight = window.innerHeight - (headerHeight*2) - 30;


    document.getElementById("TiresIndicator").height = newCanvasHeight;
    document.getElementById("LapsOfFuelIndicator").height = newCanvasHeight;
    document.getElementById("FuelIndicator").height = newCanvasHeight;


    // Draw the base indicators
    TiresIndicator_InitTiresIndicator();
    FuelIndicator_InitFuelIndicator();
    LapsOfFuel_InitIndicator();
}


function createWebSocket()
{
    var wsName = "ws://" + location.hostname + ":" + location.port;
    //alert(wsName);

    var ws = new WebSocket(wsName,
    'iracing-data-protocol');
    ws.onopen = onWebSocketOpen;
    ws.onerror = onWebSocketError;
    ws.onclose = onWebSocketClose;
    ws.onmessage = onWebSocketMessage;

    return ws;
}


function heartbeatSend()
{
    // Send heartbeat message over websocket.
    // Set a flag, "waiting for heartbeat"; cleared on response.
    // If the flag is already set, we missed a beat.
    //

    // Previous response received. Connected, send heartbeat.
    //
    if (false == globalData.isHeartbeatSet)
    {
        globalData.isHeartbeatSet = true;

        var data = "heartbeat";
        websocket.send(data);
    }

    // Not connected, reconnect socket.
    // onopen will clear the heartbeat flag is successful.
    else
    {
        setConnectionStatusColor("red");

        // Reset
        websocket.close();
        websocket = createWebSocket();
    }
}


function heartbeatReceive(message)
{
    setConnectionStatusColor("rgb(20,200,20)");

    // connected, clear heartbeat
    globalData.isHeartbeatSet = false;
}

function onWebSocketOpen()
{
    //console.log("onopen");
    setConnectionStatusColor("yellow");

    // connected, clear heartbeat
    globalData.isHeartbeatSet = false;
}

function onWebSocketError()
{
    //console.log("on error");
    setConnectionStatusColor("red");

    // do nothing, let heartbeat handle reconnection
}

function onWebSocketClose()
{
    //console.log("on close");
    setConnectionStatusColor("red");
}

function onWebSocketMessage(message)
{
    setConnectionStatusColor("rgb(20,200,20)");

    var messageData = message.data;

    if (message.data == "heartbeat")
    {
        heartbeatReceive(message.data);
        return;
    }

    //console.log("=========================================");
    //console.log(message);

    // Clear the isUpdated for each field.
    // To limit update of fields.
    //
    UpdateData_ClearDataUpdated();

    // Check on pit road flag.
    // var oldOnPitRoadStr = document.getElementById("OnPitRoad").innerHTML;
    var oldOnPitRoadVal = serverData.onPitRoadBool;
    var oldIsOnTrackVal = serverData.isOnTrackBool;

    // Update all changed fields from the message data.
    // Store in global storage (serverData.)
    UpdateData_UpdateSessionData(messageData);
    UpdateData_UpdateServerData(messageData);
    UpdateData_UpdateDependentData(messageData);

    // Update all changed fields from the message data.
    // Order is important here for dependent fields.
    // Plus, only changed values are sent in the message
    // (so read from fields, not message, for dependent fields).
    UpdateFields_Update();

    // Only update if server data has changed
    var isForcedUpdate = false;
    FuelIndicator_UpdateFuelIndicator(isForcedUpdate);
    LapsOfFuel_UpdateIndicator(isForcedUpdate);
    TiresIndicator_UpdateTiresIndicator(isForcedUpdate);


    // Call after updating all fields.
    // Returns true as you drive into pit lane.
    var isEnteringPitRoad = checkIsEnteringPitRoad( oldOnPitRoadVal );
    if (isEnteringPitRoad)
    {
        // Send pit data to server if Auto Apply selected.
        // (ie. don't auto apply for next driver in endurance/team!)
        //
        if (lapsOfFuelCoords.autoButtonState)
        {
            irPitCrew_onSendButton();
        }
    }

    // Update State values
    var newOnPitRoadVal = serverData.onPitRoadBool;
    var newIsOnTrackVal = serverData.isOnTrackBool;


    // If ontrackonpit road, set button color (green or yellow).
    //
    //console.log("onTrackOnPitRoadBool: " + globalData.onTrackOnPitRoadBool);
    if (globalData.onTrackOnPitRoadBool)
    {
        LapsOfFuelIndicator_UpdatePitRoadAppliedState();
    }
    else
    {
        LapsOfFuelIndicator_SetOffPitRoadState();
    }


    // Call at the end and beginning of update. Other messages (clicks)
    // can cause updates outside of this function.
    //
    UpdateData_ClearDataUpdated();
}


// Button to apply pit settings to server
function irPitCrew_onSendButton()
{
    // do nothing if not on track
    if (serverData.isOnTrackBool)
    {
        // Flash the button
        LapsOfFuelIndicator_SetOnPitRoadState();

        // Send current settings to the server.
        SendPitSettings();
    }
}


// Send the current pit settings to the server.
// Will be sent automatically upon entering pit road.
//
function SendPitSettings()
{
    // Set fuelData based on fuelToAddVal, since it appears to be correct.
    //
    var fuelToAddVal = dependentData.fuelToAddVal;
    var fuelData = "";
    if (fuelToAddVal > 0)
    {
        fuelData = fuelToAddVal.toFixed(0);
    }
    else
    {
        fuelData = "0";
    }

    // Use same separators as received data.
    var fieldSeparator = "\n";
    var valueSeparator = ";";

    var messageStr = fieldSeparator;

    messageStr += "Fuel" + valueSeparator + fuelData;
    messageStr += fieldSeparator;

    // Only send values if checked
    if (isLeftFrontChecked())
    {
        messageStr += "LeftFront" + fieldSeparator;
    }
    if (isRightFrontChecked())
    {
        messageStr += "RightFront" + fieldSeparator;
    }
    if (isLeftRearChecked())
    {
        messageStr += "LeftRear" + fieldSeparator;
    }
    if (isRightRearChecked())
    {
        messageStr += "RightRear" + fieldSeparator;
    }

    if (globalData.isFastRepairChecked)
    {
        messageStr += "FastRepair" + fieldSeparator;
    }

    if (globalData.isWindshieldChecked)
    {
        messageStr += "Windshield" + fieldSeparator;
    }


    //console.log(messageStr);

    websocket.send(messageStr);
}


function setConnectionStatusColor( statusColor )
{
    //document.getElementById("h1").style.color = statusColor

    // w:50, h:40
    var ctx = document.getElementById("connectionStatus").getContext("2d");

    ctx.fillStyle = statusColor;
    ctx.strokeStyle = "rgb(200, 200, 200)"
    ctx.beginPath();
    ctx.arc(30,20,18,0,2*Math.PI);
    ctx.fill();
    ctx.stroke();
}


function onConnectionStatusClick()
{
    var r = confirm("irPitCrew  ©2019 Sean Woodhouse\n\nReload page?");
    if (r == true)
    {
        websocket.close(); // otherwise keeps multiple open in app mode ?
        location.reload();
    }
}


function onFastRepairClick()
{
    if (globalData.isFastRepairChecked)
    {
        globalData.isFastRepairChecked = false;

        document.getElementById("fastRepairLabel").style.color = "grey";
    }
    else
    {
        globalData.isFastRepairChecked = true;

        document.getElementById("fastRepairLabel").style.color = "aqua"
    }
}


function onWindshieldClick()
{
    if (globalData.isWindshieldChecked)
    {
        globalData.isWindshieldChecked = false;

        document.getElementById("windshieldLabel").style.color = "grey";
    }
    else
    {
        globalData.isWindshieldChecked = true;

        document.getElementById("windshieldLabel").style.color = "aqua";
    }
}


// Shared functions to get element offset (accounts for scrolling)
// (call getOffset())
//
function irPitCrew_getOffset(elem)
{
    if (elem.getBoundingClientRect)
    {
        return getOffsetRect(elem)
    } else  // old browser
    {
        return getOffsetSum(elem)
    }
}


function getOffsetSum(elem)
{
    var top=0, left=0
    while(elem)
    {
        top = top + parseInt(elem.offsetTop)
        left = left + parseInt(elem.offsetLeft)
        elem = elem.offsetParent
    }

    return {top: top, left: left}
}


function getOffsetRect(elem)
{
    var box = elem.getBoundingClientRect()

    var body = document.body
    var docElem = document.documentElement

    var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop
    var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft

    var clientTop = docElem.clientTop || body.clientTop || 0
    var clientLeft = docElem.clientLeft || body.clientLeft || 0

    var top  = box.top +  scrollTop - clientTop
    var left = box.left + scrollLeft - clientLeft

    return { top: Math.round(top), left: Math.round(left) }
}


function checkIsEnteringPitRoad( oldOnPitRoadVal )
{
    var isEntering = false;

    var oldOnTrackRacingVal = globalData.onTrackRacingBool;

    var newOnPitRoadVal = serverData.onPitRoadBool;
    var isOnTrackVal = serverData.isOnTrackBool;

    var newOnTrackRacingVal = false;
    if (isOnTrackVal && !newOnPitRoadVal)
    {
        newOnTrackRacingVal = true;
    }

    var newOnTrackOnPitRoadVal = false;
        if (isOnTrackVal && newOnPitRoadVal)
    {
        newOnTrackOnPitRoadVal = true;
    }


    // If moving onto pit road, find out how.
    // Send command if changed because of OnPitRoad change.
    // (If OnPitRoad changes while not OnTrack, don't send)
    // If (was onTrackRacing) and (now not onTrackRacing), leaving track.
    //
    if (oldOnTrackRacingVal && !newOnTrackRacingVal)
    {
        // No longer onTrack, Racing; so we are OffTrack and/or OnPitRoad.
        //
        // If still OnTrack and now OnPitRoad, send the command.
        //
        if (newOnTrackOnPitRoadVal)
        {
            // Confirm that we are moving (don't send the command on a tow)
            var speedVal = serverData.speedVal;
            var RESET_MIN_SPEED = 5.0;
            if (speedVal > RESET_MIN_SPEED)
            {
                isEntering = true;
            }
        }
    }

    globalData.onTrackRacingBool = newOnTrackRacingVal;
    globalData.onTrackOnPitRoadBool = newOnTrackOnPitRoadVal;

    return isEntering;
}
