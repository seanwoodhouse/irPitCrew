
// Updates the global data in serverData with the latest values sent
// over from the server. Only changed values are sent over.  A flag is
// set for each value that is updated.
//
// The update process is:
//   UpdateData_UpdateSessionData()    The session string from irsdk.
//                                     This is not sent very often since it is large and changes a lot,
//                                     only on server/client reconnect, new car/track.
//                                     Generally it is not used or relied upon here, custom data is added to the Data portion.
//
//   UpdateData_UpdateServerData()     The Data portion from irsdk.
//   UpdateData_UpdateDependentData()  Calculated client data that relies on server data.
//
//   ... use the updated data ...
//
//   UpdateData_ClearDataUpdated()     All data updates have been handled. Clear updated state.
//

var sessionData =
{
    trackNameStr:0,
    trackNameUpdated:0,
}

// Data from the "Data" string in irsdk, plus some custom server calculated
// values added on.
//
var serverData =
{
    // All decimal values will be truncated to this number of
    // decimal places.
    // This should be fine since most values are displayed to 1 decimal,
    // but this makes comparisons and calculations less accurate.
    // If this is a problem, change from 1 to 2, but then the display
    // needs to update more often.
    // (mostly needed for values with high update rate)
    // (server truncates all values to 3 decimals also, to limit bandwidth)
    //
    decimalsForVal:1,

    fuelDisplayConversionFactorStr:0,
    fuelDisplayConversionFactorVal:0,
    fuelDisplayConversionFactorUpdated:0,

    fuelDisplayUnitsStr:"",
    fuelDisplayUnitsUpdated:false,

    remainingTimeStr:"",
    remainingTimeVal:0,
    remainingTimeUpdated:false,

    estimatedLapTimeStr:"",
    estimatedLapTimeVal:0,
    estimatedLapTimeUpdated:false,

    estimatedLapFuelStr:"",
    estimatedLapFuelVal:0,
    estimatedLapFuelUpdated:false,

    fuelLevelStr:"",
    fuelLevelVal:0,
    fuelLevelUpdated:false,

    fuelForOneLapStr:"",
    fuelForOneLapVal:0,
    fuelForOneLapUpdated:false,

    fuelRequiredStr:"",
    fuelRequiredVal:0,
    fuelRequiredUpdated:false,

    maxFuelStr:"",
    maxFuelVal:0,
    maxFuelUpdated:false,

    lapsOfFuelStr:"",
    lapsOfFuelVal:0,
    lapsOfFuelUpdated:false,

    remainingLapsMinStr:"",
    remainingLapsMinVal:0,
    remainingLapsMinUpdated:false,

    remainingLapsMaxStr:"",
    remainingLapsMaxVal:0,
    remainingLapsMaxUpdated:false,

    // Tire Pressures
    pressureLFStr:"",
    pressureLFVal:0,
    pressureLFUpdated:false,

    pressureRFStr:"",
    pressureRFVal:0,
    pressureRFUpdated:false,

    pressureLRStr:"",
    pressureLRVal:0,
    pressureLRUpdated:false,

    pressureRRStr:"",
    pressureRRVal:0,
    pressureRRUpdated:false,

    pitAvailableStr:"",
    pitAvailableVal:0,
    pitAvailableUpdated:false,

    isOnTrackBool:false,
    isOnTrackUpdated:false,

    onPitRoadBool:false,
    onPitRoadUpdated:false,

    speedStr:"",
    speedVal:0,
    speedUpdated:false,

    carAheadNumberStr:"",
    carAheadNumberUpdated:false,

    carBehindNumberStr:"",
    carBehindNumberUpdated:false,

    carAheadInitialsStr:"",
    carAheadInitialsUpdated:false,

    carBehindInitialsStr:"",
    carBehindInitialsUpdated:false,

    carAheadPosStr:"",
    carAheadPosVal:0,
    carAheadPosUpdated:false,

    carBehindPosStr:"",
    carBehindPosVal:0,
    carBehindPosUpdated:false,

    carAheadIntervalStr:"",
    carAheadIntervalVal:0,
    carAheadIntervalUpdated:false,

    carBehindIntervalStr:"",
    carBehindIntervalVal:0,
    carBehindIntervalUpdated:false,
}

var dependentData =
{
    fuelToAddVal:0,
    fuelToAddUpdated:false,
}

