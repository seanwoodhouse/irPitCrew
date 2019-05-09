
var fuelCoords = {

    canvasWidth: 0,
    canvasHeight: 0,

    // Assign boundary values
    //
    fuelTopOffset: 40,
    fuelBottomOffset: 40,
    fuelRightOffset: 30,
    panelRightOffset: 10,

    fuelWidth: 120,

    // Button panel dimensions
    panelWidth: 0,
    panelTop: 0,
    panelBottom: 0,
    panelLeft: 0,
    panelRight: 0,
    panelHeight: 0,

    // Button dimensions (from top-left)
    buttonHeight:0,
    buttonWidth:0,

    fullButtonX:0,
    fullButtonY:0,
    noneButtonX:0,
    noneButtonY:0,

    requiredButtonX:0,
    requiredButtonY:0,

    fineAdjustTextYOffset:0,

    // Button state
    fullButtonState:false,
    noneButtonState:false,
    requiredButtonState:true,

    // Calculate on Init
    fuelHeaderTop:0,
    fuelHeaderHeight:0,

    fuelTop: 0,
    fuelBottom: 0,
    fuelRight: 0,
    fuelLeft: 0,
    fuelHeight: 0,

}

var fuelState = {

    isTouchFuelDown:false,
    isTouchFuelDownForAdj:false,
    touchStartX:0,
    touchStartY:0,
    touchStartFuelRequiredVal:0,

    // For button clicks, different area from isTouchFuelDownForAdj
    isTouchButtonDown:false,
    //isTouchAutoButtonDown:false,

    // Fine adjust fuel if dragged in this area
    isFineAdjust:false,

    fineAjustRatio:15,
    isFineAdjustMode:false,
    isFineAdjustModeUpdated:false,

    isManualFuelRequiredMode:false,
    manualFuelRequiredValue:0,
    // To update in manual mode (on drag)
    //   - set true
    //   - call UpdateData_UpdateDependentData()
    //   - call FuelIndicator_UpdateFuelIndicator()
    //   - call UpdateData_ClearDataUpdated()
    //   - set false
    //
    manualFuelRequiredUpdated:false,
};

var fuelOnImage;
var fuelOffImage;
var fuelParams = {

    isFuelOnImageLoaded:false,
    isFuelOffImageLoaded:false,
};


function FuelIndicator_InitFuelIndicator()
{
    var canvasElement = document.getElementById("FuelIndicator");

    var isTouchSupported = 'ontouchstart' in window;
    if (isTouchSupported)
    {
        // Register onTouch callbacks
        canvasElement.addEventListener('touchstart', onTouchStartFuel);
        canvasElement.addEventListener('touchmove', onTouchMoveFuel);
        canvasElement.addEventListener('touchend', onTouchEndFuel);
    }

    canvasElement.addEventListener('click', onClickFuelIndicator);

    // - auto resize expands but can't shrink, removed for now
    //   use F5, will still resize on startup -
     // resize the canvas to fill browser window dynamically
    // window.addEventListener('resize', resizeFuelCanvas, false);

    // Load icons
    fuelOnImage = new Image();
    fuelOnImage.onload = function()
    {
        fuelParams.isFuelOnImageLoaded = true;
    };
    fuelOnImage.src = 'icons/FuelLightOn.png';

    fuelOffImage = new Image();
    fuelOffImage.onload = function()
    {
        fuelParams.isFuelOffImageLoaded = true;
    };
    fuelOffImage.src = 'icons/FuelLightOff.png';


    // Set initial canvas size, element dimension; then redraw
    resizeFuelCanvas();
}

function resizeFuelCanvas()
{
    var canvasElement = document.getElementById("FuelIndicator");
    var parentElement = document.getElementById("FuelIndicatorParent");

    // subtract canvas border width*2, and an additional 2, not sure why (td padding? element within td by 1 px?)
    // (ie parent border 10, canvas border 20, 42 required,
    //     parent border 10, canvas border 0, 2 required,
    //     no borders, 2 required)
    // So, if canvas borders required, need to get border width *2 and subtract it here.
    // console.log(getComputedStyle(canvasElement,null).getPropertyValue('border-left-width')); // doesn't work
    //
    canvasElement.width = parentElement.clientWidth - 2;
    fuelCoords.canvasWidth = canvasElement.width;

    // This one is not scaled.
    fuelCoords.canvasHeight = canvasElement.height;

    // Recalculate dimensions based on new width.
    calculateFuelOffsets();

    var isForcedUpdate = true;
    FuelIndicator_UpdateFuelIndicator(isForcedUpdate);
}

function calculateFuelOffsets()
{
    // Button panel
    fuelCoords.panelWidth = 100;
    fuelCoords.panelTop = 0 + fuelCoords.fuelTopOffset;
    fuelCoords.panelBottom = fuelCoords.canvasHeight - fuelCoords.fuelBottomOffset;
    fuelCoords.panelRight = fuelCoords.canvasWidth - fuelCoords.panelRightOffset;
    fuelCoords.panelLeft = fuelCoords.panelRight - fuelCoords.panelWidth;
    fuelCoords.panelHeight = fuelCoords.panelBottom - fuelCoords.panelTop;

    // Add header to max fuel text
    fuelCoords.fuelHeaderTop = 0 + fuelCoords.fuelTopOffset;
    fuelCoords.fuelHeaderHeight = 45;

    // Buttons
    fuelCoords.buttonHeight = 60;
    fuelCoords.buttonWidth = fuelCoords.panelWidth+10;

    fuelCoords.fullButtonX = fuelCoords.panelLeft;
    // +10 to make the buttons wider than the panel, try to look more like tabs, with no right side
    fuelCoords.fullButtonY = fuelCoords.panelTop + fuelCoords.fuelHeaderHeight + 10;

    // From top of Full button to bottom of None button.
    var buttonSpanHeight = fuelCoords.panelBottom - fuelCoords.fullButtonY;

    fuelCoords.requiredButtonX = fuelCoords.panelLeft;
    fuelCoords.requiredButtonY = fuelCoords.fullButtonY + (buttonSpanHeight/2) - fuelCoords.buttonHeight/2;
    // no longer used... fuelCoords.requiredButtonTextYOffset = 40;

    fuelCoords.noneButtonX = fuelCoords.panelLeft;
    fuelCoords.noneButtonY = fuelCoords.panelBottom - fuelCoords.buttonHeight;


    fuelCoords.fineAdjustTextYOffset = 7;


    // Calculate of fuel gauge
    fuelCoords.fuelTop = fuelCoords.fuelHeaderTop + fuelCoords.fuelHeaderHeight;
    fuelCoords.fuelBottom = fuelCoords.canvasHeight - fuelCoords.fuelBottomOffset;
    // fuelCoords.fuelRight = fuelCoords.canvasWidth - fuelCoords.fuelRightOffset;
    fuelCoords.fuelRight = fuelCoords.panelLeft - fuelCoords.fuelRightOffset;

    fuelCoords.fuelLeft = fuelCoords.fuelRight - fuelCoords.fuelWidth;
    fuelCoords.fuelHeight = fuelCoords.fuelBottom - fuelCoords.fuelTop;
}

