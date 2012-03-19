/*
 * Small image analysis-program for counting cells in microscope images.
 *
 * Morten Siebuhr
 * <sbhr@sbhr.dk>
 */

// {{{ numericSort
function numericSort(a, b) {
    return a - b;
}
// }}}

// {{{ getCursorPosition
function getCursorPosition(e, gCanvasElement) {
    var x;
    var y;
    if (e.pageX !== undefined && e.pageY !== undefined) {
        x = e.pageX;
        y = e.pageY;
    }
    else {
        x = e.clientX + document.body.scrollLeft +
        document.documentElement.scrollLeft;
        y = e.clientY + document.body.scrollTop +
        document.documentElement.scrollTop;
    }
    x -= gCanvasElement.offsetLeft;
    y -= gCanvasElement.offsetTop;

    return {x: x, y: y	};
}
// }}}

// {{{ getConnectedComponents
function getConnectedComponents (imageData) {
    var pixels = imageData.data,
        height = imageData.height,
        width = imageData.width,
        index, label, i, h, w; // Temporary variables used later

    // Create map of which groups are at which position
    var groupMap = new Array(pixels.length/4),
        nextLabel = 1,
        linked = {}; // re-group from → to

    // {{{ Internal helper functions
    function hw2index(h, w) {
        if (h<0 || h> height || w<0 || w>width) {
            return undefined;
        }
        return h*width + w;
    }

    function getGroup(h, w) {
        var index = hw2index(h, w);
        if (index) {
            return groupMap[index];
        }
        return undefined;
    }
    // }}}

    // Loop throuth the image, just looking at the red channel (assumes b/w image)
    for(h=0; h<height; h++) {
        for(w=0; w<width; w++) {
            index = hw2index(h, w);

            // Skip background
            if (pixels[index*4] > 128) {
                continue;
            }

            // Check neighbours; north and west
            var neighbours = [
                getGroup(h-1, w+1), // North-East
                getGroup(h-1, w), // North
                getGroup(h-1, w-1), // North-West
                getGroup(h,   w-1) // West
            ];
            neighbours = _(neighbours).compact().sort(numericSort);
            neighbours = _(neighbours).uniq(true);

            if (neighbours.length === 0) {
                // We're in something, but have no neighbours → new area!
                groupMap[index] = nextLabel;
                linked[nextLabel] = [];
                nextLabel += 1;
            } else {
                // We're in something adjacent to something else
                groupMap[index] = neighbours[0];

                // Discover neighbours' neighbours
                var allNeighbours = neighbours;
                for (i=0; i<neighbours.length; i++) {
                    allNeighbours = _.union(allNeighbours, linked[neighbours[i]]);
                }

                // Update all neighbours' with this + eachothers' neighbours
                for (i=0; i<neighbours.length; i++) {
                    linked[neighbours[i]] = _.union(linked[neighbours[i]], allNeighbours);
                }
            }
        }
    }

    // Create label remap table, so we can look up labels that should be re-mapped to other ones.
    var labelLookupTable = {};
    for(label=1; label<nextLabel; label++) {
        var targetLabel = linked[label].sort(numericSort)[0];
        if (targetLabel && label !== targetLabel) {
            labelLookupTable[label] = targetLabel;
        }
    }

    // Iterate through groupMap and find re-mappable labels + create reverse
    // index of where pixels are...
    var reverseIndex = {};
    for(i=0; i<groupMap.length; i++) {
        label = groupMap[i];

        if (label === undefined) {
            continue;
        }

        // Re-label the group, if it's in the lookup table
        if(label in labelLookupTable) {
            label = labelLookupTable[label];
            groupMap[i] = label;
        }

        // Initialize reverse index entry if it's missing
        if(!(label in reverseIndex)) {
            reverseIndex[label] = [];
        }

        // Update reverse map
        reverseIndex[label].push({
            index: i,
            x: i % width,
            y: (i - (i % width)) / width
        });
    }

    // Return object with data stored in various ways
    return {
        blobs: _.values(reverseIndex),
        height: height,
        width: width
    };
}
// }}}

// {{{ connectedComponents2Canvas
function connectedComponents2Canvas(components, canvas) {
    var height = canvas.height,
        width = canvas.width,
        ctx = canvas.getContext("2d"),
        cdata = ctx.getImageData(0, 0, width, height),
        cpixels = cdata.data,
        i, j;

    // Shamelessly stolen from the Tango-icon color palette
    var colors = [
        {r: 252, g: 233, b: 79 }, // Butter1
        {r: 252, g: 175, b: 62 }, // Orange1
        {r: 233, g: 185, b: 110}, // Chocolate1
        {r: 138, g: 226, b: 52 }, // Chameleon1
        {r: 114, g: 159, b: 207}, // SkyBlue1
        {r: 173, g: 127, b: 168}, // Plum1
        {r: 239, g: 41 , b: 41 }  // ScarletRed1
    ];

    // First, re-paint the canvas white
    for (i=0; i<cpixels.length; i++) {
        cpixels[i] = 255;
    }

    // Draw the blobs
    for (i=0; i<components.blobs.length; i++) {
        var pixels = components.blobs[i],
            color = colors[i % colors.length];

        // Loop through the pixels in the blob
        for (j=0; j<pixels.length; j++) {
            var pixel = pixels[j],
                index = pixel.x + pixel.y*width;

            cpixels[pixel.index*4] = color.r;
            cpixels[pixel.index*4+1] = color.g;
            cpixels[pixel.index*4+2] = color.b;
        }
    }

    ctx.putImageData(cdata, 0, 0);
}
// }}}

