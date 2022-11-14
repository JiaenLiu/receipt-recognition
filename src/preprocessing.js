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
  const src = img.clone();


  // Apply blur
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  for (let i = 0; i < 3; i++) {
    cv.medianBlur(src, src, 5);
  }

  const step1 = src.clone();

  cv.erode(src, src, kernel, new Point(-1, -1), 1);
  cv.dilate(src, src, kernel, new Point(-1, -1), 2);
  // cv.medianBlur(src, src, 5);

  const step2 = src.clone();

  // Convert to grayscale
  cv.cvtColor(src, src, cv.COLOR_RGB2GRAY, 0);


  const step3 = src.clone();
  // cv.blur(src, src, new cv.Size(7, 7));

  // Detect white regions (?)
  let M1 = cv.Mat.ones(9, 9, cv.CV_8U);
  let anchor = new cv.Point(-1, -1);
  cv.morphologyEx(src, src, cv.MORPH_OPEN, M1, anchor, 1,
      cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  cv.dilate(src, src, cv.Mat.ones(9, 9, cv.CV_8U), anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

  
  // Enhance the contrast of the image
  // cv.convertScaleAbs(src, src, 1.9, 0);
  
  // Canny edge detection
  cv.Canny(src, src, 50, 100, 3, false);


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

    // Get contour corners
    // let corners = []; the length of this array is not euqal to 4
    // for (let i = 0; i < contour.approx.rows; ++i) {
    //   let point = new cv.Point(...contour.approx.data32S.slice(i * 2, i * 2 + 2));
    //   corners.push(point);
    // }

    // // Sort corners
    // let top = corners.sort((a, b) => a.y - b.y)[0];
    // let bottom = corners.sort((a, b) => b.y - a.y)[0];
    // let left = corners.sort((a, b) => a.x - b.x)[0];
    // let right = corners.sort((a, b) => b.x - a.x)[0];

    // // Get the width and height of the contour
    // let width = Math.sqrt(Math.pow(right.x - left.x, 2) + Math.pow(right.y - left.y, 2));
    // let height = Math.sqrt(Math.pow(top.x - bottom.x, 2) + Math.pow(top.y - bottom.y, 2));

    // // Transform
    // let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [left.x, left.y, right.x, right.y, top.x, top.y, bottom.x, bottom.y]);
    // let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, 0, height, width, height]);
    // let dsize = new cv.Size(width, height);
    // let M = cv.getPerspectiveTransform(srcTri, dstTri);
    // cv.warpPerspective(img, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    
    // FIXME: this is ugly but the above code is broken
    // I need a better way to get the corners of the contour to apply the perspective transform
    // It can work when the corners are not equal to 4.
    // Following code is working when the detected contour is a rectangle aka. 4 corners.

    let corner1 = new cv.Point(contour.approx.data32S[0], contour.approx.data32S[1]);
    let corner2 = new cv.Point(contour.approx.data32S[2], contour.approx.data32S[3]);
    let corner3 = new cv.Point(contour.approx.data32S[4], contour.approx.data32S[5]);
    let corner4 = new cv.Point(contour.approx.data32S[6], contour.approx.data32S[7]);
  
    //Order the corners
    let cornerArray = [{ corner: corner1 }, { corner: corner2 }, { corner: corner3 }, { corner: corner4 }];
    //Sort by Y position (to get top-down)
    cornerArray.sort((item1, item2) => { return (item1.corner.y < item2.corner.y) ? -1 : (item1.corner.y > item2.corner.y) ? 1 : 0; }).slice(0, 5);
    
    // Transform the image back to the original perspective
    // TODO: Add a Homography to the image
    // TODO: add frame for edge detection when picture is cut
    for (let i = 0; i < cornerArray.length; i++) {
      cornerArray[i].corner.x = cornerArray[i].corner.x / ratio;
      cornerArray[i].corner.y = cornerArray[i].corner.y / ratio;
    }

    //Determine left/right based on x position of top and bottom 2
    let tl = cornerArray[0].corner.x < cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
    let tr = cornerArray[0].corner.x > cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
    let bl = cornerArray[2].corner.x < cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];
    let br = cornerArray[2].corner.x > cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];

    //Calculate the max width/height
    let widthBottom = Math.hypot(br.corner.x - bl.corner.x, br.corner.y - bl.corner.y);
    let widthTop = Math.hypot(tr.corner.x - tl.corner.x, tr.corner.y - tl.corner.y);
    let heightRight = Math.hypot(tr.corner.x - br.corner.x, tr.corner.y - br.corner.y);
    let heightLeft = Math.hypot(tl.corner.x - bl.corner.x, tr.corner.y - bl.corner.y);
    let theWidth = Math.max(widthBottom, widthTop);
    let theHeight = Math.max(heightRight, heightLeft);
  
    //Transform!
    let finalDestCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, theWidth - 1, 0, theWidth - 1, theHeight - 1, 0, theHeight - 1]); //
    let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.corner.x, tl.corner.y, tr.corner.x, tr.corner.y, br.corner.x, br.corner.y, bl.corner.x, bl.corner.y]);
    let dsize = new cv.Size(theWidth, theHeight);
    let M2 = cv.getPerspectiveTransform(srcCoords, finalDestCoords)
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
    cvImageDataToBase64(src),
  ]

  return [steps, contoursArray];
}