// This data is not updated here. This is just storage for
// values used elsewhere.
var globalData =
{
    isHeartbeatSet:false,

    //onPitRoadOrOffTrackBool:false,
    onTrackRacingBool:false,
    onTrackOnPitRoadBool:false,

    fuelToAddVal_LastApplied:0,
    fuelToAddStr_Current:"",
    fuelToAddStr_LastApplied:"NotApplied",
    leftFront_LastApplied:false,
    rightFront_LastApplied:false,
    leftRear_LastApplied:false,
    rightRear_LastApplied:false,

    isFastRepairChecked:true,
    isWindshieldChecked:true,
}

// Called before and after updating value from server.
// Allows update calls between to check which values are new.
function UpdateData_ClearDataUpdated()
{
    sessionData.trackNameUpdated = false;

    serverData.fuelDisplayConversionFactorUpdated = false;
    serverData.fuelDisplayUnitsUpdated = false;
    serverData.remainingTimeUpdated = false;
    serverData.estimatedLapTimeUpdated = false;
    serverData.estimatedLapFuelUpdated = false;
    serverData.fuelLevelUpdated = false;
    serverData.fuelForOneLapUpdated = false;
    serverData.fuelRequiredUpdated = false;
    serverData.maxFuelUpdated = false;
    serverData.lapsOfFuelUpdated = false;
    serverData.remainingLapsMinUpdated = false;
    serverData.remainingLapsMaxUpdated = false;
    serverData.pressureLFUpdated = false;
    serverData.pressureRFUpdated = false;
    serverData.pressureLRUpdated = false;
    serverData.pressureRRUpdated = false;
    serverData.pitAvailableUpdated = false;
    serverData.isOnTrackUpdated = false;
    serverData.onPitRoadUpdated = false;
    serverData.speedUpdated = false;
    serverData.carAheadIntervalUpdated = false;
    serverData.carBehindIntervalUpdated = false;
    serverData.carAheadNumberUpdated = false;
    serverData.carBehindNumberUpdated = false;
    serverData.carAheadInitialsUpdated = false;
    serverData.carBehindInitialsUpdated = false;
    serverData.carAheadPosUpdated = false;
    serverData.carBehindPosUpdated = false;

    dependentData.fuelToAddUpdated = false;
}

// Update the fields to storage
//
function UpdateData_UpdateSessionData(elementValue)
{
    // Get values from SessionInfo. Ends with ..., starts at beginning
    // (also ends in ***D.A.T.A***)

    var value;

    // FuelForOneLap
    var value = parseYaml(elementValue, "WeekendInfo:TrackDisplayName:");
    if (value.length > 0)
    {
     //   document.getElementById("TrackName").innerHTML = "Track: " + trackName;

        var newValStr = value;

        if (newValStr != sessionData.trackNameStr)
        {
            sessionData.trackNameUpdated = true;
            sessionData.trackNameStr = newValStr;
        }
    }

}

