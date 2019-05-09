
var lapsOfFuelParams = {

    // This doesn't fit on some screens (newer phones are wider and shorter)
    // so leave it off for the released version.
    //
    //drawAheadBehindText: true,
    drawAheadBehindText: false,
}

var lapsOfFuelCoords = {

    canvasWidth: 0,
    canvasHeight: 0,

    // Assign boundary values
    //
    topOffset: 30,
    bottomOffset: 30,
    leftOffset: 30,
    rightOffset: 30,

    top: 0,
    bottom: 0,
    left: 0,
    right: 0,

    width: 0,
    height: 0,

    centerX: 0,
    centerY: 0,

    // Button dimensions (from top-left)
    buttonHeight:0,
    buttonWidth:0,

    autoButtonX:0,
    autoButtonY:0,
    autoButtonWidth:0,

    applyButtonX:0,
    applyButtonY:0,
    applyButtonWidth:0,

    autoApplyButtonGap:20,
    buttonBorderOffset:10,

    // Button state
    autoButtonState:true,
    applyButtonState:false,


    // Flash this area when entering pit road (sending settings)
    applyButtonFlashing:false,
    applyButtonFlashState:false,
    applyButtonFlashCount:0,
    applyButtonFlashInterval:500, // 1/2 second
    // other states besides flashing
    applyButtonApplied:false,
    applyButtonOff:true,
    // colors for states
    applyButtonDefaultColor: "rgb(30,30,30)", //"black",
    applyButtonAppliedColor:"rgb(20, 220, 20)", //green
    applyButtonNotAppliedColor:"rgb(220, 220, 20)", //yellow

    fuelImageOn:false,
    fuelImageFlashing:false,
    fuelImageFlashState:false,
    fuelImageFlashInterval:300,
    fuelImageSize:0,
    fuelImageXPos:0,
    fuelImageYPos:0,

}

var lapsOfFuelState = {

    touchStartX:0,
    touchStartY:0,

    // For button clicks, different area from isTouchDown
    isAutoButtonDown:false,

    isApplyButtonDown:false,

    // Only set to off state once. On state does updates and is set
    // repeatedly, but there is nothing to update for off state.
    //
    isOffPitRoadState:false,

};


function LapsOfFuel_InitIndicator()
{
    var canvasElement = document.getElementById("LapsOfFuelIndicator");

    var isTouchSupported = 'ontouchstart' in window;
    if (isTouchSupported)
    {
        // Register onTouch callbacks
        canvasElement.addEventListener('touchstart', onTouchStartLapsOfFuel);
        canvasElement.addEventListener('touchend', onTouchEndLapsOfFuel);
    }

    canvasElement.addEventListener('click', onClickLapsOfFuelIndicator);

    // - auto resize expands but can't shrink, removed for now
    //   use F5, will still resize on startup -
     // resize the canvas to fill browser window dynamically
    // window.addEventListener('resize', resizeLapsOfFuelCanvas, false);

    // Set initial canvas size, element dimension; then redraw
    resizeLapsOfFuelCanvas();
}

function resizeLapsOfFuelCanvas()
{
    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    var parentElement = document.getElementById("LapsOfFuelIndicatorParent");

    canvasElement.width = parentElement.clientWidth - 2;
    lapsOfFuelCoords.canvasWidth = canvasElement.width;

    // This one is not scaled.
    lapsOfFuelCoords.canvasHeight = canvasElement.height;

    // Recalculate dimensions based on new width.
    calculateLapsOfFuelOffsets();

    var isForcedUpdate = true;
    LapsOfFuel_UpdateIndicator(isForcedUpdate);
}

function calculateLapsOfFuelOffsets()
{
    lapsOfFuelCoords.top = 0 + lapsOfFuelCoords.topOffset;
    lapsOfFuelCoords.bottom = lapsOfFuelCoords.canvasHeight - lapsOfFuelCoords.bottomOffset;
    lapsOfFuelCoords.left = 0 + lapsOfFuelCoords.leftOffset;
    lapsOfFuelCoords.right = lapsOfFuelCoords.canvasWidth - lapsOfFuelCoords.rightOffset;

    lapsOfFuelCoords.width = lapsOfFuelCoords.right - lapsOfFuelCoords.left;
    lapsOfFuelCoords.height = lapsOfFuelCoords.bottom - lapsOfFuelCoords.top;

    lapsOfFuelCoords.centerX = lapsOfFuelCoords.canvasWidth / 2;
    lapsOfFuelCoords.centerY = lapsOfFuelCoords.canvasHeight / 2;

    // Button dimensions (from top-left)

    lapsOfFuelCoords.buttonHeight = 40;
    lapsOfFuelCoords.buttonWidth = (lapsOfFuelCoords.width/2) - (lapsOfFuelCoords.autoApplyButtonGap/2);

    // Auto is smaller than apply, apply takes the rest of width
    lapsOfFuelCoords.autoButtonWidth = lapsOfFuelCoords.buttonWidth * 0.9;
    lapsOfFuelCoords.applyButtonWidth = (lapsOfFuelCoords.buttonWidth*2) - lapsOfFuelCoords.autoButtonWidth;

    lapsOfFuelCoords.applyButtonX = lapsOfFuelCoords.left;
    lapsOfFuelCoords.applyButtonY = lapsOfFuelCoords.bottom - lapsOfFuelCoords.buttonHeight;

    lapsOfFuelCoords.autoButtonX = lapsOfFuelCoords.applyButtonX + lapsOfFuelCoords.applyButtonWidth + lapsOfFuelCoords.autoApplyButtonGap;
    lapsOfFuelCoords.autoButtonY = lapsOfFuelCoords.applyButtonY;
}

