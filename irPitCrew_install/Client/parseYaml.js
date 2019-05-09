
var parsingData = {

    dataNotSetString:"<not set>",
}


// This function is not very complete but works for simple cases.
// If serious parsing of the session string is required, will need to
// do something with this.
//
function parseYaml(dataString, dataPathString)
{
    var returnValue = "";

    if(dataString.length > 0 && dataPathString.length > 0)
    {
        // split the datapathString on : to get path
        // for each item in path, find next in string starting from last found

        dataPathArray = dataPathString.split(":");

        var isTokenNotFound = 0;

        for (index=0;index<dataPathArray.length;++index)
        {
            var nextToken = dataPathArray[index];
            nextToken.trim();

            // If string starts with "{", need special handling to find
            // next value using key
            //...

            var pos = dataString.indexOf(nextToken);
            if (pos == -1)
            {
                isTokenNotFound = 1;
                break;
            }

            dataString  = dataString.slice(pos);
        }

        if (isTokenNotFound == 0)
        {
            // Found the value, get the rest of the string until "\n"
            var pos = dataString.indexOf(":");
            if (pos > 0)
            {
                dataString = dataString.slice(pos);
            }

            var pos = dataString.indexOf("\n");
            // length includes the current ":"
            if (pos > 0 && dataString.length > 1)
            {
                returnValue = dataString.slice(1, pos);
                returnValue.trim();
                returnValue = returnValue;
            }
        }
    }

    return returnValue;
}


function parseDataPortion(dataPortion, dataTag)
{
    // Not set by default. If not set, system should ignore this value.
    // The data tag will only be sent from the server if the data has
    // actually changed (setting a value of "" is valid).
    //
    var returnValue = parsingData.dataNotSetString;

    if(dataPortion.length > 0 && dataTag.length > 0)
    {
        // Create a search string based on the dataTag
        // Format: "\nTagValue;"
        //var searchString = "|" + dataTag + ";";
        var searchString = "\n" + dataTag + ";";

        var pos1 = dataPortion.indexOf(searchString);
        if (pos1 >= 0)
        {
            // tag was found, get the data (default is "").
            //
            returnValue = "";

            pos1 = dataPortion.indexOf(";", pos1);
            //var pos2 = dataPortion.indexOf("|", pos1);
            var pos2 = dataPortion.indexOf("\n", pos1);

            // drop the ';' character
            pos1++;

            if (pos2 > pos1)
            {
                returnValue = dataPortion.slice(pos1, pos2);
            }

        }
    }

    return returnValue;
}
