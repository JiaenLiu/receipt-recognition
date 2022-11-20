import cv, { Point } from "@techstark/opencv-js";
import { cvImageDataToBase64 } from "./utils";

export class SortableContour {
  perimiterSize;
  areaSize;
  contour;
  idx;
  approx;

  constructor(fields) {
    Object.assign(this, fields);
  }
}

// get the distance from the point to the line
function getDistanceFromPointToLine(x, y, x1, y1, x2, y2) {
  var A = x - x1;
  var B = y - y1;
  var C = x2 - x1;
  var D = y2 - y1;

  var dot = A * C + B * D;
  var len_sq = C * C + D * D;
  var param = -1;
  if (len_sq != 0) //in case of 0 length line
      param = dot / len_sq;

  var xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  }
  else if (param > 1) {
    xx = x2;
    yy = y2;
  }
  else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  var dx = x - xx;
  var dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
// Need to fix this function
// project the point to the line
function projectPointOnLine(point, line) {
  // get the vector of the line
  let lineVector = {
    x: line.end.x - line.start.x,
    y: line.end.y - line.start.y
  };

  // get the vector from the start of the line to the point
  let pointVector = {
    x: point.x - line.start.x,
    y: point.y - line.start.y
  };

  // project the point vector onto the line vector
  let t = (pointVector.x * lineVector.x + pointVector.y * lineVector.y) / (lineVector.x * lineVector.x + lineVector.y * lineVector.y);

  // get the projected point
  let projectedPoint = {
    x: line.start.x + lineVector.x * t,
    y: line.start.y + lineVector.y * t
  };

  return projectedPoint;
}

// find the nearest line for each point
function getNearestLine(point, lines) {
  let minDistance = Number.MAX_VALUE;
  let minLine = null;
  for (let line of lines) {
    let distance = getDistanceFromPointToLine(point.x, point.y, line.start.x, line.start.y, line.end.x,line.end.y);
    if (distance < minDistance) {
      minDistance = distance;
      minLine = line;
    }
  }
  return minLine;
}

/*
 *@param {cv.Mat} img - input image with reduced size
 *@param {cv.Mat} imgBig - input image (original size)
 *@param {number} ratio - ratio between original size and reduced size 
 */