// If isForcedUpdate is false, will only update if data has
// changed.
//
function LapsOfFuel_UpdateIndicator( isForcedUpdate )
{
    var canvasElement = document.getElementById("LapsOfFuelIndicator");

    // Check whether the values required by this function have
    // changed before redrawing.
    // (Need to also consider manual mode)
    var isDataUpdated = false;
    if (serverData.fuelLevelUpdated ||
        serverData.fuelRequiredUpdated ||
        serverData.lapsOfFuelUpdated ||
        serverData.remainingLapsMaxUpdated ||
        serverData.carAheadPosUpdated ||
        serverData.carBehindPosUpdated ||
        serverData.carAheadNumberUpdated ||
        serverData.carBehindNumberUpdated ||
        serverData.carAheadInitialsUpdated ||
        serverData.carBehindInitialsUpdated ||
        serverData.carAheadIntervalUpdated ||
        serverData.carBehindIntervalUpdated ||
        serverData.isOnTrackUpdated ||
        serverData.onPitRoadUpdated )
    {
        isDataUpdated = true;
    }


    // If data is unchanged and it's not a forced update, don't draw.
    if ( !isDataUpdated && !isForcedUpdate )
    {
       return;
    }

    var start = new Date().getTime();

    var fuelLevelVal = serverData.fuelLevelVal;
    var fuelRequiredVal = serverData.fuelRequiredVal;
    var lapsOfFuelStr = serverData.lapsOfFuelStr;
    var lapsOfFuelVal = serverData.lapsOfFuelVal;
    var remainingLapsMaxVal = serverData.remainingLapsMaxVal;

    // if 'infinity' fuel required, set 0 to be consistent
    // with Fuel Required Tags.
    if (isNaN(fuelRequiredVal))
    {
        fuelRequiredVal = 0;
    }

    // Calculate Lap of Fuel delta (laps over/under required)
    // laps of fuel - max laps (currently used to calculated fuel required)
    var lapsOfFuelDeltaVal = 0;
    var lapsOfFuelDeltaStr = "";
    if (remainingLapsMaxVal >= 0)
    {
        lapsOfFuelDeltaVal = lapsOfFuelVal - remainingLapsMaxVal;
        lapsOfFuelDeltaStr = lapsOfFuelDeltaVal.toFixed(1);
        if (lapsOfFuelDeltaVal > 0)
        {
            lapsOfFuelDeltaStr = "+" + lapsOfFuelDeltaStr;
        }
    }

    // Assign boundary values
    //
    var textTop = lapsOfFuelCoords.top;
    var centerX = lapsOfFuelCoords.centerX;

    // Draw the Laps of Fuel values
    //
    var ctx = canvasElement.getContext("2d");
    ctx.lineJoin = 'round';

    // Clear screen
    ctx.fillStyle="black";
    ctx.fillRect(0, 0, lapsOfFuelCoords.canvasWidth, lapsOfFuelCoords.canvasHeight);


    var isEnoughFuel =
        FuelIndicator_IsEnoughFuel( "Enough", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );
    var isLowFuel =
        FuelIndicator_IsEnoughFuel( "Low", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );
    var isLowFuelOneLap =
        FuelIndicator_IsEnoughFuel( "LowOneLap", fuelLevelVal, fuelRequiredVal, lapsOfFuelVal );



    var lapsOfFuelTextColor = "rgb(220, 220, 20)";

    // Enough fuel
    if (isEnoughFuel)
    {
        // enough fuel = green
        lapsOfFuelTextColor="rgb(20, 220, 20)";
    }
    // Low fuel, and pit required
    else if (isLowFuel)
    {
        // draw fuel level in red if low fuel
        lapsOfFuelTextColor="red";
    }
    // Not enough fuel, pit required
    else
    {
        // use default color
    }


    var lapsOfFuelTextVOffset = 40;
    var lapsOfFuelTextLineVOffset = 60;
    var lapsOfFuelTextUnderlineLen = 210;


    // Laps of fuel text
    ctx.font="40px sans-serif";
    ctx.textAlign="center";
    ctx.fillStyle="rgb(220, 220, 220)";
    ctx.fillText("laps of fuel", centerX, textTop+lapsOfFuelTextVOffset+(lapsOfFuelTextLineVOffset*0));

    // underline
    ctx.strokeStyle="rgb(220,220,220)";
    ctx.lineWidth = 2;

    ctx.beginPath();

    //0st line
    ctx.moveTo(centerX-(lapsOfFuelTextUnderlineLen/2), textTop);
    ctx.lineTo(centerX+(lapsOfFuelTextUnderlineLen/2), textTop);
    // 1st line
    var line1Y = textTop+(lapsOfFuelTextVOffset*1.25);
    ctx.moveTo(centerX-(lapsOfFuelTextUnderlineLen/2), line1Y);
    ctx.lineTo(centerX+(lapsOfFuelTextUnderlineLen/2), line1Y);
    // 2nd line
    var line2Y = textTop+lapsOfFuelTextLineVOffset+(lapsOfFuelTextVOffset*1.5);
    ctx.moveTo(centerX-(lapsOfFuelTextUnderlineLen/2), line2Y);
    ctx.lineTo(centerX+(lapsOfFuelTextUnderlineLen/2), line2Y);
    // 3rd line
    ctx.moveTo(centerX-(lapsOfFuelTextUnderlineLen/2), textTop+(lapsOfFuelTextLineVOffset*2)+(lapsOfFuelTextVOffset*1.5));
    ctx.lineTo(centerX+(lapsOfFuelTextUnderlineLen/2), textTop+(lapsOfFuelTextLineVOffset*2)+(lapsOfFuelTextVOffset*1.5));

    ctx.stroke();

    // Laps of Fuel value text
    ctx.font="bold 40px sans-serif";
    //ctx.font="40px Verdana";

    ctx.fillStyle = lapsOfFuelTextColor;
    ctx.fillText(lapsOfFuelStr, centerX, textTop+lapsOfFuelTextVOffset+(lapsOfFuelTextLineVOffset*1));

    // Laps of Fuel delta text
    //
    if (lapsOfFuelDeltaStr != ""    &&
        lapsOfFuelStr      != "" )
    {
        ctx.fillStyle = lapsOfFuelTextColor;
        ctx.font="37px sans-serif";
        ctx.fillText("( "+lapsOfFuelDeltaStr+" )", centerX, textTop+(lapsOfFuelTextVOffset)+(lapsOfFuelTextLineVOffset*2.1));
    }


    // Ensure these are set at least once. They are used to draw fuel image but
    // depend on values here.
    lapsOfFuelCoords.fuelImageSize = 44;
    lapsOfFuelCoords.fuelImageXPos = centerX+(lapsOfFuelTextUnderlineLen/2) - lapsOfFuelCoords.fuelImageSize;
    lapsOfFuelCoords.fuelImageYPos = ((line1Y+line2Y)/2) - (lapsOfFuelCoords.fuelImageSize/2);

    // Fuel Light image
    // Flash if need fuel now, otherwise off.
    //
    if (isLowFuelOneLap && lapsOfFuelVal > 0)
    {
        lapsOfFuelCoords.fuelImageOn = true;

        // start flashing, if not already
        if (!lapsOfFuelCoords.fuelImageFlashing)
        {
            lapsOfFuelCoords.fuelImageFlashing = true;
            lapsOfFuelCoords.fuelImageFlashState = true;

            // start timer, don't need redraw here
            setTimeout(
                fuelImageFlashIntervalCallback,
                lapsOfFuelCoords.fuelImageFlashInterval);
        }
    }
    else
    {
        lapsOfFuelCoords.fuelImageOn = false;

        // if flashing, stop
        if (lapsOfFuelCoords.fuelImageFlashing)
        {
            // stop timer
            lapsOfFuelCoords.fuelImageFlashing = false;
            lapsOfFuelCoords.fuelImageFlashState = false;
        }
    }

    drawFuelImage(canvasElement);

    // Draw the Ahead/Behind text
    //
    if (lapsOfFuelParams.drawAheadBehindText)
    {
        drawAheadBehindText(canvasElement, centerX);
    }

    drawButtonBorder(canvasElement, lapsOfFuelCoords.autoButtonState);

    // Add Auto (Auto Apply) button
    // Draw function from FuelIndicator.js (could be common)
    //
    drawApplyButtonArea(canvasElement, "Auto",
                lapsOfFuelCoords.autoButtonX, lapsOfFuelCoords.autoButtonY,
                lapsOfFuelCoords.autoButtonWidth, lapsOfFuelCoords.buttonHeight,
                lapsOfFuelCoords.autoButtonState);

    // Draw the Apply Button
    drawApplyButton(canvasElement);

    var elapsed = new Date().getTime() - start;
    //console.log("DrawLapsOfFuelIndicator: " + elapsed + " ms")
    //alert("DrawLapsOfFuelIndicator: " + elapsed + " ms");
}