// Update the fields to storage
//
function UpdateData_UpdateServerData(elementValue)
{
    // Get values from data portion
    var dataPos = elementValue.indexOf("***D.A.T.A***");
    if (dataPos >= 0)
    {
        var dataPortion = elementValue.slice(dataPos);

        var value;

        // Do this one first:
        // fuel values will be converted in place below using this value.
        //
        //|FuelDisplayConversionFactor;1.0|
        // Will be 1.0 for L cars
        // DriverInfo:: version doesn't account for current car.
        value = parseDataPortion(dataPortion, "FuelDisplayConversionFactor");
        if (value.length > 0 &&     // this value cannot be cleared
            value != parsingData.dataNotSetString)
        {
            // This value rarely changes. No need to check if changed.
            serverData.fuelDisplayConversionFactorStr = value;
            serverData.fuelDisplayConversionFactorVal = parseFloat(value); //don't truncate
            serverData.fuelDisplayConversionFactorUpdated = true;
        }

        //|FuelDisplayUnits;1.0|
        value = parseDataPortion(dataPortion, "FuelDisplayUnits");
        if (value.length > 0 &&     // this value cannot be cleared
            value != parsingData.dataNotSetString)
        {
            // This value rarely changes. No need to check if changed.
            serverData.fuelDisplayUnitsStr = value;
            serverData.fuelDisplayUnitsUpdated = true;
        }

        // remainingTime
        value = parseDataPortion(dataPortion, "remainingTime");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.remainingTimeVal)
            {
                serverData.remainingTimeUpdated = true;

                serverData.remainingTimeVal = newVal;
                serverData.remainingTimeStr = createTimeString( newVal );
            }
        }

        // estimatedLapTime
        value = parseDataPortion(dataPortion, "estimatedLapTime");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.estimatedLapTimeVal)
            {
                serverData.estimatedLapTimeUpdated = true;

                serverData.estimatedLapTimeVal = newVal;
                serverData.estimatedLapTimeStr = createTimeString( newVal );
            }
        }

        // estimatedLapFuel
        value = parseDataPortion(dataPortion, "estimatedLapFuel");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal) ;
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.estimatedLapFuelVal)
            {
                serverData.estimatedLapFuelUpdated = true;

                serverData.estimatedLapFuelVal = newVal;
                serverData.estimatedLapFuelStr = parseFloat(value).toFixed(2);
            }
        }

        // FuelForOneLap
        value = parseDataPortion(dataPortion, "FuelForOneLap");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed(2);
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.fuelForOneLapVal)
            {
                serverData.fuelForOneLapUpdated = true;

                serverData.fuelForOneLapVal = newVal;
                serverData.fuelForOneLapStr = parseFloat(value).toFixed(1);
            }
        }

        // LapsOfFuel
        value = parseDataPortion(dataPortion, "LapsOfFuel");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.lapsOfFuelVal)
            {
                serverData.lapsOfFuelUpdated = true;

                serverData.lapsOfFuelVal = newVal;
                serverData.lapsOfFuelStr = parseFloat(value).toFixed(1);
            }
        }

        //|FuelLevel;45.4909|
        value = parseDataPortion(dataPortion, "FuelLevel");
        if (value != parsingData.dataNotSetString)
        {
            var fuelLevelVal = parseFloat(value);
            var fuelDisplayConversionFactorVal = serverData.fuelDisplayConversionFactorVal;

            // Convert between kg/L as data is read.
            // For 0 conversion value, don't convert.
            if (fuelDisplayConversionFactorVal > 0)
            {
                fuelLevelVal *= fuelDisplayConversionFactorVal;
            }

            var newValStr = fuelLevelVal.toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.fuelLevelVal)
            {
                serverData.fuelLevelUpdated = true;

                serverData.fuelLevelVal = newVal;
                serverData.fuelLevelStr = newVal.toFixed(1);
            }
        }

        // <p id="MaxFuel">MaxFuel: not set</p>
        // |MaxFuel;0|
        value = parseDataPortion(dataPortion, "MaxFuel");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.maxFuelVal)
            {
                serverData.maxFuelUpdated = true;

                serverData.maxFuelVal = newVal;
                serverData.maxFuelStr = parseFloat(value).toFixed(1);
            }
        }

        // <p id="FuelRequired">Fuel Required: not set</p>
        // |FuelRequired;0|
        value = parseDataPortion(dataPortion, "FuelRequired");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.fuelRequiredVal)
            {
                serverData.fuelRequiredUpdated = true;

                serverData.fuelRequiredVal = newVal;

                if (newVal >= 0)
                {
                    serverData.fuelRequiredStr = parseFloat(value).toFixed(1);
                }
                else
                {
                    // unlimited
                    serverData.fuelRequiredStr = "&infin;";
                }
            }
        }

        // "remainingLapsMin;" << remainingLapsMin << "|";
        value = parseDataPortion(dataPortion, "remainingLapsMin");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.remainingLapsMinVal)
            {
                serverData.remainingLapsMinUpdated = true;
                serverData.remainingLapsMinVal = newVal;

                if (newVal >= 0)
                {
                    serverData.remainingLapsMinStr = parseFloat(value).toFixed(1);
                }
                else
                {
                    // unlimited
                    serverData.remainingLapsMinStr = "&infin;";
                }
            }
        }

        // "remainingLapsMax;" << remainingLapsMax << "|";
        value = parseDataPortion(dataPortion, "remainingLapsMax");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.remainingLapsMaxVal)
            {
                serverData.remainingLapsMaxUpdated = true;
                serverData.remainingLapsMaxVal = newVal;

                if (newVal >= 0)
                {
                    serverData.remainingLapsMaxStr = parseFloat(value).toFixed(1);
                }
                else
                {
                    // unlimited
                    serverData.remainingLapsMaxStr = "&infin;";
                }
            }
        }

        // |LFcoldPressure;0|
        value = parseDataPortion(dataPortion, "LFcoldPressure");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.pressureLFVal)
            {
                serverData.pressureLFUpdated = true;

                serverData.pressureLFVal = newVal;
                serverData.pressureLFStr = parseFloat(value).toFixed(0);
            }
        }

        // |RFcoldPressure;0|
        value = parseDataPortion(dataPortion, "RFcoldPressure");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.pressureRFVal)
            {
                serverData.pressureRFUpdated = true;

                serverData.pressureRFVal = newVal;
                serverData.pressureRFStr = parseFloat(value).toFixed(0);
            }
        }

        // |LRcoldPressure;0|
        value = parseDataPortion(dataPortion, "LRcoldPressure");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.pressureLRVal)
            {
                serverData.pressureLRUpdated = true;

                serverData.pressureLRVal = newVal;
                serverData.pressureLRStr = parseFloat(value).toFixed(0);
            }
        }

        // |RRcoldPressure;0|
        value = parseDataPortion(dataPortion, "RRcoldPressure");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.pressureRRVal)
            {
                serverData.pressureRRUpdated = true;

                serverData.pressureRRVal = newVal;
                serverData.pressureRRStr = parseFloat(value).toFixed(0);
            }
        }

        // PitAvailable
        value = parseDataPortion(dataPortion, "PitAvailable");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.pitAvailableVal)
            {
                serverData.pitAvailableUpdated = true;

                serverData.pitAvailableVal = newVal;
                serverData.pitAvailableStr = parseFloat(value).toFixed(1);
            }
        }

        // IsOnTrack
        value = parseDataPortion(dataPortion, "IsOnTrack");
        if (value.length > 0    &&          // cannot be cleared
            value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed(0);
            var newVal = parseFloat(newValStr);

            var newBool = (newVal==0)?false:true;

            if (newBool != serverData.isOnTrackBool)
            {
                serverData.isOnTrackUpdated = true;
                serverData.isOnTrackBool = newBool;
            }
        }

        // OnPitRoad
        value = parseDataPortion(dataPortion, "OnPitRoad");
        if (value.length > 0    &&      // cannot be cleared
            value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed(0);
            var newVal = parseFloat(newValStr);

            var newBool = (newVal==0)?false:true;

            if (newBool != serverData.onPitRoadBool)
            {
                serverData.onPitRoadUpdated = true;
                serverData.onPitRoadBool = newBool;
            }
        }

        // Speed
        value = parseDataPortion(dataPortion, "Speed");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.speedVal)
            {
                serverData.speedUpdated = true;

                serverData.speedVal = newVal;
                serverData.speedStr = parseFloat(value).toFixed(1);
            }
        }

        // CarAheadNumber
        value = parseDataPortion(dataPortion, "CarAheadNumber");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = value;

            if (newValStr != serverData.carAheadNumberStr)
            {
                serverData.carAheadNumberUpdated = true;
                serverData.carAheadNumberStr = newValStr;
            }
        }

        // CarBehindNumber
        value = parseDataPortion(dataPortion, "CarBehindNumber");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = value;

            if (newValStr != serverData.carBehindNumberStr)
            {
                serverData.carBehindNumberUpdated = true;
                serverData.carBehindNumberStr = newValStr;
            }
        }

        // CarAheadInitials
        value = parseDataPortion(dataPortion, "CarAheadInitials");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = value;

            if (newValStr != serverData.carAheadInitialsStr)
            {
                serverData.carAheadInitialsUpdated = true;
                serverData.carAheadInitialsStr = newValStr;
            }
        }

        // CarBehindInitials
        value = parseDataPortion(dataPortion, "CarBehindInitials");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = value;

            if (newValStr != serverData.carBehindInitialsStr)
            {
                serverData.carBehindInitialsUpdated = true;
                serverData.carBehindInitialsStr = newValStr;
            }
        }

        // CarAheadPos
        value = parseDataPortion(dataPortion, "CarAheadPos");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( 0 );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.carAheadPosVal)
            {
                serverData.carAheadPosUpdated = true;

                serverData.carAheadPosVal = newVal;
                serverData.carAheadPosStr = newValStr;
            }
        }

        // CarBehindPos
        value = parseDataPortion(dataPortion, "CarBehindPos");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( 0 );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.carBehindPosVal)
            {
                serverData.carBehindPosUpdated = true;

                serverData.carBehindPosVal = newVal;
                serverData.carBehindPosStr = newValStr;
            }
        }

        // CarAheadInterval
        value = parseDataPortion(dataPortion, "CarAheadInterval");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.carAheadIntervalVal)
            {
                serverData.carAheadIntervalUpdated = true;

                serverData.carAheadIntervalVal = newVal;
                serverData.carAheadIntervalStr = createTimeString( newVal );
            }
        }

        // CarBehindInterval
        value = parseDataPortion(dataPortion, "CarBehindInterval");
        if (value != parsingData.dataNotSetString)
        {
            var newValStr = parseFloat(value).toFixed( serverData.decimalsForVal );
            var newVal = parseFloat(newValStr);

            if (newVal != serverData.carBehindIntervalVal)
            {
                serverData.carBehindIntervalUpdated = true;

                serverData.carBehindIntervalVal = newVal;
                serverData.carBehindIntervalStr = createTimeString( newVal );
            }
        }

    }
}