// If isForcedUpdate is false, will only update if data has
// changed.
//
function FuelIndicator_UpdateFuelIndicator( isForcedUpdate )
{
    var canvasElement = document.getElementById("FuelIndicator");

    // Check whether the values required by this function have
    // changed before redrawing.
    // (Need to also consider manual mode)
    var isDataUpdated = false;
    if (serverData.fuelLevelUpdated ||
        serverData.fuelForOneLapUpdated ||
        serverData.fuelRequiredUpdated ||
        serverData.maxFuelUpdated ||
        serverData.lapsOfFuelUpdated ||
        serverData.fuelDisplayUnitsUpdates ||
        dependentData.fuelToAddUpdated ||
        fuelState.manualFuelRequiredUpdated ||
        fuelState.isFineAdjustModeUpdated )
    {
        isDataUpdated = true;
    }

    // If data is unchanged and it's not a forced update, don't draw.
    if ( !isDataUpdated && !isForcedUpdate )
    {
       return;
    }

    var start = new Date().getTime();

    var fuelLevelStr = serverData.fuelLevelStr;
    var fuelLevelVal = serverData.fuelLevelVal;

    var fuelForOneLapVal = serverData.fuelForOneLapVal;

    var fuelRequiredStr = serverData.fuelRequiredStr;
    var fuelRequiredVal = serverData.fuelRequiredVal;

    var maxFuelStr = serverData.maxFuelStr;
    var maxFuelVal = serverData.maxFuelVal;

    var lapsOfFuelVal = serverData.lapsOfFuelVal;

    var fuelUnitsStr = serverData.fuelDisplayUnitsStr;

    var fuelToAddVal = dependentData.fuelToAddVal;

    var manualFuelRequiredVal = fuelState.manualFuelRequiredValue;


    // if 'infinity' fuel required, set 0 to be consistent
    // with Fuel Required Tags.
    if (isNaN(fuelRequiredVal))
    {
        fuelRequiredVal = 0;
    }

    var fuelRequiredDrawVal = fuelRequiredVal;
    var fuelRequiredDrawStr = fuelRequiredStr;
    if (fuelState.isManualFuelRequiredMode)
    {
        fuelRequiredDrawVal = manualFuelRequiredVal;
        fuelRequiredDrawStr = fuelRequiredDrawVal.toFixed(1);
    }


    // Update max fuel string. Add units, change to 1 decimal place.
    // maxFuelStr = maxFuelVal.toFixed(1);
    maxFuelStr += " ";
    maxFuelStr += fuelUnitsStr;


    // Assign boundary values
    //
    var fuelTopOffset = fuelCoords.fuelTopOffset;
    var fuelBottomOffset = fuelCoords.fuelBottomOffset;
    var fuelRightOffset = fuelCoords.fuelRightOffset;

    var fuelWidth = fuelCoords.fuelWidth;

    var fuelTop = fuelCoords.fuelTop;
    var fuelBottom = fuelCoords.fuelBottom;
    var fuelRight = fuelCoords.fuelRight;
    var fuelLeft = fuelCoords.fuelLeft;
    var fuelHeight = fuelCoords.fuelHeight;

    // Calculate positions
    var fuelLevelHeight = (fuelLevelVal / maxFuelVal) * fuelHeight;
    var fuelLevelPos = fuelBottom - fuelLevelHeight;
    var fuelLevelTextHPad = 10;
    var fuelLevelTextVPad = 7;

    var fuelToAddWidth = 15;
    var fuelToAddLeft = fuelRight - fuelToAddWidth;

    // Fuel Light image
    var fuelImageSize = 50;
    var fuelImageXPos = ((fuelLeft + fuelToAddLeft)/2) - (fuelImageSize/2);
    var fuelImageYPos = fuelTop + (fuelHeight*1/4) - (fuelImageSize/2);


    // Draw the Fuel Indicator
    //
    var ctx = canvasElement.getContext("2d");
    ctx.lineJoin = 'round';

    // Clear screen
    ctx.fillStyle="black";
    ctx.fillRect(0, 0, fuelCoords.canvasWidth, fuelCoords.canvasHeight);

    var fuelRequiredPos = fuelBottom;

    // Required to draw gauge, to calculate where to draw the lines
    // relative to max.
    if (maxFuelVal > 0)
    {
        var isEnoughFuel =
            FuelIndicator_IsEnoughFuel( "Enough", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );
        var isLowFuel =
            FuelIndicator_IsEnoughFuel( "Low", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );
        var isLowFuelOneLap =
            FuelIndicator_IsEnoughFuel( "LowOneLap", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );


        var fuelRequiredHeight = 0;

        // Fuel required (background)
        // if fuel required >= max fuel, draw full box
        // if fuel required <= 0, draw no box
        // if fuel required < max fuel, fuel required is box top
        if (fuelRequiredDrawVal > 0)
        {
            fuelRequiredHeight = fuelHeight;
            if (fuelRequiredDrawVal < maxFuelVal)
            {
                fuelRequiredHeight = (fuelRequiredDrawVal / maxFuelVal) * fuelHeight;
            }
            fuelRequiredPos = fuelBottom - fuelRequiredHeight;

            // Background (black out top as optional pit appears (end of race)
            // (for 1 pit, will always be blacked out)
            // (so grey goes either to the top or the fuel required line)
            // ctx.fillStyle="rgb(30,30,30)";

            // alpha blend this layer so that it doesn't overwrite the fuel icon
            ctx.fillStyle="rgb(60,60,60)";
            ctx.globalAlpha=0.5;

            ctx.fillRect(fuelLeft, fuelRequiredPos, fuelWidth, fuelRequiredHeight);

            ctx.globalAlpha=1;
        }

        // Fuel to add (area)
        if (fuelLevelVal < fuelRequiredDrawVal)
        {
            // If Full mode
            // var fuelToAddTop = fuelTop;
            // If Calc mode
            var fuelToAddTop = fuelRequiredPos;
            // If None mode, don't draw area

            ctx.fillStyle="aqua";

            ctx.fillRect(fuelToAddLeft, fuelRequiredPos, fuelToAddWidth, fuelRequiredHeight);

            ctx.strokeStyle="aqua";
            ctx.beginPath();
            ctx.moveTo(fuelToAddLeft, fuelRequiredPos);
            ctx.lineTo(fuelToAddLeft+fuelToAddWidth, fuelRequiredPos);
            ctx.stroke();
        }

        var lapsOfFuelTextColor = "rgb(220, 220, 20)";
        var fuelLevelTextColor = "rgb(220, 220, 20)";

        // Keep the stack and make the right bar green instead
        //
        var fuelLevelColorNormal = "rgb(220, 220, 20)";
        var fuelLevelColorExcess = "rgb(20, 220, 20)";
        // The solid color.
        var fuelLevelColor = "rgb(220, 220, 20)";

        // Use all same color in manual mode.
        if (fuelState.isManualFuelRequiredMode)
        {
            if (isEnoughFuel)
            {
                // both green
                fuelLevelColorNormal = fuelLevelColorExcess;
            }
            else
            {
                // both yellow
                fuelLevelColorExcess = fuelLevelColorNormal;
            }
        }

        // Enough fuel
        if (isEnoughFuel)
        {
            // enough fuel = green
            fuelLevelColor="rgb(20,220,20)";
            fuelLevelTextColor="rgb(20,220,20)";
            lapsOfFuelTextColor="rgb(20, 220, 20)";
        }
        // Low fuel, and pit required
        else if (isLowFuel)
        {
            // draw fuel level in red if low fuel
            fuelLevelColorNormal = "red"
            fuelLevelColor="red";

            fuelLevelTextColor="red";
            lapsOfFuelTextColor="red";
        }
        // Not enough fuel, pit required
        else
        {
            // use default color
        }


        // Fuel Level (area)

        // gradient test: doesn't quite work, right bar wrong color
        //var grd = ctx.createLinearGradient(fuelLeft, fuelTop, fuelRight, fuelTop);
        // grd.addColorStop(0.0, "rgb(255,255,10)");
        // grd.addColorStop(0.3, fuelLevelColorNormal);
        // grd.addColorStop(0.6, fuelLevelColorNormal);
        // grd.addColorStop(1, "rgb(155,155,10)");
        //ctx.fillStyle = grd;

        // Draw the stacked colors
        ctx.fillStyle = fuelLevelColorNormal;

        ctx.fillRect(fuelLeft, fuelLevelPos, fuelWidth, fuelLevelHeight);

        if (fuelLevelVal >= fuelRequiredDrawVal)
        {
            var fuelLevelExcessHeight = fuelRequiredPos - fuelLevelPos;

            // var grd2 = ctx.createLinearGradient(fuelLeft, fuelTop, fuelRight, fuelTop);
            // grd2.addColorStop(0, fuelLevelColorExcess);
            // grd2.addColorStop(1, "rgb(18,200,18)");
            //ctx.fillStyle = grd2;

            ctx.fillStyle = fuelLevelColorExcess;
            ctx.fillRect(fuelLeft, fuelLevelPos, fuelWidth, fuelLevelExcessHeight);
        }

        // Draw the solid color, leaving the fuelToAdd bar stacked.

        // Use base color in manual mode
        if (fuelState.isManualFuelRequiredMode)
        {
            fuelLevelColor = fuelLevelColorNormal;
        }
        // Draw the solid color, over the fuel add bar, leaving fuel stacked.
        //ctx.fillStyle = grd; // wrong
        ctx.fillStyle = fuelLevelColor;
        ctx.fillRect(fuelToAddLeft, fuelLevelPos, fuelToAddWidth, fuelLevelHeight);

        // Fuel for one lap
        var fuelOneLapHeight = (fuelForOneLapVal / maxFuelVal) * fuelHeight;
        var fuelOneLapPos = fuelBottom - fuelOneLapHeight;

        ctx.fillStyle="red";
        ctx.fillRect(fuelLeft, fuelOneLapPos, fuelWidth, fuelOneLapHeight);

        // make max x same as fuellevel x
        // fuelLeft+fuelLevelTextHPad

        // Fuel Max (text)
        //ctx.fillStyle="blue";
        ctx.fillStyle="rgb(220,220,220)";
        ctx.textAlign="start";
        ctx.font="30px sans-serif";
        var maxFuelFontSize = 30;

        ctx.fillText(maxFuelStr, fuelLeft+fuelLevelTextHPad, fuelCoords.panelTop + maxFuelFontSize);

        // on black bg
        // fuellevel line on top
        // Fuel Required (line)
        if (fuelRequiredDrawVal < maxFuelVal &&
            fuelRequiredDrawVal > 0)
        {
            var fuelRequiredLineLeft;
            var fuelRequiredTextVPos;

            // Fuel required line
            if (fuelLevelVal >= fuelRequiredDrawVal)
            {
                // Fuel Required (text), move below line, make it black
                ctx.fillStyle="black";
                fuelRequiredTextVPos = fuelRequiredPos + 30; // font size

                // draw half line
                var lineLength = 90;
                if (fuelRequiredDrawVal >= 100)
                {
                    // space for the extra digit
                    lineLength = 110;
                }
                fuelRequiredLineLeft = fuelRight-lineLength;

                ctx.strokeStyle="rgb(30,30,30)";
            }
            else
            {
                // Fuel Required (text), above line
                ctx.fillStyle="aqua";
                fuelRequiredTextVPos = fuelRequiredPos-fuelLevelTextVPad;

                // stack above fuellevel
                var fuelRequiredTextOverLevelHeight = 30 + 3; // fontsize+
                var maxFuelRequiredTextVPos = fuelLevelPos - fuelLevelTextVPad - fuelRequiredTextOverLevelHeight;
                if (fuelRequiredTextVPos > maxFuelRequiredTextVPos)
                {
                    fuelRequiredTextVPos = maxFuelRequiredTextVPos;
                }

                // draw half line
                var lineLength = 90;
                if (fuelRequiredDrawVal >= 100)
                {
                    // space for the extra digit
                    lineLength = 110;
                }
                fuelRequiredLineLeft = fuelRight-lineLength;

                ctx.strokeStyle="aqua";
            }

            // Fuel Required (line)
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fuelRequiredLineLeft, fuelRequiredPos);
            ctx.lineTo(fuelToAddLeft, fuelRequiredPos);
            ctx.stroke();

            // Fuel Required (text)
            ctx.textAlign="end";
            ctx.font="30px sans-serif";
            ctx.fillText(fuelRequiredDrawStr, fuelToAddLeft-fuelLevelTextHPad, fuelRequiredTextVPos);
        }

        // Fuel Level (text)
        ctx.fillStyle = fuelLevelTextColor;
        ctx.textAlign="start";
        ctx.font="30px sans-serif";
        ctx.fillText(fuelLevelStr, fuelLeft+fuelLevelTextHPad, fuelLevelPos-fuelLevelTextVPad);
    }

    // Max Fuel not known
    else
    {
        // Inactive background.
        // Alpha blend this layer so that it doesn't overwrite the fuel icon.
        ctx.fillStyle="rgb(60,60,60)";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(fuelLeft, fuelCoords.fuelHeaderTop, fuelWidth, fuelCoords.fuelHeight+fuelCoords.fuelHeaderHeight);
        ctx.globalAlpha = 1;
    }

    // Border

    ctx.lineWidth = 3;
    //ctx.strokeStyle="blue";
    //ctx.strokeStyle="rgb(200,200,200)";
    ctx.strokeStyle="rgb(30,30,30)";
    ctx.strokeRect(fuelLeft, fuelTop, fuelWidth, fuelHeight);

    var fuelMarkerRight = fuelToAddLeft;

    var markWidth = 10;
    var fuel34Pos = fuelBottom - (fuelHeight * 3/4);
    var fuel12Pos = fuelBottom - (fuelHeight * 1/2);
    var fuel14Pos = fuelBottom - (fuelHeight * 1/4);
    var fuel18Pos = fuelBottom - (fuelHeight * 1/8);

    //
    ctx.beginPath();
    ctx.moveTo(fuelLeft, fuel18Pos);
    ctx.lineTo(fuelLeft+(markWidth/2), fuel18Pos);
    ctx.moveTo(fuelMarkerRight-(markWidth/2), fuel18Pos);
    ctx.lineTo(fuelMarkerRight, fuel18Pos);

    ctx.moveTo(fuelLeft, fuel14Pos);
    ctx.lineTo(fuelLeft+markWidth, fuel14Pos);
    ctx.moveTo(fuelMarkerRight-markWidth, fuel14Pos);
    ctx.lineTo(fuelMarkerRight, fuel14Pos);

    ctx.moveTo(fuelLeft, fuel12Pos);
    ctx.lineTo(fuelLeft+markWidth, fuel12Pos);
    ctx.moveTo(fuelMarkerRight-markWidth, fuel12Pos);
    ctx.lineTo(fuelMarkerRight, fuel12Pos);

    ctx.moveTo(fuelLeft, fuel34Pos);
    ctx.lineTo(fuelLeft+markWidth, fuel34Pos);
    ctx.moveTo(fuelMarkerRight-markWidth, fuel34Pos);
    ctx.lineTo(fuelMarkerRight, fuel34Pos);

    // Fuel to add border
    ctx.moveTo(fuelMarkerRight, fuelTop);
    ctx.lineTo(fuelMarkerRight, fuelBottom);

    ctx.lineWidth = 3;
    ctx.stroke();


    // Draw the light color border
    ctx.lineWidth = 3;
    ctx.strokeStyle="rgb(200,200,200)";
    ctx.strokeRect(fuelLeft - ctx.lineWidth,
                   fuelTop - ctx.lineWidth,
                   fuelWidth + (ctx.lineWidth*2),
                   fuelHeight + (ctx.lineWidth*2));

    ctx.beginPath();

    // Header border
    ctx.moveTo(fuelLeft - ctx.lineWidth, fuelTop - ctx.lineWidth);
    ctx.lineTo(fuelLeft - ctx.lineWidth, fuelCoords.fuelHeaderTop);
    ctx.lineTo(fuelLeft + fuelWidth + ctx.lineWidth, fuelCoords.fuelHeaderTop);
    ctx.lineTo(fuelLeft + fuelWidth + ctx.lineWidth, fuelTop - ctx.lineWidth);

    // Fuel to add border (lightcolor)
    ctx.moveTo(fuelMarkerRight+ctx.lineWidth, fuelTop);
    ctx.lineTo(fuelMarkerRight+ctx.lineWidth, fuelBottom);

    // Add a line above and below Fuel to Add value
    //ctx.moveTo(fuelCoords.panelLeft, fuelCoords.panelTop);
    //ctx.lineTo(fuelCoords.panelLeft+fuelCoords.panelWidth, fuelCoords.panelTop);

    //ctx.moveTo(fuelCoords.panelLeft, fuelCoords.fuelTop);
    //ctx.lineTo(fuelCoords.panelLeft+fuelCoords.panelWidth, fuelCoords.fuelTop);

    ctx.stroke();



    // Add Full, None buttons
    drawFuelButtonArea(canvasElement, "Full",
                fuelCoords.fullButtonX, fuelCoords.fullButtonY,
                fuelCoords.buttonWidth, fuelCoords.buttonHeight,
                fuelCoords.fullButtonState,
                fuelRequiredPos);

    drawFuelButtonArea(canvasElement, "None",
                fuelCoords.noneButtonX, fuelCoords.noneButtonY,
                fuelCoords.buttonWidth, fuelCoords.buttonHeight,
                fuelCoords.noneButtonState,
                fuelRequiredPos);

    // Add Req. (required) button
    drawFuelButtonArea(canvasElement, "Calc.",
                fuelCoords.requiredButtonX, fuelCoords.requiredButtonY,
                fuelCoords.buttonWidth, fuelCoords.buttonHeight,
                fuelCoords.requiredButtonState,
                fuelRequiredPos);


    // Add "fuel to add" text below fuel button
    var fuelToAddDispStr = "";
    if (fuelToAddVal > 0)
    {
        fuelToAddDispStr = "+ " + fuelToAddVal.toFixed(0);

        if (fuelUnitsStr.length > 0)
        {
            fuelToAddDispStr += " ";
            fuelToAddDispStr += fuelUnitsStr;
        }
    }
    else
    {
        fuelToAddDispStr = "+ None";
    }

    // Fix to get around Full Tank bug.
    var fuelToAddDispFullStr = "";
    if (maxFuelVal > 0)
    {
        var spaceInTank = maxFuelVal - fuelLevelVal;

        if (fuelToAddVal >= spaceInTank)
        {
            fuelToAddDispFullStr = "- Full -";

            fuelToAddDispStr = fuelToAddDispFullStr;
        }
    }




    //ctx.fillStyle = "rgb(220,220,20)";
    ctx.fillStyle = "aqua";
    ctx.font="30px sans-serif";
    ctx.textAlign="left";

    var reqTextFontSize = 30;
    ctx.fillText(
        fuelToAddDispStr,
        fuelCoords.requiredButtonX,
        fuelCoords.panelTop + reqTextFontSize);

    // Draw Fine Adjust Mode indicator
    //
    if (fuelState.isFineAdjustMode)
    {
        ctx.fillText(
            "fine",
            fuelCoords.fuelLeft,
            fuelCoords.fuelHeaderTop - fuelCoords.fineAdjustTextYOffset);
    }

    // draw grey over the whole thing
    // (not very convincing glass)
    // var grdCover = ctx.createLinearGradient(0, 0, fuelCoords.canvasWidth, fuelCoords.canvasHeight);
    // grdCover.addColorStop(0.0, "rgb(0,100,200)");
    // grdCover.addColorStop(1.0, "rgb(0,25,50)");

    // ctx.globalAlpha = 0.2;
    // ctx.fillStyle = grdCover; //"rgb(60,60,60)";

    // ctx.fillRect(0, 0, fuelCoords.canvasWidth, fuelCoords.canvasHeight);
    // ctx.globalAlpha = 1.0;


    var elapsed = new Date().getTime() - start;
    //console.log("DrawFuelIndicator: " + elapsed + " ms")
    //alert("DrawFuelIndicator: " + elapsed + " ms");

}