function drawApplyButtonArea(element, buttonText, buttonX, buttonY, buttonWidth, buttonHeight, buttonState)
{
    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    if (buttonState)
    {
        ctx.fillStyle= "aqua";
    }
    else
    {
        ctx.fillStyle= "rgb(30,30,30)"; //"grey";
    }

    // area
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // border
    ctx.lineWidth = 2;
    ctx.strokeStyle="rgb(200,200,200)";
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);

    // text
    if (buttonText != "")
    {
        if (buttonState)
        {
            ctx.fillStyle = "black";
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

function drawButtonBorder(element, buttonState)
{
    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    if (buttonState)
    {
        ctx.strokeStyle= "aqua";
    }
    else
    {
        ctx.strokeStyle= "grey";
    }

    var autoBorderX = lapsOfFuelCoords.autoButtonX - (lapsOfFuelCoords.autoApplyButtonGap/2);
    var applyBorderX = lapsOfFuelCoords.applyButtonX - lapsOfFuelCoords.buttonBorderOffset;

    var applyBorderWidth = autoBorderX - applyBorderX;
    var autoBorderWidth = (lapsOfFuelCoords.autoApplyButtonGap/2) + lapsOfFuelCoords.autoButtonWidth + lapsOfFuelCoords.buttonBorderOffset;

    var borderY = lapsOfFuelCoords.autoButtonY - lapsOfFuelCoords.buttonBorderOffset;
    var borderHeight = (lapsOfFuelCoords.autoButtonY + lapsOfFuelCoords.buttonHeight + lapsOfFuelCoords.buttonBorderOffset) - borderY;

    // border
    ctx.lineWidth = 2;
    //ctx.strokeStyle="rgb(200,200,200)";
    ctx.strokeRect(autoBorderX, borderY, autoBorderWidth, borderHeight);
    ctx.strokeRect(applyBorderX, borderY, applyBorderWidth, borderHeight);
}


function onTouchStartLapsOfFuel(e)
{
    var touchobj = e.changedTouches[0]; // reference first touch point (ie: first finger)
    startx = parseInt(touchobj.clientX); // get x position of touch point relative to left edge of browser
    starty = parseInt(touchobj.clientY); // get x position of touch point relative to left edge of browser

    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);

    var xPos = startx - boundingRect.left;
    var yPos = starty - boundingRect.top;

    // Increase the touch height x2 to make it easier to touch
    //
    var topExtra = lapsOfFuelCoords.buttonHeight/2;
    var bottomExtra = lapsOfFuelCoords.bottomOffset;

    var leftExtra = (lapsOfFuelCoords.leftOffset);
    var rightExtra = (lapsOfFuelCoords.rightOffset);
    var middleExtra = (lapsOfFuelCoords.autoApplyButtonGap/2);

    // If within button area.
    //
    if (isXyInButtonArea(
        xPos, yPos,
        lapsOfFuelCoords.autoButtonX - leftExtra,
        lapsOfFuelCoords.autoButtonY - topExtra,
        lapsOfFuelCoords.autoButtonWidth + leftExtra + middleExtra,
        lapsOfFuelCoords.buttonHeight + topExtra + bottomExtra ))
    {
        // don't bother with offsets, just getting difference
        lapsOfFuelState.touchStartX = startx;
        lapsOfFuelState.touchStartY = starty;
        lapsOfFuelState.isAutoButtonDown = true;

        // only do this if button is clicked so scroll is still allowed
        //e.preventDefault();
    }

    if (isXyInButtonArea(
        xPos, yPos,
        lapsOfFuelCoords.applyButtonX - middleExtra,
        lapsOfFuelCoords.applyButtonY - topExtra,
        lapsOfFuelCoords.applyButtonWidth + middleExtra + rightExtra,
        lapsOfFuelCoords.buttonHeight + topExtra + bottomExtra ))
    {
        // don't bother with offsets, just getting difference
        lapsOfFuelState.touchStartX = startx;
        lapsOfFuelState.touchStartY = starty;
        lapsOfFuelState.isApplyButtonDown = true;

        // only do this if button is clicked so scroll is still allowed
        //e.preventDefault();
    }

    // always do this, to prevent any double tap or scroll in this element.
    e.preventDefault();
 }



function onTouchEndLapsOfFuel(e)
{
    var touchobj = e.changedTouches[0];
    var startx = parseInt(touchobj.clientX);
    var starty = parseInt(touchobj.clientY);

    // Get X,Y dist from start point
    var distX = startx - lapsOfFuelState.touchStartX;
    var distY = starty - lapsOfFuelState.touchStartY;

    if (lapsOfFuelState.isAutoButtonDown || lapsOfFuelState.isApplyButtonDown)
    {
        // Max amount of move to be a click
        var clickMaxDist = 20;

        var absDistX = Math.abs(distX);
        var absDistY = Math.abs(distY);

        if (absDistX < clickMaxDist && absDistY < clickMaxDist)
        {
            var canvasElement = document.getElementById("LapsOfFuelIndicator");
            var boundingRect = irPitCrew_getOffset(canvasElement);

            // Get X,Y of START point
            var xPos = lapsOfFuelState.touchStartX - boundingRect.left;
            var yPos = lapsOfFuelState.touchStartY - boundingRect.top;

            var isChanged = handleOnClickLapsOfFuelIndicatorEvent(xPos, yPos);

            // done in function
            //var isForcedUpdate = true;
            //FuelIndicator_UpdateFuelIndicator(isForcedUpdate);
        }

        // only do this if button is clicked so scroll is still allowed
        //e.preventDefault();
    }

    lapsOfFuelState.touchStartX = 0;
    lapsOfFuelState.touchStartY = 0;
    lapsOfFuelState.isAutoButtonDown = false;
    lapsOfFuelState.isApplyButtonDown = false;

    // always do this, to prevent any double tap or scroll in this element.
    e.preventDefault();
}


 function onClickLapsOfFuelIndicator(event)
{
    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);

    var xPos = event.pageX - boundingRect.left;
    var yPos = event.pageY - boundingRect.top;

    var isChanged = handleOnClickLapsOfFuelIndicatorEvent(xPos, yPos);

//    event.preventDefault();
}


