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
            var neighbourGroups = [
                getGroup(h-1, w+1), // North-East
                getGroup(h-1, w), // North
                getGroup(h-1, w-1), // North-West
                getGroup(h,   w-1) // West
            ];
            var neighbours = [];
            for(i=0; i<neighbourGroups.length; i++) {
                if (neighbourGroups[i] === undefined || neighbours.indexOf(neighbourGroups[i]) !== -1) {
                    continue;
                }

                neighbours.push(neighbourGroups[i]);
            }

            if (neighbours.length === 0) {
                // We're in something, but have no neighbours → new area!
                groupMap[index] = nextLabel;
                linked[nextLabel] = [];
                nextLabel += 1;
            } else {
                // Sort neighbour list, so it's easy to pick the smallest label.
                neighbours = neighbours.sort(numericSort);

                // We're in something adjacent to something else
                groupMap[index] = neighbours[0];

                // Discover neighbours' neighbours
                var allNeighbours = neighbours;
                for (i=0; i<neighbours.length; i++) {
                    allNeighbours = _.union(allNeighbours, linked[neighbours[i]]);
                }

                // Update all neighbours' with this + eachothers' neighbours
                for (i=0; i<neighbours.length; i++) {
                    linked[neighbours[i]] = allNeighbours;
                }
            }
        }
    }

    // Create label remap table, so we can look up labels that should be re-mapped to other ones.
    var labelLookupTable = {};
    for(label=1; label<nextLabel; label++) {
        var targetLabel = linked[label].sort(numericSort)[0];

        // Map each element in the link table reversely to all it's neighbours (the loop above misses some, for some reason...)
        for(i=0; i<linked[label].length; i++) {
            labelLookupTable[linked[label][i]] = Math.min(linked[label][i] ? linked[label][i] : Number.MAX_VALUE, targetLabel);
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

// {{{ setupCanvases
function setupCanvases(maxSize) {
    /* Set up canvases */
    var si = $("#source_image")[0],
        sc = $("#source_canvas")[0],
        scCtx = sc.getContext("2d"),
        rc = $("#result_canvas")[0],
        groupCanvas = $("#group_canvas")[0],
        height = si.height,
        width = si.width;

    // If no maxSize is given, we invent one...
    if(maxSize !== undefined) {
        var scale = maxSize / Math.max(maxSize, si.width, si.height);
        height = Math.round(si.height * scale);
        width = Math.round(si.width * scale);
    }

    // Resize canvases to match source image
    sc.width = rc.width = groupCanvas.width = width;
    sc.height = rc.height = groupCanvas.height = height;

    // Copy image into canvas
    scCtx.drawImage(si, 0, 0, sc.width, sc.height);
}
// }}} setupCanvases

// {{{ handleNewFile
function handleNewFile(fileList) {

    // Read the file and wait for .onload to return
    var reader = new FileReader();
    reader.onload = function(dataURL) {

        // Set image source to data://-URL
        $("#source_image")[0].src = dataURL.target.result;

        // Wait a tick for changes to propagate, then re-size canvases
        window.setTimeout(function () {
            setupCanvases();
        }, 1);
    };
    reader.readAsDataURL(fileList[0]);
}
// }}}

// {{{ document -> ready()
$(document).ready(function () {
    /* Match upload-button to hidden element on page */
    $("#fileSelect").click(function (e) {
        $("#fileElem").click();
        e.preventDefault(); // prevent navigation to "#"
    });

    /* Set up canvases */
    $("#source_image").load(function () {
        setupCanvases();
    });

    var sc = $("#source_canvas")[0],
        scCtx = sc.getContext("2d"),
        rc = $("#result_canvas")[0],
        rcCtx = rc.getContext("2d"),
        groupCanvas = $("#group_canvas")[0],
        groupCanvasCtx = groupCanvas.getContext("2d"),
        i; // Temporary variable for loops

    // {{{ clickEventListener
    // Select an pixel from the source image.
    $("#source_canvas").click(function (clickEvent) {
        var pos = getCursorPosition(clickEvent, sc);

        // "Fix" clicks on border-pixels by bumping them one pixel into frame.
        pos.x = Math.max(pos.x, 1);
        pos.x = Math.min(pos.x, sc.width - 1);
        pos.y = Math.max(pos.y, 1);
        pos.y = Math.min(pos.y, sc.height - 1);

        // Grab a 3×3 area and average the colors
        var pixelArray = scCtx.getImageData(pos.x - 1, pos.y - 1, 3, 3),
            pixelData = pixelArray.data;
            color = { red: 0, green: 0, blue: 0, alpha: 255 };
        for(i=0; i<pixelData.length; i+=4) {
            color.red += pixelData[i];
            color.green += pixelData[i+1];
            color.blue += pixelData[i+2];
        }
        color.red /= 9;
        color.green /= 9;
        color.blue /= 9;

        // Mark up on diff-canvas
        var sourceData = scCtx.getImageData(0, 0, sc.width, sc.height),
            sourcePixels = sourceData.data,
            resultData = rcCtx.getImageData(0, 0, rc.width, rc.height),
            resultPixels = resultData.data;

        for(i=0; i<resultPixels.length; i+=4) {
            var redDiff = Math.abs(color.red - sourcePixels[i]);
                greenDiff = Math.abs(color.green - sourcePixels[i+1]);
                blueDiff = Math.abs(color.blue - sourcePixels[i+2]);
            var OK = redDiff < 50 && greenDiff < 50 && blueDiff < 50;
            resultPixels[i] = OK ? 0 : 255;
            resultPixels[i+1] = OK ? 0 : 255;
            resultPixels[i+2] = OK ? 0 : 255;
            resultPixels[i+3] = 255;
        }

        rcCtx.putImageData(resultData, 0, 0);

        // Find and draw connected components in the image
        window.setTimeout(function () {
            // Find connected components
            var components = getConnectedComponents(resultData),
                i, j;

            // Which one has our original click in it?
            var index = pos.y * components.width + pos.x,
                largestBlobSize = 1e10,
                sourceBlobSize = 0;
            for (i=0; i<components.blobs.length; i++) {
                var pixels = components.blobs[i];

                // Loop through the pixels in the blob
                for (j=0; j<pixels.length; j++) {
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
            for (i=0; i<histogram.length; i++) {
                histogram[i] = {bin: 0, accum: 0};
            }
            for (i=0; i<components.blobs.length; i++) {
                var dist = Math.abs(components.blobs[i].length - sourceBlobSize) * 100 / sourceBlobSize;
                dist = Math.round(dist);
                dist = Math.min(dist, 100);
                //var pixels = Math.ceil(components.blobs[i].length/10)*10;

                histogram[dist].bin += 1;
                for (j=dist; j<=100; j++) {
                    histogram[j].accum += 1;
                }
            }

            // Write result to table
            var table = "<thead><th>Δ%</th><th>Bin</th><th>∑</th></thead>";
            for (i=0; i<histogram.length; i++) {
                table = table + "<tr><td>" + i + "%</td><td>" + histogram[i].bin + "</td><td>" + histogram[i].accum + "</td></tr>\n";
            }
            $("#result").html(table);

            // Update output drawing
            window.setTimeout(function () {
                connectedComponents2Canvas(components, groupCanvas);
            }, 1);
        }, 1);
    });
    // }}}
});
// }}}
