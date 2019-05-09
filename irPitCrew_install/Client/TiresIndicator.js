
// global state data
var tireState = {
    leftFront:false,
    rightFront:false,
    leftRear:false,
    rightRear:false,
    center:false,

    isTouchDown:false,
    touchStartX:0,
    touchStartY:0,
};

// Tire coords for drawing and click locating
// XY values are tire center.
var tireCoords = {

    canvasWidth: 0,
    canvasHeight: 0,

    // all tires
    tiresTop:0,
    tiresBottom:0,
    tiresRight:0,
    tiresLeft:0,

    tiresWidth:0,
    tiresHeight:0,

    // one tire
    tireWidth:0,
    tireHeight:0,

    markerWidth:0,
    markerHeight:0,

    leftFrontX:0,
    leftFrontY:0,

    rightFrontX:0,
    rightFrontY:0,

    leftRearX:0,
    leftRearY:0,

    rightRearX:0,
    rightRearY:0,

    centerX:0,
    centerY:0,
};


function TiresIndicator_InitTiresIndicator()
{
    var canvasElement = document.getElementById("TiresIndicator");

    var isTouchSupported = 'ontouchstart' in window;

    if (isTouchSupported)
    {
        // Register onTouch callbacks
        canvasElement.addEventListener('touchstart', onTouchStartTires, false);
        canvasElement.addEventListener('touchend', onTouchEndTires, false);
    }

    // Register onClick callback
    canvasElement.addEventListener('click', onClickTiresIndicator, false);

    // - auto resize expands but can't shrink, removed for now,
    // - use F5, will still resize on startup

    // resize the canvas to fill browser window dynamically
    // window.addEventListener('resize', resizeTiresCanvas, false);

    resizeTiresCanvas();
}


function resizeTiresCanvas()
{
    var canvasElement = document.getElementById("TiresIndicator");
    var parentElement = document.getElementById("TiresIndicatorParent");

    canvasElement.width = parentElement.clientWidth - 2;

    tireCoords.canvasWidth = canvasElement.width;

    // This one is not scaled.
    tireCoords.canvasHeight = canvasElement.height;

    // Recalculate dimensions based on new width.
    calculateTiresOffsets();

    // Update display
    DrawTiresIndicator();
}

function calculateTiresOffsets()
{
    // Assign boundary values
    //
    var tiresTopOffset = 80;
    var tiresBottomOffset = 80;
    var tiresRightOffset = 80;
    var tiresLeftOffset = 80;

    // These could be a problem for smaller screens
    // (I suppose all of my pixel offsets could)
    tireCoords.tiresWidth = 150;

    tireCoords.tiresTop = 0 + tiresTopOffset;
    tireCoords.tiresBottom = tireCoords.canvasHeight - tiresBottomOffset;
    // to center vertically w/ hardcoded width
    // tireCoords.tiresTop = (tireCoords.canvasHeight - tireCoords.tiresHeight) / 2;
    // tireCoords.tiresBottom = tireCoords.tiresTop + tireCoords.tiresHeight;

    tireCoords.tiresLeft = 0 + tiresLeftOffset;
    tireCoords.tiresRight = tireCoords.tiresLeft + tireCoords.tiresWidth;

    tireCoords.tiresHeight = tireCoords.tiresBottom - tireCoords.tiresTop;

    //To apply a max height (ratio) to the tires...
    //var HWRatio = tireCoords.tiresHeight / tireCoords.tiresWidth;
    //if (HWRatio > 1.5)
    //{
    //  var oldTiresHeight = tireCoords.tiresHeight;
    //  tireCoords.tiresHeight = tireCoords.tiresWidth * 1.5;
    //  var diff = oldTiresHeight - tireCoords.tiresHeight;

    //  tiresTopOffset += (diff/2);
    //  tiresBottomOffset += (diff/2);
    //  tireCoords.tiresTop = 0 + tiresTopOffset;
    //  tireCoords.tiresBottom = tireCoords.canvasHeight - tiresBottomOffset;
    //}


    // Set to coords object
    //
    tireCoords.leftFrontX = tireCoords.tiresLeft;
    tireCoords.leftFrontY = tireCoords.tiresTop;

    tireCoords.rightFrontX = tireCoords.tiresRight;
    tireCoords.rightFrontY = tireCoords.tiresTop;

    tireCoords.leftRearX = tireCoords.tiresLeft;
    tireCoords.leftRearY =  tireCoords.tiresBottom;

    tireCoords.rightRearX = tireCoords.tiresRight;
    tireCoords.rightRearY = tireCoords.tiresBottom;

    tireCoords.tireWidth = 40;
    tireCoords.tireHeight = 80;

    // draw half this size, but still easy to click.
    tireCoords.markerWidth = 100; //40;
    tireCoords.markerHeight = 100; //40;

    tireCoords.centerX = (tireCoords.leftFrontX + tireCoords.rightFrontX) / 2;
    tireCoords.centerY = (tireCoords.leftFrontY + tireCoords.leftRearY) / 2;

    tireCoords.leftX = tireCoords.leftFrontX;
    tireCoords.leftY = tireCoords.centerY;

    tireCoords.topX = tireCoords.centerX;
    tireCoords.topY = tireCoords.leftFrontY;

    tireCoords.rightX = tireCoords.rightFrontX;
    tireCoords.rightY = tireCoords.centerY;

    tireCoords.bottomX = tireCoords.centerX;
    tireCoords.bottomY = tireCoords.leftRearY;
}

