// Self-hosts the Tesseract OCR engine under public/ocr/<version>/ so receipt scanning never loads
// code or data from a CDN (CSP stays 'self'). Runs before dev/build and after install.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const { version } = JSON.parse(readFileSync(require.resolve("tesseract.js/package.json"), "utf8"));
const out = path.join(root, "public", "ocr", version);
mkdirSync(out, { recursive: true });
const tess = path.dirname(require.resolve("tesseract.js/package.json"));
const core = path.dirname(require.resolve("tesseract.js-core/package.json"));
const eng = path.dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const files = [
  [path.join(tess, "dist", "worker.min.js"), "worker.min.js"],
  // LSTM-only engines; the worker picks relaxed SIMD / SIMD / plain by CPU support.
  ...["tesseract-core-relaxedsimd-lstm", "tesseract-core-simd-lstm", "tesseract-core-lstm"].map((n) => [
    path.join(core, `${n}.wasm.js`),
    `${n}.wasm.js`,
  ]),
  [path.join(eng, "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}`);
  copyFileSync(from, path.join(out, name));
}
console.log(`OCR assets ready in public/ocr/${version}`);
