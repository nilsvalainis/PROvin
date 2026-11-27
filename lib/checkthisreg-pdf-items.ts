import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { CtrPdfTextItem } from "@/lib/checkthisreg-pdf-parse";

/**
 * PDF teksta elementi ar koordinātām (pdfjs) CheckThisReg parsētājam. Kolonnas nosaka pēc x, tāpēc
 * nevar lietot `pdf-parse` (tas salīmē kolonnas bez atstarpēm).
 */

let workerConfigured = false;

function resolvePdfWorkerUrl(): string | null {
  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  return existsSync(workerPath) ? pathToFileURL(workerPath).href : null;
}

export async function extractCtrPdfItems(bytes: Uint8Array, maxPages = 40): Promise<CtrPdfTextItem[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!workerConfigured) {
    const workerUrl = resolvePdfWorkerUrl();
    if (workerUrl) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true, verbosity: 0 }).promise;
  const items: CtrPdfTextItem[] = [];
  try {
    for (let p = 1; p <= Math.min(pdf.numPages, maxPages); p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      for (const raw of tc.items) {
        if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
        const it = raw as { str: string; transform: number[]; width?: number };
        if (!it.str || !it.str.trim() || !Array.isArray(it.transform)) continue;
        items.push({ page: p, x: it.transform[4] ?? 0, y: it.transform[5] ?? 0, w: it.width ?? 0, str: it.str });
      }
    }
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
  return items;
}
