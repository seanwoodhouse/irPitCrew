
// Updates a few fields on the second page, and the 'tags' in the bottom footer area.
//
function UpdateFields_Update()
{
    var LOW_TIME_REMAINING = 60*5; // < 5 minutes

    var value;

    // Track Name
    if (sessionData.trackNameUpdated)
    {
        document.getElementById("TrackName").innerHTML = sessionData.trackNameStr;
    }

    // remainingTime
    if (serverData.remainingTimeUpdated)
    {
        var remainingTimeElement = document.getElementById("remainingTime");

        remainingTimeElement.innerHTML = serverData.remainingTimeStr;

        var remainingTimeVal = serverData.remainingTimeVal;

        // <5 mins remain; make text blue.
        if (remainingTimeVal < LOW_TIME_REMAINING &&
            remainingTimeVal >= 0)
        {
            remainingTimeElement.style.color="rgb(20,130,220)";
        }
        else
        {
            remainingTimeElement.style.color="";
        }
    }

    // Max display depends on Min, so update together.
    if (serverData.remainingLapsMinUpdated ||
        serverData.remainingLapsMaxUpdated)
    {
        var lapsMinVal = serverData.remainingLapsMinVal;
        var lapsMaxVal = serverData.remainingLapsMaxVal;
        var lapsMaxStr = "";

        var lapsSeparatorStr = "";

        // Max not displayed if Min/Max are the same.
        if (lapsMinVal != lapsMaxVal)
        {
            lapsSeparatorStr = " - ";
            lapsMaxStr = serverData.remainingLapsMaxStr;
        }

        document.getElementById("remainingLapsMin").innerHTML = serverData.remainingLapsMinStr;
        document.getElementById("remainingLapsSeparator").innerHTML = lapsSeparatorStr;
        document.getElementById("remainingLapsMax").innerHTML = lapsMaxStr;
    }

    // estimatedLapTime
    if (serverData.estimatedLapTimeUpdated)
    {
        document.getElementById("estimatedLapTime").innerHTML = serverData.estimatedLapTimeStr;
    }

    if (serverData.pressureLFUpdated)
    {
        document.getElementById("LFcoldPressure").innerHTML = serverData.pressureLFStr;
    }

    if (serverData.pressureRFUpdated)
    {
        document.getElementById("RFcoldPressure").innerHTML = serverData.pressureRFStr;
    }

    if (serverData.pressureLRUpdated)
    {
        document.getElementById("LRcoldPressure").innerHTML = serverData.pressureLRStr;
    }

    if (serverData.pressureRRUpdated)
    {
        document.getElementById("RRcoldPressure").innerHTML = serverData.pressureRRStr;
    }


    // estimatedLapFuel
    if (serverData.estimatedLapFuelUpdated)
    {
        document.getElementById("estimatedLapFuel").innerHTML = serverData.estimatedLapFuelStr + " " + serverData.fuelDisplayUnitsStr;
    }

    // LapsOfFuel
    if (serverData.lapsOfFuelUpdated)
    {
        var lapsOfFuelVal = serverData.lapsOfFuelVal;

        // Set the secondary value, displayed for pit calculations
        document.getElementById("LapsOfFuel2").innerHTML = serverData.lapsOfFuelStr + " laps";
    }

    if (serverData.lapsOfFuelUpdated ||
        serverData.estimatedLapTimeUpdated)
    {
        var lapsOfFuelVal = serverData.lapsOfFuelVal;

        // When LapsOfFuel updates, calculate TimeOnFuel
        // (using stored estimatedLapTime)
        // var estimatedLapTimeVal = parseFloat(document.getElementById("estimatedLapTime").innerHTML);
        var estimatedLapTimeVal = serverData.estimatedLapTimeVal;
        var timeOnFuelVal = lapsOfFuelVal * estimatedLapTimeVal;
        var timeOnFuelStr = createTimeString(timeOnFuelVal);

        document.getElementById("TimeOnFuel").innerHTML = timeOnFuelStr;
    }

    //... Could add "laps since pit" left of optional and required. Could drop required.
    //    Need to calculate this value, currently only on client side.

    // PitAvailable
    if (serverData.pitAvailableUpdated ||
        document.getElementById("PitAvailableLabel").innerHTML == "")
    {
        var pitAvailableVal = serverData.pitAvailableVal;

        var elementLabel = document.getElementById("PitAvailableLabel");
        var element = document.getElementById("PitAvailable");
        var elementLabel2 = document.getElementById("PitAvailableLabel2");

        if (pitAvailableVal == 0.0)
        {
            elementLabel.innerHTML   = "- pit optional ";
            elementLabel.style.color = "rgb(20,220,20)";
            element.innerHTML   = "now";
            element.style.color = "rgb(220,220,20)";;
            elementLabel2.innerHTML   = " ";
            elementLabel2.style.color = "grey";
        }
        else if (pitAvailableVal > 0)
        {
            elementLabel.innerHTML = "- pit optional ";
            elementLabel.style.color = "rgb(20,220,20)";
            element.innerHTML = pitAvailableVal.toFixed(1);
            element.style.color="rgb(220,220,20)";
            elementLabel2.innerHTML = " laps ";
            elementLabel2.style.color= "rgb(20,220,20)";
        }
        else
        {
            elementLabel.innerHTML = "- pit optional ";
            elementLabel.style.color = "grey";
            element.innerHTML = "";
            elementLabel2.innerHTML = "";
        }
    }

    // Update the tags (depend on multiple fields)
    //
    if (serverData.fuelLevelUpdated ||
        serverData.lapsOfFuelUpdated ||
        serverData.fuelRequiredUpdated )
    {
        var fuelLevelVal = serverData.fuelLevelVal;
        var lapsOfFuelVal = serverData.lapsOfFuelVal;
        var fuelRequiredVal = serverData.fuelRequiredVal;

        var pitRequiredStart = "";
        var pitRequiredEnd = "";
        var lapsOfFuelStr = "";

        var isEnoughFuel = FuelIndicator_IsEnoughFuel( "Enough", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );
        var isLowFuel = FuelIndicator_IsEnoughFuel( "Low", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );

        if ( !isEnoughFuel )
        {
            pitRequiredStart = "<span style='color:rgb(20,220,20)'>";

            if (lapsOfFuelVal > 0)
            {
                pitRequiredEnd = " in";
            }
            pitRequiredEnd = " </span>";

            // Add laps amount to pit required tag
            var lapsOfFuelColorStr = "color:rgb(220,220,20)"; // yellow
            if ( isLowFuel )
            {
                //lapsOfFuelColorStr = "color:red";  // red
                lapsOfFuelColorStr = "color:rgb(220,220,20)"; // yellow
            }

            lapsOfFuelStr = "<span style='" + lapsOfFuelColorStr + "'>";
            if (lapsOfFuelVal > 0)
            {
                lapsOfFuelStr += lapsOfFuelVal.toFixed(1);
                lapsOfFuelStr += "</span>";
                lapsOfFuelStr += "<span style='color:rgb(20,220,20)'> laps";
            }
            else
            {
                lapsOfFuelStr += "now!";
            }
            lapsOfFuelStr += "</span>";
        }

        var fuelRequiredTags = "";

        fuelRequiredTags += "<span style='color:grey'>"
        fuelRequiredTags += " - ";
        fuelRequiredTags += pitRequiredStart;
        fuelRequiredTags += "pit required";
        fuelRequiredTags += pitRequiredEnd;
        fuelRequiredTags += lapsOfFuelStr;
        fuelRequiredTags += " - ";
        fuelRequiredTags += "</span>";

        document.getElementById("FuelRequiredTags").innerHTML = fuelRequiredTags;
    }

}