function handleOnClickLapsOfFuelIndicatorEvent(xPos, yPos)
{
    var canvasElement = document.getElementById("LapsOfFuelIndicator");

    var isAutoClicked = false;
    var isAutoChanged = false;

    var isApplyClicked = false;

    // Increase the touch height x2 to make it easier to touch
    //
    var topExtra = lapsOfFuelCoords.buttonHeight/2;
    var bottomExtra = lapsOfFuelCoords.bottomOffset;

    var leftExtra = (lapsOfFuelCoords.leftOffset);
    var rightExtra = (lapsOfFuelCoords.rightOffset);
    var middleExtra = (lapsOfFuelCoords.autoApplyButtonGap/2);

    // Auto button.
    //
    isAutoClicked = isXyInButtonArea(
        xPos, yPos,
        lapsOfFuelCoords.autoButtonX - leftExtra,
        lapsOfFuelCoords.autoButtonY - topExtra,
        lapsOfFuelCoords.autoButtonWidth + leftExtra + middleExtra,
        lapsOfFuelCoords.buttonHeight + topExtra + bottomExtra );

    isApplyClicked = isXyInButtonArea(
        xPos, yPos,
        lapsOfFuelCoords.applyButtonX - middleExtra,
        lapsOfFuelCoords.applyButtonY - topExtra,
        lapsOfFuelCoords.applyButtonWidth + middleExtra + rightExtra,
        lapsOfFuelCoords.buttonHeight + topExtra + bottomExtra );

    if (isAutoClicked)
    {
        if (lapsOfFuelCoords.autoButtonState)
        {
            // Turn auto mode off
            //
            lapsOfFuelCoords.autoButtonState = false;
        }
        else
        {
            // Turn manual mode on
            lapsOfFuelCoords.autoButtonState = true;
        }

        isAutoChanged = true;
    }
    else if (isApplyClicked)
    {
        // handles redraw
        irPitCrew_onSendButton();
    }

    // Redraw if state changed
    //
    if (isAutoChanged)
    {
        // Redraw if changed.
        //
        drawButtonBorder(canvasElement, lapsOfFuelCoords.autoButtonState);

        // Add Auto (Auto Apply) button
        // Draw function from FuelIndicator.js (could be common)
        //
        drawApplyButtonArea(canvasElement, "Auto",
                lapsOfFuelCoords.autoButtonX, lapsOfFuelCoords.autoButtonY,
                lapsOfFuelCoords.autoButtonWidth, lapsOfFuelCoords.buttonHeight,
                lapsOfFuelCoords.autoButtonState);
    }

    return isAutoChanged;
}