export function getContours(img, imgBig, ratio) {
  // TODO: use imgBig to get the original image size
  // scale the image back to the original size
  // Reject the invalid receipt
  // TODO: add the detection of the receipt when it is not countinuous
  let src = img.clone();

  // Convert to grayscale
  cv.cvtColor(src, src, cv.COLOR_RGB2GRAY, 0);
  
  // // add a frame to the image
  // let s = new cv.Scalar(0, 0, 0, 100);
  // let dst = new cv.Mat();
  // const size = 15;
  // cv.copyMakeBorder(src, dst, size, size, size, size, cv.BORDER_CONSTANT, s);
  // src = dst.clone();

  const step1 = src.clone();
  // let step4 = new cv.Mat();

  // Apply blur
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  for (let i = 0; i < 3; i++) {
    cv.medianBlur(src, src, 5);
  }

  const step2 = src.clone();
  
  // Detect white regions (?)
  let M1 = cv.Mat.ones(9, 9, cv.CV_8U);
  let anchor = new cv.Point(-1, -1);
  cv.morphologyEx(src, src, cv.MORPH_OPEN, M1, anchor, 1,
      cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  cv.dilate(src, src, cv.Mat.ones(9, 9, cv.CV_8U), anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());


  // cv.medianBlur(src, src, 5);


  const step3 = src.clone();
  // cv.blur(src, src, new cv.Size(7, 7));


  cv.dilate(src, src, kernel, new Point(-1, -1), 2);
  cv.erode(src, src, kernel, new Point(-1, -1), 1);

  // Enhance the contrast of the image
  // cv.convertScaleAbs(src, src, 1.9, 0);
  
  // Canny edge detection
  cv.Canny(src, src, 50, 100, 3, true);

  cv.dilate(src, src, kernel, new Point(-1, -1), 2);
  // cv.erode(src, src, kernel, new Point(-1, -1), 1);


  // Find all contours
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  // Sort contours by area
  let contoursArray = [];
  for (let idx = 0; idx < contours.size(); ++idx) {
      let contour = contours.get(idx);
      let perimiterSize = cv.arcLength(contour, true);
      let areaSize = cv.contourArea(contour);
      contoursArray.push(new SortableContour({perimiterSize, areaSize, contour, idx}));
  }


  cv.cvtColor(src, src, cv.COLOR_GRAY2RGB, 0);
  contoursArray = contoursArray.sort((a, b) => {
    // Sort by area
    return b.areaSize - a.areaSize;
  }).filter((contour) => {
    // Only keep large contours
    // the area of the contour is the number of pixels
    // the max withd of the image is 300px
    if (contour.areaSize < 200) {
      return false;
    }

    // Only keep contours that have 4 corners
    contour.approx = new cv.Mat();
    cv.approxPolyDP(contour.contour, contour.approx, 0.02 * contour.perimiterSize, true);
    // if the contour does not have 4 corners, it is not a rectangle
    // we can not just apply the perspective transform based on the these cases
    if (contour.approx.rows > 3 && contour.approx.rows < 10) {
      // extend the contour to a rectangle with black color
      cv.drawContours(src, contours, contour.idx, new cv.Scalar(0, 0, 255, 255), 4);
      return true;
    }
  }).map((contour) => {
    let dst = new cv.Mat();
    
    // TODO: incorrect? needs refactoring
  
    //Order the corners
    // let cornerArray = [{ corner: corner1 }, { corner: corner2 }, { corner: corner3 }, { corner: corner4 }];
    let cornerArray = [];
    for (let i = 0; i < contour.approx.rows; ++i) {
      let point = new cv.Point(...contour.approx.data32S.slice(i * 2, i * 2 + 2));
      point.x = point.x / ratio;
      point.y = point.y / ratio;
      cornerArray.push({ corner: point });
    }

// TODO: - Extend the contour before warpPerspective to avoid information loss DONE
// TODO: - Apply another contour recognition with polynomialDP, find the 4 new corners, apply a projection on the remaining points on their nearest axis to find dstCoordinates
// TODO: - Apply a homography with srcCoordinates as the original coordinates of the polynomialDP and dstCoordinates as the projections 


    // let margin = 100;

    // let maxRight = cornerArray.sort((a, b) => b.corner.x - a.corner.x)[0].corner.x;
    // let maxLeft = cornerArray.sort((a, b) => a.corner.x - b.corner.x)[0].corner.x;
    // let maxTop = cornerArray.sort((a, b) => a.corner.y - b.corner.y)[0].corner.y;
    // let maxBottom = cornerArray.sort((a, b) => b.corner.y - a.corner.y)[0].corner.y;

    // let theWidth = maxRight - maxLeft;
    // let theHeight = maxBottom - maxTop;

    let rotatedRect = cv.minAreaRect(contour.approx);

    let vertices = cv.RotatedRect.points(rotatedRect);

    for (let i = 0; i < vertices.length; ++i) {
      let point = vertices[i];
      point.x = point.x / ratio;
      point.y = point.y / ratio;
    }

    console.log(rotatedRect);
    console.log(vertices);

    // constract the new rectangle for the projection
    // let tl = new cv.Point(maxLeft - margin, maxTop - margin); // top left 00
    // let tr = new cv.Point(maxRight + margin, maxTop - margin); // top right 01
    // let bl = new cv.Point(maxLeft - margin, maxBottom + margin); // bottom left 10
    // let br = new cv.Point(maxRight + margin, maxBottom + margin); // bottom right 11

    // Try without margin
    let tl = vertices[0]; // top left 00
    let tr = vertices[1]; // top right 01
    let bl = vertices[2]; // bottom left 10
    let br = vertices[3]; // bottom right 11

    let theWidth = Math.hypot(tl.x - tr.x, tl.y - tr.y);
    let theHeight = Math.hypot(tl.x - bl.x, tl.y - bl.y);

    // let rect = new cv.Rect(tl.x, tl.y, theWidth, theHeight);

    // console.log(rect);

    // let subImg = imgBig.roi(rect);

    // cv.imshow('subImg', subImg);

    // step4 = subImg.clone();

    // project all the points on the new rectangle
    // for one point, find the nearest line in the rectangle and project the point to that line

    let lines = [
      { start: tl, end: tr },
      { start: tr, end: br },
      { start: br, end: bl },
      { start: bl, end: tl }
    ];

    // find the nearest line for each point and project it on that line
    let dstCoordinates = [];
    for (let i = 0; i < cornerArray.length; ++i) {
      let point = cornerArray[i].corner;
      let nearestLine = getNearestLine(point, lines);
      let projectedPoint = projectPointOnLine(point, nearestLine);
      dstCoordinates.push(projectedPoint.x, projectedPoint.y);
    }

    // get the srcCoordinates
    let srcCoordinates = [];
    for (let i = 0; i < cornerArray.length; i++) {
      srcCoordinates.push(cornerArray[i].corner.x, cornerArray[i].corner.y);
    }

    // console.log("srcCoordinates", srcCoordinates);
    // console.log("dstCoordinates", dstCoordinates);
  
    //Transform!
    // let finalDestCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, theWidth - 1, 0, theWidth - 1, theHeight - 1, 0, theHeight - 1]); //
    let finalDestCoords = cv.matFromArray(dstCoordinates.length, 1, cv.CV_32FC2, dstCoordinates); //
    // let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    let srcCoords = cv.matFromArray(srcCoordinates.length, 1, cv.CV_32FC2, srcCoordinates);
    let dsize = new cv.Size(theWidth, theHeight);
    // let M2 = cv.getPerspectiveTransform(srcCoords, finalDestCoords)
    let M2 = cv.findHomography(srcCoords, finalDestCoords, cv.RANSAC, 5);
    cv.warpPerspective(imgBig, dst, M2, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
    // obtain black and white scanner effect by thresholding
    cv.cvtColor(dst, dst, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // Return the transformed image in base64
    return cvImageDataToBase64(dst);
  });

  const steps = [
    cvImageDataToBase64(step1),
    cvImageDataToBase64(step2),
    cvImageDataToBase64(step3),
    // cvImageDataToBase64(step4),
    cvImageDataToBase64(src),
  ]

  return [steps, contoursArray];
}