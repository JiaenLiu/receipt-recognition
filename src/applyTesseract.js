import { createWorker } from 'tesseract.js';

export default async (cb, base64Img, lan = 'fra') => {
    const worker = createWorker({
        logger: m => console.log(m)
    });

    await worker.load();
    await worker.loadLanguage(lan);
    await worker.initialize(lan);

    const { data: { text } } = await worker.recognize(base64Img);
    cb(text);

    await worker.terminate();
}