function onTouchStartFuel(e)
{
    var touchobj = e.changedTouches[0]; // reference first touch point (ie: first finger)
    startx = parseInt(touchobj.clientX); // get x position of touch point relative to left edge of browser
    starty = parseInt(touchobj.clientY); // get x position of touch point relative to left edge of browser

    var canvasElement = document.getElementById("FuelIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);

    var xPos = startx - boundingRect.left;
    var yPos = starty - boundingRect.top;

    // Increase the touch height x2 to make it easier to touch
    //
    var yExtra = fuelCoords.buttonHeight;

    // If touch is within fuel gauge
    var isInFuelGauge = isXyInFuelGaugeArea(xPos, yPos);

    // If touch is within fuel gauge
    if (isInFuelGauge)
    {
        fuelState.isTouchFuelDown = true;

        // don't bother with offsets, just getting difference
        fuelState.touchStartX = startx;
        fuelState.touchStartY = starty;

        // If maxfuel unknown, can't calculate
        var maxFuelVal = serverData.maxFuelVal;
        if ( maxFuelVal > 0)
        {
            fuelState.isTouchFuelDownForAdj = true;

            // Get the starting value
            if (fuelState.isManualFuelRequiredMode)
            {
                fuelState.touchStartFuelRequiredVal = fuelState.manualFuelRequiredValue;
            }
            // else, start from auto value
            else
            {
                var fuelRequiredVal = serverData.fuelRequiredVal;

                // if 'infinity' fuel required, set 0 to be consistent
                // with Fuel Required Tags.
                if (fuelRequiredVal < 0)
                {
                    //fuelRequiredVal = maxFuelVal;
                    fuelRequiredVal = 0;
                }

                fuelState.touchStartFuelRequiredVal = fuelRequiredVal;
            }
        }

        // Doing this here prevents window from scrolling with this area,
        // even it maxFuel is not yet known.
        // e.preventDefault();
    }

    // Else if within button area.
    // (Add height to the button clickable area to include the FuelToAdd text).

    else if (isXyInButtonArea(
        xPos, yPos,
        fuelCoords.panelLeft,
        0,
        fuelCoords.panelWidth,
        fuelCoords.canvasHeight))
    {
        // don't bother with offsets, just getting difference
        fuelState.touchStartX = startx;
        fuelState.touchStartY = starty;
        fuelState.isTouchButtonDown = true;

        // e.preventDefault();
    }


    // always do this, to prevent any double tap or scroll in this element.
    e.preventDefault();
 }

function onTouchMoveFuel(e)
{
    if (fuelState.isTouchFuelDownForAdj)
    {
        var touchobj = e.changedTouches[0]; // reference first touch point for this event
        var dist = parseInt(touchobj.clientY) - fuelState.touchStartY;

        // We are in manual adjust mode if we are in Manual mode and Full and None are not specified.
        // This means we are already in mouse move adjust mode.
        //
        var isManualAdjustMode =
            (fuelState.isManualFuelRequiredMode &&
            fuelCoords.fullButtonState == false &&
            fuelCoords.noneButtonState == false);

        // Don't commit to manual mode until the mouse moves (dist != 0).
        // If we're already in Manual mode, carry on, already committed.
        // (If the Full or None button is on, we are in manual mode but not committed to
        //  mouse adjustments. Wait for a move in this case as well.)
        //
        if (dist != 0 || isManualAdjustMode)
        {
            var isFullButtonOn = false;
            var isNoneButtonOn = false;

            // Set to manual mode
            FuelIndicator_SetManualFuelRequiredMode(true, isFullButtonOn, isNoneButtonOn);

            // Adjust for fine adjust mode.
            // Slow down the scroll speed for fine adjust.
            //
            if (fuelState.isFineAdjustMode &&
                fuelState.fineAjustRatio != 0)
            {
                dist /= fuelState.fineAjustRatio;
            }

            fuelState.manualFuelRequiredValue = calculateManualFuelRequired(dist);

            // To update in manual mode (on drag)
            //   - set manualFuelRequiredUpdated = true
            //   - call UpdateData_UpdateDependentData()
            //   - call FuelIndicator_UpdateFuelIndicator()
            //   - call UpdateData_ClearDataUpdated()
            //   - set manualFuelRequiredUpdated = false
            //
            fuelState.manualFuelRequiredUpdated = true;
            UpdateData_UpdateDependentData();

            var isForcedUpdate = false;
            FuelIndicator_UpdateFuelIndicator(isForcedUpdate);

            UpdateData_ClearDataUpdated();
            fuelState.manualFuelRequiredUpdated = false;
        }

        e.preventDefault();
    }
 }

function onTouchEndFuel(e)
{
    var touchobj = e.changedTouches[0];
    var startx = parseInt(touchobj.clientX);
    var starty = parseInt(touchobj.clientY);

    // Get X,Y dist from start point
    var distX = startx - fuelState.touchStartX;
    var distY = starty - fuelState.touchStartY;

    if (fuelState.isTouchFuelDown || fuelState.isTouchFuelDownForAdj)
    {
        // Max amount of move to be a click
        var clickMaxDist = 5;

        var absDistX = Math.abs(distX);
        var absDistY = Math.abs(distY);

        // Whether max fuel is set or not, check for a click.
        //
        if (absDistX < clickMaxDist && absDistY < clickMaxDist)
        {
            // On click, toggle fine adjust mode.
            // Slow down the scroll speed for fine adjust.
            //
            if (fuelState.isFineAdjustMode)
            {
                fuelState.isFineAdjustMode = false;
            }
            else
            {
                fuelState.isFineAdjustMode = true;
            }

            // Update the indicator. There is no data dependent upon this setting.
            //
            fuelState.isFineAdjustModeUpdated = true;
            var isForcedUpdate = false;
            FuelIndicator_UpdateFuelIndicator(isForcedUpdate);
            fuelState.isFineAdjustModeUpdated = false;
        }

        // Else if touch down and max fuel set, treat as a move
        //
        else if (fuelState.isTouchFuelDownForAdj)
        {
            // Handle drag
            // Must have been a touch down.
            // Must now be in manual mode (skips case where no move)
            if (fuelState.isManualFuelRequiredMode)
            {
                // Adjust for fine adjust mode.
                // Slow down the scroll speed for fine adjust.
                //
                if (fuelState.isFineAdjustMode &&
                    fuelState.fineAjustRatio != 0)
                {
                    distY /= fuelState.fineAjustRatio;
                }

                fuelState.manualFuelRequiredValue = calculateManualFuelRequired(distY);

                // To update in manual mode (on drag)
                //   - set manualFuelRequiredUpdated = true
                //   - call UpdateData_UpdateDependentData()
                //   - call FuelIndicator_UpdateFuelIndicator()
                //   - call UpdateData_ClearDataUpdated()
                //   - set manualFuelRequiredUpdated = false
                //
                fuelState.manualFuelRequiredUpdated = true;
                UpdateData_UpdateDependentData();

                var isForcedUpdate = false;
                FuelIndicator_UpdateFuelIndicator(isForcedUpdate);

                UpdateData_ClearDataUpdated();
                fuelState.manualFuelRequiredUpdated = false;

                // e.preventDefault();
            }
        }

        e.preventDefault();
    }

    else if (fuelState.isTouchButtonDown)
    {
        // Max amount of move to be a click
        var clickMaxDist = 20;

        var absDistX = Math.abs(distX);
        var absDistY = Math.abs(distY);

        if (absDistX < clickMaxDist && absDistY < clickMaxDist)
        {
            var canvasElement = document.getElementById("FuelIndicator");
            var boundingRect = irPitCrew_getOffset(canvasElement);

            // Get X,Y of START point
            var xPos = fuelState.touchStartX - boundingRect.left;
            var yPos = fuelState.touchStartY - boundingRect.top;

            var isChanged = handleOnClickFuelIndicatorEvent(xPos, yPos);

            // done in function
            //var isForcedUpdate = true;
            //FuelIndicator_UpdateFuelIndicator(isForcedUpdate);
        }

        e.preventDefault();
    }


    fuelState.touchStartX = 0;
    fuelState.touchStartY = 0;
    fuelState.isTouchFuelDown = false;
    fuelState.isTouchFuelDownForAdj = false;
    fuelState.isFineAdjust = false;
    fuelState.isTouchButtonDown = false;
    //fuelState.isTouchAutoButtonDown = false;
    fuelState.touchStartFuelRequiredVal = 0;
 }

 function onClickFuelIndicator(event)
{
    var canvasElement = document.getElementById("FuelIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);

    var xPos = event.pageX - boundingRect.left;
    var yPos = event.pageY - boundingRect.top;

    var isChanged = handleOnClickFuelIndicatorEvent(xPos, yPos);

    event.preventDefault();
}

function handleOnClickFuelIndicatorEvent(xPos, yPos)
{
    var isFullClicked = false;
    var isNoneClicked = false;
    var isRequiredClicked = false;
    var isChanged = false;

    //var yExtra = fuelCoords.buttonHeight;
    // no extra for these, they are large and could be close together...
    var yExtra = 0;

    // Required button.
    // (Add height to the button clickable area to include the FuelToAdd text).
    isRequiredClicked = isXyInButtonArea(
        xPos, yPos,
        fuelCoords.requiredButtonX,
        fuelCoords.requiredButtonY - (yExtra/2),
        fuelCoords.buttonWidth,
        fuelCoords.buttonHeight + yExtra );//+ fuelCoords.requiredButtonTextYOffset);

    if (isRequiredClicked)
    {
        // Full and None will be off in either case if Req is clicked.
        var isFullButtonOn = false;
        var isNoneButtonOn = false;

        if (fuelCoords.requiredButtonState)
        {
            // Turn manual mode on.
            // (set current required fuel as starting manual fuel)
            //fuelCoords.requiredButtonState = false;
            FuelIndicator_SetManualFuelRequiredMode(true, isFullButtonOn, isNoneButtonOn);
        }
        else
        {
            // Turn manual mode off (Required: ON)
            //fuelCoords.requiredButtonState = true;
            FuelIndicator_SetManualFuelRequiredMode(false, isFullButtonOn, isNoneButtonOn);
        }

        isChanged = true;
    }

    // Full button.
    //
    isFullClicked = isXyInButtonArea(
        xPos, yPos,
        fuelCoords.fullButtonX,
        fuelCoords.fullButtonY - (yExtra/2),
        fuelCoords.buttonWidth,
        fuelCoords.buttonHeight + yExtra);

    if (isFullClicked)
    {
        // No toggle on full, turn Full button on if clicked.
        //
        var isFullButtonOn = true;
        var isNoneButtonOn = false;

        // Turn manual mode on.
        // (set full fuel as manual fuel)
        //
        FuelIndicator_SetManualFuelRequiredMode(true, isFullButtonOn, isNoneButtonOn);

        isChanged = true;
    }

    // None button.
    //
    isNoneClicked = isXyInButtonArea(
        xPos, yPos,
        fuelCoords.noneButtonX,
        fuelCoords.noneButtonY - (yExtra/2),
        fuelCoords.buttonWidth,
        fuelCoords.buttonHeight + yExtra);

    if (isNoneClicked)
    {
        // No toggle on none, turn None button on if clicked.
        //
        var isFullButtonOn = false;
        var isNoneButtonOn = true;

        // Turn manual mode on.
        // (set 0 fuel as manual fuel)
        //
        FuelIndicator_SetManualFuelRequiredMode(true, isFullButtonOn, isNoneButtonOn);

        isChanged = true;
    }


    // Handle click in fuel gauge by setting to Fuel Required Manual
    // mode at click position.
    //
    var isInFuelGauge = isXyInFuelGaugeArea(xPos, yPos);
    if (isInFuelGauge)
    {
        var isFullButtonOn = false;
        var isNoneButtonOn = false;

        // Set to manual mode
        FuelIndicator_SetManualFuelRequiredMode(true, isFullButtonOn, isNoneButtonOn);

        // StartingFuelRequiredValue is bottom/full height, or 0.
        fuelState.touchStartFuelRequiredVal = 0;

        // Distance from bottom (negative)
        // (up is -, down is +)
        var yDist = (fuelCoords.fuelBottom - yPos) * -1;

        fuelState.manualFuelRequiredValue = calculateManualFuelRequired(yDist);

        // To update in manual mode (on drag)
        //   - set manualFuelRequiredUpdated = true
        //   - call UpdateData_UpdateDependentData()
        //   - call FuelIndicator_UpdateFuelIndicator()
        //   - call UpdateData_ClearDataUpdated()
        //   - set manualFuelRequiredUpdated = false
        //
        fuelState.manualFuelRequiredUpdated = true;
        UpdateData_UpdateDependentData();

        var isForcedUpdate = false;
        FuelIndicator_UpdateFuelIndicator(isForcedUpdate);

        UpdateData_ClearDataUpdated();
        fuelState.manualFuelRequiredUpdated = false
    }

    // Redraw if state changed
    //
    if (isChanged)
    {
        // Redraw if changed.
        //
        // To update in manual mode (on drag)
        //   - set manualFuelRequiredUpdated = true
        //   - call UpdateData_UpdateDependentData()
        //   - call FuelIndicator_UpdateFuelIndicator()
        //   - call UpdateData_ClearDataUpdated()
        //   - set manualFuelRequiredUpdated = false
        //
        fuelState.manualFuelRequiredUpdated = true;
        UpdateData_UpdateDependentData();

        var isForcedUpdate = false;
        FuelIndicator_UpdateFuelIndicator(isForcedUpdate);

        UpdateData_ClearDataUpdated();
        fuelState.manualFuelRequiredUpdated = false;
    }

    return isChanged;
}

function calculateManualFuelRequired(yDist)
{
     // If maxfuel unknown, can't calculate
    var maxFuelVal = serverData.maxFuelVal;
    if ( maxFuelVal <= 0)
    {
        return 0;
    }

    var startingFuelRequiredValue = fuelState.touchStartFuelRequiredVal;

    // Fuel Values are 0 -> maxFuelVal
    // Distance is fuelHeight pixels
    //
    var pixelDistanceRatio = (yDist / fuelCoords.fuelHeight) * -1;
    var fuelDistance = maxFuelVal * pixelDistanceRatio;

    var newFuelValue = startingFuelRequiredValue + fuelDistance;

    //console.log("Start: " + startingFuelRequiredValue + ", End: " + newFuelValue);
    // alert("Start: " + startingFuelRequiredValue + ", End: " + newFuelValue);

    if (newFuelValue < 0)
    {
        newFuelValue = 0;
    }
    else if (newFuelValue > maxFuelVal)
    {
        newFuelValue = maxFuelVal;
    }

    return newFuelValue;
}

function FuelIndicator_SetManualFuelRequiredMode(value, isFullButtonOn, isNoneButtonOn)
{
// if click:
//  - required ON:  Manual mode off, Req On, same as below (also turn off full and none)
//  - required OFF: Manual mode on, Req Off, use current required as manual value, same as below (ensure full and none both off also)
//
//  - fuel gauge adjust: Manual on, calls this function (yes, value of true), sets manualFuelRequiredValue after (do same for full, none; but turn on full none buttons as applicable: also same as Required OFF)
//        - call this with Manual=true; Full=false; None=False
//
//  - press full button: manual on, set manualFuelRequiredValue value to full (req and none off)
//  - press none button: manual on, set manualFuelRequiredValue value to full (req and full off)
//
// Full and none buttons do not toggle off. Turn off with Req On, or fuel gauge adjust.
// Req button can toggle
//

    if (isFullButtonOn==true && isNoneButtonOn==true)
    {
        Console.alert("FuelIndicator_SetManualFuelRequiredMode: both Full and None are true, invalid state. Setting Full On.");
        isNoneOn = false;
    }

    // Set the new mode and look for a mode change.
    // Used to only set the manual value to required value on first call. Mouse move will update
    // it after the call.
    var isModeChange = false;
    if (fuelState.isManualFuelRequiredMode != value)
    {
        isModeChange = true;
        fuelState.isManualFuelRequiredMode = value;
    }

    // Set Manual mode Off (Required: ON)
    if (!value)
    {
        fuelState.manualFuelRequiredValue = 0;

        fuelCoords.fullButtonState = false;
        fuelCoords.noneButtonState = false;
        fuelCoords.requiredButtonState = true;
    }
    // Set Manual mode On
    else
    {
        fuelCoords.requiredButtonState = false;
        fuelCoords.fullButtonState = isFullButtonOn;
        fuelCoords.noneButtonState = isNoneButtonOn;

        // Full button. Setting to manual.
        if (isFullButtonOn == true)
        {
            // If max fuel is known, use it. If not, set to 0.
            // When Max Fuel changes, UpdateDependentData will update
            // this value manualFuelRequiredValue, if the Full button is ON.
            // (not the best design...)
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
        // None button. Setting to manual.
        else if (isNoneButtonOn == true)
        {
            fuelState.manualFuelRequiredValue = 0;
        }
        // Mouse move.
        // Setting to manual, get the current "required" value.
        // (on first set to true only, is called on every move)
        else if (isModeChange)
        {
            var fuelRequiredVal = serverData.fuelRequiredVal;

            // if 'infinity' fuel required, set 0 to be consistent
            // with Fuel Required Tags.
            if (fuelRequiredVal < 0)
            {
                //fuelRequiredVal = maxFuelVal;
                fuelRequiredVal = 0;
            }

            fuelState.manualFuelRequiredValue = fuelRequiredVal;
        }
    }
}

function drawFuelButtonArea(element, buttonText, buttonX, buttonY, buttonWidth, buttonHeight, buttonState, fuelRequiredYPos)
{
    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    // grad looks cool but not very nice on the eyes
    // gradient
    //var grd=ctx.createLinearGradient(buttonX, 0, buttonX+buttonWidth, 0);
    //grd.addColorStop(0,"aqua");
    //grd.addColorStop(1,"black");
    //ctx.fillStyle=grd;


    // border highlight only
    // area
    ctx.fillStyle = "rgb(30,30,30)";
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // border
    ctx.lineWidth = 2;
    if (buttonState)
    {
        ctx.lineWidth = 3;
        ctx.strokeStyle="aqua";
        ctx.fillStyle = "aqua";
    }
    else
    {
        ctx.strokeStyle="rgb(200,200,200)";
        ctx.fillStyle = "rgb(200,200,200)";
    }

    ctx.beginPath();
    ctx.moveTo(buttonX + buttonWidth, buttonY);
    ctx.lineTo(buttonX, buttonY);
    ctx.lineTo(buttonX, buttonY + buttonHeight);
    ctx.lineTo(buttonX + buttonWidth, buttonY + buttonHeight);

    //ctx.lineTo(buttonX + buttonWidth, buttonY);

    // Add a selection border
    //
    if (buttonState)
    {
        var selBorderWidth = 6;

        ctx.moveTo(buttonX + buttonWidth - selBorderWidth, buttonY + selBorderWidth);
        ctx.lineTo(buttonX + selBorderWidth, buttonY + selBorderWidth);

        ctx.moveTo(buttonX + selBorderWidth, buttonY + buttonHeight - selBorderWidth);
        ctx.lineTo(buttonX + buttonWidth - selBorderWidth, buttonY + buttonHeight - selBorderWidth);
    }

    ctx.stroke();

    // add indicator
    if (buttonState)
    {
        ctx.fillStyle = "rgb(30,30,30)";
        ctx.strokeStyle="aqua";

        var arcRadius = 8;
        ctx.beginPath();
        ctx.arc(buttonX, buttonY + buttonHeight/2, arcRadius, 0, 2*Math.PI);
        ctx.fill()
        ctx.stroke();

        // Draw a line from the button to the indicator
        //
        if (serverData.maxFuelVal > 0)
        {
            var midX = (buttonX + fuelCoords.fuelRight) / 2;

            ctx.beginPath();
            ctx.moveTo(buttonX - arcRadius, buttonY + buttonHeight/2);
            ctx.lineTo(midX, buttonY + buttonHeight/2);
            ctx.lineTo(midX, fuelRequiredYPos);
            // +3: light fuel border is actually 3 wider than fuelRight
            ctx.lineTo(fuelCoords.fuelRight + 3, fuelRequiredYPos);
            ctx.stroke();
        }
    }

    // text
    if (buttonText != "")
    {
        if (buttonState)
        {
            ctx.fillStyle = "aqua";
            //ctx.fillStyle = "rgb(200,200,200)";
        }
        else
        {
            ctx.fillStyle = "rgb(200,200,200)";
        }

        ctx.font="30px sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";

        var buttonTextX = buttonX + buttonWidth/2;
        var buttonTextY = buttonY + buttonHeight/2;

        ctx.fillText(buttonText, buttonTextX, buttonTextY);

        // set back to default baseline
        ctx.textBaseline="alphabetic";
    }

}

function isXyInButtonArea(xPos, yPos, buttonX, buttonY, buttonW, buttonH)
{
    if (xPos > buttonX &&
        xPos < buttonX + buttonW &&
        yPos > buttonY &&
        yPos < buttonY + buttonH )
    {
        return true;
    }

    return false;
}

function isXyInFuelGaugeArea(xPos, yPos)
{
    if (xPos >= fuelCoords.fuelLeft &&
        xPos <= fuelCoords.fuelRight &&
        yPos >= fuelCoords.fuelTop &&
        yPos <= fuelCoords.fuelBottom)
    {
        return true;
    }

    return false;
}


// For value to return, pass: "Enough", "Low", or "LowOneLap"
function FuelIndicator_IsEnoughFuel( valueToReturn, fuelLevelVal, fuelRequiredVal, lapsOfFuelVal )
{
    var LOW_LAPS_OF_FUEL = 3;            // <= 3 laps is low
    var LOW_LAPS_OF_FUEL_ONE_LAP = 1;    // <= 1 laps is really low (Pit Now)

    var isEnoughFuel = false;
    var isLowFuel = false;
    var isLowFuelOneLap = false;

    // Enough fuel, pit not required
    if (fuelLevelVal >= fuelRequiredVal)
    {
        isEnoughFuel = true;
        isLowFuel = false;
    }
    // Pit required, low fuel
    else if (lapsOfFuelVal <= LOW_LAPS_OF_FUEL)
    {
        isEnoughFuel = false;
        isLowFuel = true;
        if (lapsOfFuelVal <= LOW_LAPS_OF_FUEL_ONE_LAP)
        {
            isLowFuelOneLap = true;
        }
    }
    // Pit required
    else
    {
        isEnoughFuel = false;
        isLowFuel = false;
    }

    if (valueToReturn == "Enough")
    {
        return isEnoughFuel;
    }
    else if (valueToReturn == "Low")
    {
        return isLowFuel;
    }
    else if (valueToReturn == "LowOneLap")
    {
        return isLowFuelOneLap;
    }
    else
    {
        alert("FuelIndicator_IsEnoughFuel(), invalid parameter: " + valueToReturn);
    }
}
