// {{{ getCursorPosition
function getCursorPosition(e, gCanvasElement) {
    var x;
    var y;
    if (e.pageX != undefined && e.pageY != undefined) {
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

function getConnectedComponents (pixelData, width, height) {
    
}

window.onload = function () {
    var si = document.getElementById("source_image"),
        sc = document.getElementById("source_canvas"),
        scCtx = sc.getContext("2d"),
        dc = document.getElementById("diff_canvas"),
        dcCtx = dc.getContext("2d"),
        rc = document.getElementById("result_canvas"),
        rcCtx = rc.getContext("2d");

        // Copy image into canvas
        scCtx.drawImage(si, 0, 0, sc.width, sc.height);

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
            }

            // Mark up on diff-canvas
            var sourceData = scCtx.getImageData(0, 0, sc.width, sc.height),
                sourcePixels = sourceData.data;
            var dcData = dcCtx.getImageData(0, 0, dc.width, dc.height),
                dcPixels = dcData.data;
            for(var i=0; i < dcPixels.length; i += 4) { // Iterate over RGBA-tuples
                //console.log(i + " → " + sourcePixels[i]);
                dcPixels[i] = Math.abs(color.red - sourcePixels[i]);
                dcPixels[i+1] = Math.abs(color.green - sourcePixels[i+1]);
                dcPixels[i+2] = Math.abs(color.blue - sourcePixels[i+2]);
                dcPixels[i+3] = 255;
            }
            dcCtx.putImageData(dcData, 0, 0);

            // Do histogram cutoff in the diffed image
            var resultData = rcCtx.getImageData(0, 0, rc.width, rc.height),
                resultPixels = resultData.data;

            for(var i=0; i<resultPixels.length; i+=4) {
                var OK = dcPixels[i] < 50 && dcPixels[i+1] < 50 && dcPixels[i+2] < 50;
                resultPixels[i] = OK ? 0 : 255;
                resultPixels[i+1] = OK ? 0 : 255;
                resultPixels[i+2] = OK ? 0 : 255;
                resultPixels[i+3] = 255;
            }

            rcCtx.putImageData(resultData, 0, 0);

        }, false);

};