function drawAheadBehindText(canvas, centerX)
{
    var ctx = canvas.getContext("2d");

    // left aligned
    var posXOffset = -130;
    var numberXOffset = posXOffset + 45;
    var initialsXOffset = numberXOffset + 75;

    //var posXOffset = -130;
    //var numberXOffset = posXOffset + 0;
    //var initialsXOffset = numberXOffset + 75;

    // right aligned
    var intervalXOffset = 130;

    var aheadPosStr = serverData.carAheadPosStr;
    var behindPosStr = serverData.carBehindPosStr;
    var aheadNumberStr = serverData.carAheadNumberStr;
    var behindNumberStr = serverData.carBehindNumberStr;
    var aheadInitialsStr = serverData.carAheadInitialsStr;
    var behindInitialsStr = serverData.carBehindInitialsStr;


    // Display the Ahead/Behind values
    //

    ctx.textAlign="left";
    ctx.fillStyle="rgb(220, 220, 220)";
    ctx.font="28px sans-serif";

    // Pos
    //

    if (aheadPosStr.length > 0 &&
        serverData.carAheadPosVal >= 0)
    {
        ctx.fillText(aheadPosStr, centerX + posXOffset, lapsOfFuelCoords.bottom - 125);
    }
    else
    {
        var aheadStr = "\u2191";
        //var aheadStr = "22";
        ctx.fillText(aheadStr, centerX + posXOffset, lapsOfFuelCoords.bottom - 125);
    }
    if (behindPosStr.length > 0 &&
        serverData.carBehindPosVal >= 0)
    {
        ctx.fillText(behindPosStr, centerX + posXOffset, lapsOfFuelCoords.bottom - 75);
    }
    else
    {
        var behindStr = "\u2193";
        ctx.fillText(behindStr, centerX + posXOffset, lapsOfFuelCoords.bottom - 75);
    }


    // Number
    //
    if (aheadNumberStr.length > 0)
    {
        var numberStr = "#" + aheadNumberStr;

        ctx.fillText(numberStr, centerX + numberXOffset, lapsOfFuelCoords.bottom - 125);
    }
    else
    {
        var numberStr = "#";
        //var numberStr = "\u2191";
        ctx.fillText(numberStr, centerX + numberXOffset, lapsOfFuelCoords.bottom - 125);
    }
    if (behindNumberStr.length > 0)
    {
        var numberStr = "#" + behindNumberStr;

        ctx.fillText(numberStr, centerX + numberXOffset, lapsOfFuelCoords.bottom - 75);
    }
    else
    {
        var numberStr = "#";
        //var numberStr = "\u2193";
        ctx.fillText(numberStr, centerX + numberXOffset, lapsOfFuelCoords.bottom - 75);
    }

    // Initials
    //
    if (aheadInitialsStr.length > 0)
    {
        ctx.fillText(aheadInitialsStr, centerX + initialsXOffset, lapsOfFuelCoords.bottom - 125);
    }

    if (behindInitialsStr.length > 0)
    {
        ctx.fillText(behindInitialsStr, centerX + initialsXOffset, lapsOfFuelCoords.bottom - 75);
    }


    // Interval
    //
    ctx.textAlign="right";
    ctx.fillStyle = "rgb(220,220,20)";
    ctx.font="30px sans-serif";

    var aheadIntervalStr = "--:--";

    if (serverData.carAheadIntervalStr != "" &&
        serverData.carAheadIntervalStr != "&infin;")
    {
        aheadIntervalStr = serverData.carAheadIntervalStr;
    }

    ctx.fillText(aheadIntervalStr, centerX + intervalXOffset, lapsOfFuelCoords.bottom - 125);


    var behindIntervalStr = "--:--";

    if (serverData.carBehindIntervalStr != "" &&
        serverData.carBehindIntervalStr != "&infin;")
    {
        behindIntervalStr = serverData.carBehindIntervalStr;
    }

    ctx.fillText(behindIntervalStr, centerX + intervalXOffset, lapsOfFuelCoords.bottom - 75 );

}