function TiresIndicator_UpdateTiresIndicator(isForcedUpdate)
{
    // Check if changed, then draw.
    // Only changes are tire pressure values, others call
    // DrawTiresIndicator directly from callbacks,
    // so nothing to do.
    //

    //DrawTiresIndicator();
}



function DrawTiresIndicator()
{
    var canvasElement = document.getElementById("TiresIndicator");;

    var ctx = canvasElement.getContext("2d");

    console.log("Update TiresIndicator");

    // Clear screen
    ctx.fillStyle= "black";
    ctx.fillRect(0, 0, tireCoords.canvasWidth, tireCoords.canvasHeight);

    // Draw Frame
    ctx.lineWidth = 1;
    ctx.strokeStyle="rgb(220,220,220)";
    ctx.strokeRect(tireCoords.tiresLeft+(tireCoords.tireWidth/2), tireCoords.tiresTop, tireCoords.tiresWidth-(tireCoords.tireWidth), tireCoords.tiresHeight);

    // Draw areas
    drawTireArea(canvasElement, tireCoords.leftFrontX, tireCoords.leftFrontY, tireState.leftFront);
    drawTireArea(canvasElement, tireCoords.rightFrontX, tireCoords.rightFrontY, tireState.rightFront);
    drawTireArea(canvasElement, tireCoords.leftRearX, tireCoords.leftRearY, tireState.leftRear);
    drawTireArea(canvasElement, tireCoords.rightRearX, tireCoords.rightRearY, tireState.rightRear);

    drawMarkerArea(canvasElement, tireCoords.centerX, tireCoords.centerY, tireState.center);
}

