import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDFJS_WORKER_PUBLIC_PATH } from "@/lib/pdfjs-worker-src";

describe("pdf.js worker kopija public/", () => {
  it("sakrīt ar instalēto pdfjs-dist (citādi: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/vendor/pdfjs/)", () => {
    const root = path.resolve(__dirname, "..");
    const copy = readFileSync(path.join(root, "public", PDFJS_WORKER_PUBLIC_PATH));
    const installed = readFileSync(path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"));
    expect(copy.equals(installed)).toBe(true);
  });
});