// Flash, Sending Pit Settings
function LapsOfFuelIndicator_SetOnPitRoadState()
{
    //console.log("LapsOfFuelIndicator_SetOnPitRoadState");

    // If already on, do nothing.
    if (lapsOfFuelCoords.applyButtonFlashing)
    {
        lapsOfFuelCoords.applyButtonFlashCount = 1;
        return;
    }

    var canvasElement = document.getElementById("LapsOfFuelIndicator");

    lapsOfFuelCoords.applyButtonFlashing = true;
    lapsOfFuelCoords.applyButtonApplied = true;
    lapsOfFuelCoords.applyButtonOff = false;

    lapsOfFuelCoords.applyButtonFlashState = true;
    lapsOfFuelCoords.applyButtonFlashCount = 1;

    // Calculate Fuel to add str here from fuel to add Val for comparison
    createFuelToAddString();

    // Set "last applied" values
    //
    globalData.fuelToAddVal_LastApplied = dependentData.fuelToAddVal;
    globalData.fuelToAddStr_LastApplied = globalData.fuelToAddStr_Current;
    globalData.leftFront_LastApplied = tireState.leftFront;
    globalData.rightFront_LastApplied = tireState.rightFront;
    globalData.leftRear_LastApplied = tireState.leftRear;
    globalData.rightRear_LastApplied = tireState.rightRear;

    drawApplyButton(canvasElement);

    // Start a timer/interval to flash the Button when entering pit road.
    //
    setTimeout(
        applyFlashIntervalCallback,
        lapsOfFuelCoords.applyButtonFlashInterval);
}

function applyFlashIntervalCallback()
{
    //console.log("applyFlashIntervalCallback")

    // If turned off, do nothing.
    // To ignore any remaining timeout callbacks that would otherwise end
    // reset to an OnPitRoad state after turning the Toggle off.
    // (display and state update has already been handled)
    if (!lapsOfFuelCoords.applyButtonFlashing)
    {
        return;
    }

    lapsOfFuelCoords.applyButtonFlashState = lapsOfFuelCoords.applyButtonFlashState ? false : true;
    lapsOfFuelCoords.applyButtonFlashCount++;

    // 4 flashes when crossing the line (Pit data sent)
    // then stay on until leaving pit road.
    if (lapsOfFuelCoords.applyButtonFlashCount >= 9)
    {
        lapsOfFuelCoords.applyButtonFlashing = false;
        //lapsOfFuelCoords.applyButtonFlashState = false;
        // Leave it on, turns off when leaving pits
        // (To indicate at a glance that Pit Values have been sent)
        //
        lapsOfFuelCoords.applyButtonFlashState = false; //true; //...let update handle this

        lapsOfFuelCoords.applyButtonFlashCount = 1;
    }
    else
    {
        setTimeout(
            applyFlashIntervalCallback,
            lapsOfFuelCoords.applyButtonFlashInterval);
    }

    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    drawApplyButton(canvasElement);
}

