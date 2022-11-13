import cv from "@techstark/opencv-js";

export class SortableContour {
    perimiterSize;
    areaSize;
    contour;
    approx;
  
    constructor(fields) {
      Object.assign(this, fields);
    }
  }

export function cvImageDataToBase64 (img) {
    const canvasOutput = document.createElement('canvas');
    cv.imshow(canvasOutput, img);
    const imgDataUri = canvasOutput.toDataURL();
    canvasOutput.remove()
    return imgDataUri;
}

export function getContours(img) {
    const src = img.clone();

    // Convert to grayscale
    cv.cvtColor(src, src, cv.COLOR_RGB2GRAY, 0);

    // Apply blur
    cv.GaussianBlur(src, src, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    // Detect white regions (?)
    let M1 = cv.Mat.ones(9, 9, cv.CV_8U);
    let anchor = new cv.Point(-1, -1);
    cv.morphologyEx(src, src, cv.MORPH_OPEN, M1, anchor, 1,
        cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
    cv.dilate(src, src, cv.Mat.ones(9, 9, cv.CV_8U), anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  
    // Enhance the contrast of the image
    // cv.convertScaleAbs(src, src, 1.9, 0);
    
    // Canny edge detection
    cv.Canny(src, src, 150, 100, 3, false);
  

    // Find all contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // Sort contours by area
    let contoursArray = [];
    for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let perimiterSize = cv.arcLength(contour, true);
        let areaSize = cv.contourArea(contour);
        contoursArray.push(new SortableContour({perimiterSize, areaSize, contour}));
    }

    return contoursArray.sort((a, b) => {
      // Sort by area
      return b.areaSize - a.areaSize;
    }).filter((contour) => {
      // Only keep contours that have 4 corners
      contour.approx = new cv.Mat();
      cv.approxPolyDP(contour.contour, contour.approx, 0.05 * contour.perimiterSize, true);
      return (contour.approx.rows === 4)
    }).map((contour) => {
      // Get contour corners
      let corners = [];
      for (let i = 0; i < contour.approx.rows; ++i) {
        let point = new cv.Point(...contour.approx.data32S.slice(i * 2, i * 2 + 2));
        corners.push(point);
      }

      // Sort corners
      let top = corners.sort((a, b) => a.y - b.y)[0];
      let bottom = corners.sort((a, b) => b.y - a.y)[0];
      let left = corners.sort((a, b) => a.x - b.x)[0];
      let right = corners.sort((a, b) => b.x - a.x)[0];

      // Get the width and height of the contour
      let width = Math.sqrt(Math.pow(right.x - left.x, 2) + Math.pow(right.y - left.y, 2));
      let height = Math.sqrt(Math.pow(top.x - bottom.x, 2) + Math.pow(top.y - bottom.y, 2));

      // Transform
      let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [left.x, left.y, right.x, right.y, top.x, top.y, bottom.x, bottom.y]);
      let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, 0, height, width, height]);
      let dsize = new cv.Size(width, height);
      let M = cv.getPerspectiveTransform(srcTri, dstTri);
      let dst = new cv.Mat();
      cv.warpPerspective(img, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
      
      // Return the transformed image in base64
      return cvImageDataToBase64(dst);
    });
}