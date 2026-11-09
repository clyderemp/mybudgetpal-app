"use client";
import type { Worker } from "tesseract.js";
import tesseractPkg from "tesseract.js/package.json";

// Receipt OCR in the browser (the photo never leaves the device; only the text is sent to the
// API). Engine and English data are self-hosted under /ocr/<version>/ (scripts/copy-ocr-assets.mjs).
const BASE = `/ocr/${tesseractPkg.version}`;

export type OcrProgress = { step: "loading" | "reading"; progress: number };

let workerPromise: Promise<Worker> | null = null;
let onProgress: ((p: OcrProgress) => void) | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import("tesseract.js");
    return createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: BASE,
      langPath: BASE,
      workerBlobURL: false,
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (!onProgress || typeof m.progress !== "number") return;
        onProgress({ step: m.status === "recognizing text" ? "reading" : "loading", progress: m.progress });
      },
    });
  })().catch((err) => {
    workerPromise = null;
    throw err;
  });
  return workerPromise;
}

// Phone photos are ~4000 px wide (slow, no more accurate) and screenshots of PDFs can be tiny
// (misread). Scale the long side into a readable range, apply EXIF rotation, grayscale and
// stretch contrast: the same preparation SESSIONS does server-side with sharp.
const MIN_WIDTH = 1400;
const MAX_WIDTH = 2400;
const MAX_PIXELS = 10_000_000;

async function prepare(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    let scale = width < MIN_WIDTH ? Math.min(3, MIN_WIDTH / width) : Math.min(1, MAX_WIDTH / width);
    scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (width * height)));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const img = ctx.getImageData(0, 0, w, h);
    const px = img.data;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < px.length; i += 4) {
      const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      px[i] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.round(((px[i] - lo) * 255) / range);
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/png"));
  } catch {
    return file;
  }
}

export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

/** OCR text of a receipt photo or screenshot. */
export async function readReceiptText(file: File, progress?: (p: OcrProgress) => void): Promise<string> {
  onProgress = progress ?? null;
  try {
    progress?.({ step: "loading", progress: 0 });
    const [worker, image] = await Promise.all([getWorker(), prepare(file)]);
    const { data } = await worker.recognize(image);
    return data.text ?? "";
  } finally {
    onProgress = null;
  }
}