function LapsOfFuelIndicator_SetOffPitRoadState()
{
    //console.log("LapsOfFuelIndicator_SetOffPitRoadState " + lapsOfFuelState.isOffPitRoadState);

    // Set to true so that calls to SetOffPitRoadState() do nothing
    // if already off. There is nothing to update.
    // For UpdatePitRoadAppliedState(), the button is kept up to date, see below.
    //
    if (lapsOfFuelState.isOffPitRoadState == true)
    {
        return;
    }
    lapsOfFuelState.isOffPitRoadState = true;

    // Set no longer on.
    // Ignore any remaining timeout callback.
    lapsOfFuelCoords.applyButtonFlashing = false;

    lapsOfFuelCoords.applyButtonApplied = false;
    lapsOfFuelCoords.applyButtonOff = true;

    // Set to default color.
    lapsOfFuelCoords.applyButtonFlashState = false;
    lapsOfFuelCoords.applyButtonFlashCount = 1;

    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    drawApplyButton(canvasElement);

    // Set values to not applied on leaving the pit as they have now
    // been applied and the iRacing pit controls reset.
    // (ie, if set Full Fuel, All Tires iRacing checks will be reset.
    //  If Auto Apply is off, will need to apply before next pit, so
    //  should not say Applied.)
    //
    globalData.fuelToAddStr_LastApplied = "NotApplied";
}

function LapsOfFuelIndicator_UpdatePitRoadAppliedState()
{
    lapsOfFuelState.isOffPitRoadState = false;

    // called when on pit road, so area not off.
    lapsOfFuelCoords.applyButtonOff = false;


    lapsOfFuelCoords.applyButtonApplied = true;

    // compare current fuelRequired, fuelToAdd, Tires settings to "last applied" saved on apply

    // if tires changed, not applied

    // for fuel, fuelRequired changes by 1/2 lap, check whether fuel to add has changed by 1/2 lap
    // (this will still turn yellow in manual mode if set earlier)
    // could just set if fuelToAdd changes... will turn yellow during refuel (ok for now...)

    var fuelTolerance = serverData.estimatedLapFuelVal/2;
    var fuelDifference = Math.abs(dependentData.fuelToAddVal - globalData.fuelToAddVal_LastApplied);

    // Calculate Fuel to add str here from fuel to add Val for comparison
    createFuelToAddString();

    // Value on startup, and after leaving pits.
    //
    if (globalData.fuelToAddStr_LastApplied == "NotApplied")
    {
        lapsOfFuelCoords.applyButtonApplied = false;
    }

    // If the string hasn't changed, no difference (full, none, or same value)
    if (globalData.fuelToAddStr_Current == globalData.fuelToAddStr_LastApplied)
    {
        fuelDifference = 0;
    }

    // console.log("add " + dependentData.fuelToAddVal);
    // console.log("fuelTolerance " + fuelTolerance);
    // console.log("fuelDifference " + fuelDifference);

    if (fuelTolerance > 0)
    {
        if (fuelDifference > fuelTolerance)
        {
            lapsOfFuelCoords.applyButtonApplied = false;
        }
    }

    if (tireState.leftFront  != globalData.leftFront_LastApplied  ||
        tireState.rightFront != globalData.rightFront_LastApplied ||
        tireState.leftRear   != globalData.leftRear_LastApplied   ||
        tireState.rightRear  != globalData.rightRear_LastApplied )
    {
        lapsOfFuelCoords.applyButtonApplied = false;
    }

    // will draw on next update (this is a 1/2 second delay...)
    // this is called every update, not on state transitions, so don't want to draw every time.
    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    drawApplyButton(canvasElement);
}

function createFuelToAddString()
{
    var fuelToAddVal = dependentData.fuelToAddVal;
    var fuelLevelVal = serverData.fuelLevelVal;
    var maxFuelVal = serverData.maxFuelVal;
    var spaceInTank = 0;
    if (maxFuelVal > 0)
    {
        spaceInTank = maxFuelVal - fuelLevelVal;
    }

    // Calculate the fuel to add state string (none, full, or <value>)
    //
    if (fuelToAddVal <= 0)
    {
        globalData.fuelToAddStr_Current = "None";
    }
    else if (maxFuelVal > 0 && fuelToAddVal >= spaceInTank)
    {
        globalData.fuelToAddStr_Current = "Full";
    }
    else
    {
        globalData.fuelToAddStr_Current = fuelToAddVal.toFixed(0);
    }
}

