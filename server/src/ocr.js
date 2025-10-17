import Tesseract from 'tesseract.js';

export async function ocrAnalyzeImages(buffers) {
  const docs = [];
  for (const buffer of buffers) {
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      tessedit_char_whitelist: undefined
    });
    const words = (data.words || []).map(w => ({
      text: (w.text || '').trim(),
      bbox: w.bbox || { x0: w.x0 ?? 0, y0: w.y0 ?? 0, x1: w.x1 ?? 0, y1: w.y1 ?? 0 }
    }));
    docs.push({ text: data.text || '', words });
  }
  return docs;
}

export async function ocrImagesToText(buffers) {
  const docs = await ocrAnalyzeImages(buffers);
  return docs.map(d => d.text);
}
