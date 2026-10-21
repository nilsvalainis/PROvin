/**
 * Tesseract valodas fails no node_modules, nevis no CDN katrā aukstajā startā.
 * Kešs /tmp, jo serverless vidē tikai tur var rakstīt.
 */
import "server-only";

import os from "node:os";
import path from "node:path";

export const TESSERACT_ENG_DIR = "node_modules/@tesseract.js-data/eng/4.0.0_best_int";

export function tesseractLocalWorkerOptions(): { langPath: string; cachePath: string; gzip: boolean; logger: () => void } {
  return {
    langPath: path.join(process.cwd(), TESSERACT_ENG_DIR),
    cachePath: path.join(os.tmpdir(), "provin-tesseract"),
    gzip: true,
    logger: () => undefined,
  };
}