function UpdateData_UpdateDependentData()
{
    // Fuel To Add
    // Depends on a value from fuelState for manual mode.
    if (serverData.fuelLevelUpdated ||
        serverData.maxFuelUpdated ||
        serverData.fuelRequiredUpdated ||
        fuelState.manualFuelRequiredUpdated )
    {
        var fuelLevelVal = serverData.fuelLevelVal;
        var maxFuelVal = serverData.maxFuelVal;
        var fuelRequiredVal = serverData.fuelRequiredVal;

        // If 'infinity' fuel required (-1 from server), set 0 to
        // be consistent with Fuel Required tags (Test Mode).
        if (fuelRequiredVal < 0)
        {
            fuelRequiredVal = 0;
        }

        // If manual mode (set by dragging), use the manual value.
        //
        if (fuelState.isManualFuelRequiredMode)
        {
            // if Full button, and MaxFuel Updated, need to update manual fuel
            // required value to new Full state.
            //
            if (serverData.maxFuelUpdated &&
                fuelCoords.fullButtonState == true)
            {
                // If max fuel is known, use it. If not, set to 0.
                // When Max Fuel changes, UpdateDependentData will update
                // this value manualFuelRequiredValue, if the Full button is ON.
                //
                if (serverData.maxFuelVal > 0)
                {
                    fuelState.manualFuelRequiredValue = serverData.maxFuelVal;
                }
                else
                {
                    fuelState.manualFuelRequiredValue = 0;
                }
            }

            fuelRequiredVal = fuelState.manualFuelRequiredValue;
        }

        var fuelToAddVal = fuelRequiredVal - fuelLevelVal;
        var spaceInTank = maxFuelVal - fuelLevelVal;

        // This is rounded to int, so always round up (if positive).
        if (fuelToAddVal > 0)
        {
            fuelToAddVal += 0.5;
        }

        // Set the new value
        var newValStr = fuelToAddVal.toFixed(0);
        var newVal = parseFloat(newValStr);

        if (newVal != dependentData.fuelToAddVal)
        {
            dependentData.fuelToAddUpdated = true;
            dependentData.fuelToAddVal = newVal;
        }
    }
}

function createTimeString( timeVal )
{
    var timeStr = "";

    if (timeVal >= 0)
    {
        if (timeVal >= 3600)
        {
            var hours = Math.floor(timeVal / 3600);
            timeStr += hours + ":";

            timeVal = timeVal - (hours * 3600);
        }

        var minutes = 0;
        if (timeVal >= 60)
        {
            minutes = Math.floor(timeVal / 60);

            timeVal = timeVal - (minutes * 60);
        }
        if (minutes < 10)
        {
            timeStr += "0" + minutes + ":";
        }
        else
        {
            timeStr += minutes + ":";
        }

        // seconds
        if (timeVal < 10)
        {
            timeStr += "0" + Math.floor(timeVal);
        }
        else
        {
            timeStr += Math.floor(timeVal);
        }
    }
    else
    {
        // unlimited
        timeStr = "&infin;";
    }

    return timeStr;
}