// {{{ handleNewFile
function handleNewFile(fileList) {

    var si = document.getElementById("source_image"),
        sc = document.getElementById("source_canvas"),
        scCtx = sc.getContext("2d"),
        dc = document.getElementById("diff_canvas"),
        rc = document.getElementById("result_canvas"),
        groupCanvas = document.getElementById("group_canvas");

    // Insert new image
    //si.img = fileList[0];
    var reader = new FileReader();
    reader.onload = function(dataURL) {
        si.src = dataURL.target.result;

        // Resize canvases to match source image
        sc.width = dc.width = rc.width = groupCanvas.width = si.width;
        sc.height = dc.height = rc.height = groupCanvas.height = si.height;

        // Copy image into canvas
        scCtx.drawImage(si, 0, 0, sc.width, sc.height);
    };
    reader.readAsDataURL(fileList[0]);
}
// }}}

window.onload = function () {
    var si = document.getElementById("source_image"),
        sc = document.getElementById("source_canvas"),
        scCtx = sc.getContext("2d"),
        dc = document.getElementById("diff_canvas"),
        dcCtx = dc.getContext("2d"),
        rc = document.getElementById("result_canvas"),
        rcCtx = rc.getContext("2d"),
        groupCanvas = document.getElementById("group_canvas"),
        groupCanvasCtx = groupCanvas.getContext("2d"),
        i; // Temporary variable for loops

    // Resize canvases to match source image
    sc.width = dc.width = rc.width = groupCanvas.width = si.width;
    sc.height = dc.height = rc.height = groupCanvas.height = si.height;

    // Copy image into canvas
    scCtx.drawImage(si, 0, 0, sc.width, sc.height);

    // {{{ clickEventListener
    // Select an pixel from the source image.
    sc.addEventListener("click", function (clickEvent) {
        var pos = getCursorPosition(clickEvent, sc);

        var pixelArray = scCtx.getImageData(pos.x, pos.y, 1, 1);
        var pixelData = pixelArray.data;
        var color = {
            red: pixelData[0],
            green: pixelData[1],
            blue: pixelData[2],
            alpha: pixelData[3]
        };

        // Mark up on diff-canvas
        var sourceData = scCtx.getImageData(0, 0, sc.width, sc.height),
        sourcePixels = sourceData.data;
        var dcData = dcCtx.getImageData(0, 0, dc.width, dc.height),
        dcPixels = dcData.data;
        for(i=0; i < dcPixels.length; i += 4) { // Iterate over RGBA-tuples
            dcPixels[i] = Math.abs(color.red - sourcePixels[i]);
            dcPixels[i+1] = Math.abs(color.green - sourcePixels[i+1]);
            dcPixels[i+2] = Math.abs(color.blue - sourcePixels[i+2]);
            dcPixels[i+3] = 255;
        }
        dcCtx.putImageData(dcData, 0, 0);

        // Do histogram cutoff in the diffed image
        var resultData = rcCtx.getImageData(0, 0, rc.width, rc.height),
        resultPixels = resultData.data;

        for(i=0; i<resultPixels.length; i+=4) {
            var OK = dcPixels[i] < 50 && dcPixels[i+1] < 50 && dcPixels[i+2] < 50;
            resultPixels[i] = OK ? 0 : 255;
            resultPixels[i+1] = OK ? 0 : 255;
            resultPixels[i+2] = OK ? 0 : 255;
            resultPixels[i+3] = 255;
        }

        rcCtx.putImageData(resultData, 0, 0);

        // Find and draw connected components in the image
        window.setTimeout(function () {
            // Find connected components
            var components = getConnectedComponents(resultData);

            // Which one has our original click in it?
            var index = pos.y * components.width + pos.x,
                largestBlobSize = 1e10,
                sourceBlobSize = 0;
            for (var i=0; i<components.blobs.length; i++) {
                var pixels = components.blobs[i];

                // Loop through the pixels in the blob
                for (var j=0; j<pixels.length; j++) {
                    if (pixels[j].index === index) {
                        sourceBlobSize = pixels.length;
                    }
                    if (pixels.length > largestBlobSize) {
                        largestBlobSize = pixels.length;
                    }
                }
            }

            // Rough Histogram of blob sizes
            var histogram = new Array(101);
            for (var i=0; i<histogram.length; i++) {
                histogram[i] = {bin: 0, accum: 0};
            }
            for (var i=0; i<components.blobs.length; i++) {
                var dist = Math.abs(components.blobs[i].length - sourceBlobSize) * 100 / sourceBlobSize;
                dist = Math.round(dist);
                dist = Math.min(dist, 100);
                //var pixels = Math.ceil(components.blobs[i].length/10)*10;

                histogram[dist].bin += 1;
                for (var j=dist; j<=100; j++) {
                    histogram[j].accum += 1;
                }
            }

            // Write result to table
            var tableElem = document.getElementById("result"),
                table = "<thead><th>Δ%</th><th>Bin</th><th>∑</th></thead>";
            for (var i=0; i<histogram.length; i++) {
                table = table + "<tr><td>" + i + "%</td><td>" + histogram[i].bin + "</td><td>" + histogram[i].accum + "</td></tr>\n";
            }
            tableElem.innerHTML = table;

            // Update output drawing
            window.setTimeout(function () {
                connectedComponents2Canvas(components, groupCanvas);
            }, 1);
        }, 1);
    }, false);
    // }}}
};
