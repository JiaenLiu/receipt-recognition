import cv from "@techstark/opencv-js";
import { createWorker } from 'tesseract.js';
import { getContours } from "./preprocessing";

function calculateAspectRatioFit(srcWidth, srcHeight, wantedWidth) {
    var ratio = wantedWidth / srcWidth;
    return { width: srcWidth*ratio, height: srcHeight*ratio };
 }

export function readImgFromBase64(imgObj, wantedWidth) {
    const size = calculateAspectRatioFit(Math.round(imgObj.width), Math.round(imgObj.height), wantedWidth);

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgObj, 0, 0, size.width, size.height);

    const imgMat = cv.imread(canvas);
    canvas.remove();

    const canvasBig = document.createElement('canvas');
    canvasBig.width = imgObj.width;
    canvasBig.height = imgObj.height;

    const ctxBig = canvasBig.getContext('2d');
    ctxBig.drawImage(imgObj, 0, 0);

    const imgMatBig = cv.imread(canvasBig);
    canvasBig.remove();

    return [imgMat, imgMatBig];
}

export function cvImageDataToBase64 (img) {
    const canvasOutput = document.createElement('canvas');
    cv.imshow(canvasOutput, img);
    const imgDataUri = canvasOutput.toDataURL();
    canvasOutput.remove();
    return imgDataUri;
}

export function getContoursFromBase64(img, wantedWidth) {
    const [imgMat, imgMatBig] = readImgFromBase64(img, wantedWidth);
    const contours = getContours(imgMat, imgMatBig);
    imgMat.delete();
    imgMatBig.delete();
    return contours;
}

export async function applyTesseract (cb, base64Img, lan = 'fra') {
    const worker = createWorker({
        logger: m => console.log(m)
    });

    await worker.load();
    await worker.loadLanguage(lan);
    await worker.initialize(lan);

    const { data: { text } } = await worker.recognize(base64Img);
    cb(text);
    console.log(text);

    await worker.terminate();
}