function onClickTiresIndicator(event)
{
    var canvasElement = document.getElementById("TiresIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);

    var xPos = event.pageX - boundingRect.left;
    var yPos = event.pageY - boundingRect.top;

    var isChanged = handleOnClickTiresIndicatorEvent(xPos, yPos);


    event.preventDefault();
}

function handleOnClickTiresIndicatorEvent(xPos, yPos)
{
    var isClicked = false;
    var isChanged = false;

    // Left Front
    isClicked = isXyInTireArea(xPos, yPos, tireCoords.leftFrontX, tireCoords.leftFrontY);
    if (isClicked)
    {
        if (tireState.leftFront)
        {
            tireState.leftFront = false;
        }
        else
        {
            tireState.leftFront = true;
        }

        isChanged = true;
    }

    // Right Front
    isClicked = isXyInTireArea(xPos, yPos, tireCoords.rightFrontX, tireCoords.rightFrontY);
    if (isClicked)
    {
        if (tireState.rightFront)
        {
            tireState.rightFront = false;
        }
        else
        {
            tireState.rightFront = true;
        }

        isChanged = true;
    }

    // Left Rear
    isClicked = isXyInTireArea(xPos, yPos, tireCoords.leftRearX, tireCoords.leftRearY);
    if (isClicked)
    {
        if (tireState.leftRear)
        {
            tireState.leftRear = false;
        }
        else
        {
            tireState.leftRear = true;
        }

        isChanged = true;
    }

    // Right Rear
    isClicked = isXyInTireArea(xPos, yPos, tireCoords.rightRearX, tireCoords.rightRearY);
    if (isClicked)
    {
        if (tireState.rightRear)
        {
            tireState.rightRear = false;
        }
        else
        {
            tireState.rightRear = true;
        }

        isChanged = true;
    }

    // Center
    isClicked = isXyInMarkerArea(xPos, yPos, tireCoords.centerX, tireCoords.centerY);
    // Center clicked, update all
    if (isClicked)
    {
        if (tireState.center)
        {
            tireState.center = false;
        }
        else
        {
            tireState.center = true;
        }

        tireState.leftFront = tireState.center;
        tireState.rightFront = tireState.center;
        tireState.leftRear = tireState.center;
        tireState.rightRear = tireState.center;

        isChanged = true;
    }

    // Redraw if state changed
    //
    if (isChanged)
    {
        // Center
        // Update center state if required.
        // If any checked, center is checked,
        // otherwise center unchecked.
        if (tireState.leftFront ||
            tireState.rightFront ||
            tireState.leftRear ||
            tireState.rightRear )
        {
            tireState.center = true;
        }
        else
        {
            tireState.center = false;
        }

        // Redraw if changed.
        DrawTiresIndicator();
    }

    return isChanged;
}

function drawTireArea(element, tireX, tireY, tireState)
{
    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    var detailColor;
    if (tireState)
    {
        ctx.fillStyle = "aqua";
        detailColor = "rgb(30,30,30)";
    }
    else
    {
        ctx.fillStyle = "rgb(30,30,30)";
        detailColor = "black";
    }

    var tireLeft = tireX-(tireCoords.tireWidth/2);
    var tireRight = tireX+(tireCoords.tireWidth/2);
    var tireTop = tireY-(tireCoords.tireHeight/2);
    var tireBottom = tireY+(tireCoords.tireHeight/2);

    var cornerRadius = tireCoords.tireWidth * 0.3;

    ctx.beginPath();

    ctx.moveTo(tireLeft, tireTop+cornerRadius);
    ctx.arcTo(tireLeft, tireTop, tireLeft+cornerRadius, tireTop, cornerRadius);

    ctx.lineTo(tireRight-cornerRadius, tireTop)
    ctx.arcTo(tireRight, tireTop, tireRight, tireTop+cornerRadius, cornerRadius);

    ctx.lineTo(tireRight, tireBottom-cornerRadius);
    ctx.arcTo(tireRight, tireBottom, tireRight-cornerRadius, tireBottom, cornerRadius);

    ctx.lineTo(tireLeft+cornerRadius, tireBottom);
    ctx.arcTo(tireLeft, tireBottom, tireLeft, tireBottom-cornerRadius, cornerRadius);

    ctx.lineTo(tireLeft, tireTop+cornerRadius);

    ctx.fill();


    // Add details
    //
    ctx.lineWidth = 1;
    ctx.strokeStyle = detailColor;

    ctx.beginPath();
    // add vertical lines
    var numLines = 5;
    for (lineIndex=1;lineIndex<numLines;++lineIndex)
    {
        ctx.moveTo(tireLeft + (tireCoords.tireWidth * lineIndex / numLines), tireTop);
        ctx.lineTo(tireLeft + (tireCoords.tireWidth * lineIndex / numLines), tireBottom);
    }
    // add outside lines
    numLines = 8;
    // vary by 1/4 of one iteration to add angle to outside lines
    var angle = (tireCoords.tireHeight/numLines)/4;
    for (lineIndex=1;lineIndex<numLines;++lineIndex)
    {
        var yPos = tireTop + (tireCoords.tireHeight * lineIndex / numLines);
        ctx.moveTo(tireLeft, yPos+angle);
        ctx.lineTo(tireLeft + (tireCoords.tireWidth * 1/5), yPos);

        ctx.moveTo(tireLeft + (tireCoords.tireWidth * 4/5), yPos);
        ctx.lineTo(tireLeft + tireCoords.tireWidth, yPos+angle);
    }
    ctx.stroke();


    // Same path as above for outer border. No way to save path?
    ctx.beginPath();

    ctx.moveTo(tireLeft, tireTop+cornerRadius);
    ctx.arcTo(tireLeft, tireTop, tireLeft+cornerRadius, tireTop, cornerRadius);

    ctx.lineTo(tireRight-cornerRadius, tireTop)
    ctx.arcTo(tireRight, tireTop, tireRight, tireTop+cornerRadius, cornerRadius);

    ctx.lineTo(tireRight, tireBottom-cornerRadius);
    ctx.arcTo(tireRight, tireBottom, tireRight-cornerRadius, tireBottom, cornerRadius);

    ctx.lineTo(tireLeft+cornerRadius, tireBottom);
    ctx.arcTo(tireLeft, tireBottom, tireLeft, tireBottom-cornerRadius, cornerRadius);

    ctx.lineTo(tireLeft, tireTop+cornerRadius);


    if (tireState)
    {
        ctx.strokeStyle="rgb(200,200,200)";
    }
    else
    {
        ctx.strokeStyle="rgb(200,200,200)";
    }

    ctx.lineWidth = 3;

    ctx.stroke();


    // draw the "clickable" area.
    /*
     var touchWidthExpansion = tireCoords.tireWidth/3;
     var touchHeightExpansion = tireCoords.tireHeight/3;
     ctx.strokeRect(
         tireLeft-touchWidthExpansion,
         tireTop-touchHeightExpansion,
         tireCoords.tireWidth+touchWidthExpansion*2,
         tireCoords.tireHeight+touchHeightExpansion*2);
    */
}

// Draw center point
function drawMarkerArea(element, markerX, markerY, markerState)
{
    var ctx = element.getContext("2d");
    ctx.lineJoin = 'round';

    var markerXOuter = markerX-(tireCoords.markerWidth/2);
    var markerYOuter = markerY-(tireCoords.markerHeight/2);

    // draw coloured portion smaller than regular size,
    // will be easier to click.
    var markerWidthInner = tireCoords.markerWidth/3;
    var markerHeightInner = tireCoords.markerHeight/2;

    var markerXInner = markerX-(markerWidthInner/2);
    var markerYInner = markerY-(markerHeightInner/2);

    if (markerState)
    {
        ctx.fillStyle= "rgb(30,30,30)";

        ctx.strokeStyle= "aqua";
        ctx.lineWidth = 2;
    }
    else
    {
        ctx.fillStyle= "black";

        ctx.strokeStyle= "rgb(200,200,200)";
        ctx.lineWidth = 2;
    }

    ctx.beginPath();

    //circle
    //ctx.arc(markerX, markerY, markerWidthInner/2, 0, 2 * Math.PI, false);

    //diamond
    ctx.moveTo(markerXInner, markerY);
    ctx.lineTo(markerX, markerYInner);
    ctx.lineTo(markerXInner + markerWidthInner, markerY);
    ctx.lineTo(markerX, markerYInner + markerHeightInner);
    ctx.lineTo(markerXInner, markerY);

    // cross
    // ctx.moveTo(markerXInner, markerY);
    // ctx.lineTo(markerXInner + markerWidthInner, markerY);
    // ctx.moveTo(markerX, markerYInner);
    // ctx.lineTo(markerX, markerYInner + markerHeightInner);

    ctx.fill();

    // ctx.lineWidth = 2;
    // ctx.strokeStyle="rgb(200,200,200)";
    // ctx.strokeRect(markerXInner, markerYInner, markerWidthInner, markerHeightInner);
    ctx.stroke();

    // draw outer, clickable area
    // ctx.strokeRect(markerXOuter, markerYOuter, tireCoords.markerWidth, tireCoords.markerHeight);
}

function isXyInTireArea(xPos, yPos, tireX, tireY)
{
    var touchWidthExpansion = tireCoords.tireWidth/3;
    var touchHeightExpansion = tireCoords.tireHeight/3;

    if (xPos > tireX - tireCoords.tireWidth/2 - touchWidthExpansion &&
        xPos < tireX + tireCoords.tireWidth/2 + touchWidthExpansion &&
        yPos > tireY - tireCoords.tireHeight/2 - touchHeightExpansion &&
        yPos < tireY + tireCoords.tireHeight/2 + touchHeightExpansion)
    {
        return true;
    }

    return false;
}

function isXyInMarkerArea(xPos, yPos, markerX, markerY)
{
    if (xPos > markerX - tireCoords.markerWidth/2 &&
        xPos < markerX + tireCoords.markerWidth/2 &&
        yPos > markerY - tireCoords.markerHeight/2 &&
        yPos < markerY + tireCoords.markerHeight/2 )
    {
        return true;
    }

    return false;
}


function onTouchStartTires(e)
{
    var touchobj = e.changedTouches[0]; // reference first touch point (ie: first finger)
    var startx = parseInt(touchobj.clientX); // get x position of touch point relative to left edge of browser
    var starty = parseInt(touchobj.clientY); // get x position of touch point relative to left edge of browser

    var canvasElement = document.getElementById("TiresIndicator");
    var boundingRect = irPitCrew_getOffset(canvasElement);
    var xPos = startx - boundingRect.left;
    var yPos = starty - boundingRect.top;

    // Get actual boundaries (these coords are tire center points)
    var leftBoundary = tireCoords.tiresLeft - (tireCoords.tireWidth/2);
    var rightBoundary = tireCoords.tiresRight + (tireCoords.tireWidth/2);
    var topBoundary = tireCoords.tiresTop - (tireCoords.tireHeight/2);
    var bottomBoundary = tireCoords.tiresBottom + (tireCoords.tireHeight/2);

    // If touch is within tire indicator
    if (xPos >= leftBoundary &&
        xPos <= rightBoundary &&
        yPos >= topBoundary &&
        yPos <= bottomBoundary )
    {
        // don't bother with offsets, just getting difference
        tireState.touchStartX = startx;
        tireState.touchStartY = starty;
        tireState.isTouchDown = true;

        //e.preventDefault();
    }

    // always do this, to prevent any double tap or scroll in this element.
    e.preventDefault();
}

function onTouchEndTires(e)
{
    // Must have been a touch down.
    if (tireState.isTouchDown)
    {
        var touchobj = e.changedTouches[0];
        var startx = parseInt(touchobj.clientX);
        var starty = parseInt(touchobj.clientY);

        // Get X,Y dist from start point
        var distX = startx - tireState.touchStartX;
        var distY = starty - tireState.touchStartY;

        var absDistX = Math.abs(distX);
        var absDistY = Math.abs(distY);

        // Max amount of move to be a click
        var clickMaxDist = 20;
        // Min amount to move to be a drag/swipe
        var minDragDist = 50;

        // Check for click
        if (absDistX < clickMaxDist && absDistY < clickMaxDist)
        {
            var canvasElement = document.getElementById("TiresIndicator");
            var boundingRect = irPitCrew_getOffset(canvasElement);

            // Get X,Y of START point
            var xPos = tireState.touchStartX - boundingRect.left;
            var yPos = tireState.touchStartY - boundingRect.top;

            var isChanged = handleOnClickTiresIndicatorEvent(xPos, yPos);
        }
        // Check for drag
        else if (absDistX > minDragDist || absDistY > minDragDist)
        {
            tireState.leftFront = false;
            tireState.rightFront = false;
            tireState.leftRear = false;
            tireState.rightRear = false;

            tireState.center = true;

            if (absDistX > absDistY)
            {
                // right
                if (distX > 0)
                {
                    tireState.rightFront = true;
                    tireState.rightRear = true;
                }
                // left
                else
                {
                    tireState.leftFront = true;
                    tireState.leftRear = true;
                }
            }
            else
            {
                // bottom
                if (distY > 0)
                {
                    tireState.leftRear = true;
                    tireState.rightRear = true;
                }
                // top
                else
                {
                    tireState.leftFront = true;
                    tireState.rightFront = true;
                }
            }

            // Redraw if changed.
            DrawTiresIndicator();
        }

        tireState.touchStartX = 0;
        tireState.touchStartY = 0;
        tireState.isTouchDown = false;

        e.preventDefault();
    }
}


// Return "checked" state of tires to main page.
function isLeftFrontChecked()
{
    return tireState.leftFront;
}
function isRightFrontChecked()
{
    return tireState.rightFront;
}
function isLeftRearChecked()
{
    return tireState.leftRear;
}
function isRightRearChecked()
{
    return tireState.rightRear;
}