function drawApplyButton(element)
{
    var buttonText = "";
    var textColor = "black";

    //console.log("drawApplyButton");

    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    // hide button (or show as disabled) when not on track
    //
    if (!serverData.isOnTrackBool)
    {
        //ctx.fillStyle = lapsOfFuelCoords.applyButtonDefaultColor;

        // Use disabled color
        buttonText = "Apply"
        ctx.fillStyle = "rgb(30,30,30)";
        textColor = "rgb(100,100,100)";
    }
    else if (lapsOfFuelCoords.applyButtonFlashing)
    {
        if (!lapsOfFuelCoords.applyButtonFlashState)
        {
            ctx.fillStyle = lapsOfFuelCoords.applyButtonDefaultColor;

            buttonText = "Applied"
            textColor = "rgb(200,200,200)";
        }
        else
        {
            ctx.fillStyle= lapsOfFuelCoords.applyButtonAppliedColor;

            buttonText = "Applied"
        }
    }
    else
    {
        // not flashing, so either off, applied, not applied.

        // Apply is off or not on pit road, set to default if not flashing
        //
        if (lapsOfFuelCoords.applyButtonOff || !globalData.onTrackOnPitRoadBool)
        {
            ctx.fillStyle = lapsOfFuelCoords.applyButtonDefaultColor;

            buttonText = "Apply"
            textColor = "rgb(200,200,200)";
        }
        else if (lapsOfFuelCoords.applyButtonApplied)
        {
            ctx.fillStyle = lapsOfFuelCoords.applyButtonAppliedColor;

            buttonText = "Applied"
        }
        else
        {
            // On and not applied
            ctx.fillStyle = lapsOfFuelCoords.applyButtonNotAppliedColor;

            buttonText = "Apply";
        }
    }

    ctx.fillRect(lapsOfFuelCoords.applyButtonX, lapsOfFuelCoords.applyButtonY, lapsOfFuelCoords.applyButtonWidth, lapsOfFuelCoords.buttonHeight);

    ctx.lineWidth = 2;
    ctx.strokeStyle="rgb(200,200,200)";
    ctx.strokeRect(lapsOfFuelCoords.applyButtonX, lapsOfFuelCoords.applyButtonY, lapsOfFuelCoords.applyButtonWidth, lapsOfFuelCoords.buttonHeight);


    if (buttonText != "")
    {
        // text
        ctx.fillStyle = textColor;
        ctx.font="30px sans-serif";
        ctx.textAlign="center";
        ctx.textBaseline="middle";

        var buttonTextX = lapsOfFuelCoords.applyButtonX + lapsOfFuelCoords.applyButtonWidth/2;
        var buttonTextY = lapsOfFuelCoords.applyButtonY + lapsOfFuelCoords.buttonHeight/2;

        ctx.fillText(buttonText, buttonTextX, buttonTextY);

        // set back to default baseline
        ctx.textBaseline="alphabetic";
    }
}

// Fuel Light image
function drawFuelImage(element)
{
    // do nothing until images loaded
    if (!fuelParams.isFuelOnImageLoaded || !fuelParams.isFuelOffImageLoaded)
    {
        return;
    }

    var fuelImageSize = lapsOfFuelCoords.fuelImageSize;
    var fuelImageXPos = lapsOfFuelCoords.fuelImageXPos;
    var fuelImageYPos = lapsOfFuelCoords.fuelImageYPos;

    if (fuelImageXPos == 0 || fuelImageYPos == 0 || fuelImageSize == 0)
    {
        return;
    }

    var ctx = element.getContext("2d");

    // Flashing
    if (lapsOfFuelCoords.fuelImageFlashing)
    {
        if (lapsOfFuelCoords.fuelImageFlashState)
        {
            ctx.drawImage(fuelOnImage, fuelImageXPos, fuelImageYPos, fuelImageSize, fuelImageSize);
        }
        else
        {
            ctx.drawImage(fuelOffImage, fuelImageXPos, fuelImageYPos, fuelImageSize, fuelImageSize);
        }
    }
    // On
    else if (lapsOfFuelCoords.fuelImageOn)
    {
        ctx.drawImage(fuelOnImage, fuelImageXPos, fuelImageYPos, fuelImageSize, fuelImageSize);
    }
    // Off
    else
    {
        ctx.drawImage(fuelOffImage, fuelImageXPos, fuelImageYPos, fuelImageSize, fuelImageSize);
    }

}


function fuelImageFlashIntervalCallback()
{
    // If turned off, do nothing.
    // To ignore any remaining timeout callbacks.
    //
    if (!lapsOfFuelCoords.fuelImageFlashing)
    {
        return;
    }

    lapsOfFuelCoords.fuelImageFlashState = lapsOfFuelCoords.fuelImageFlashState ? false : true;

    setTimeout(
        fuelImageFlashIntervalCallback,
        lapsOfFuelCoords.fuelImageFlashInterval);

    var canvasElement = document.getElementById("LapsOfFuelIndicator");
    drawFuelImage(canvasElement);
}
