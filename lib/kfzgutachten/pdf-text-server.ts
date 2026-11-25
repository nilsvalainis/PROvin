import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { extractPdfTextDetailed } from "@/lib/pdf-text-extract-server";

let workerConfigured = false;

/**
 * §57a atzinuma teksts ar rindām (pdfjs `hasEOL`): tā vārdi nesalīp un trūkumu rindas paliek atsevišķi.
 * Ja pdfjs krīt - kopējā teksta izvilkšana (pdf-parse), parsētājs der arī salīmētam tekstam.
 */
export async function extractKfzGutachtenPdfText(buffer: ArrayBuffer, fileName?: string): Promise<string> {
  const data = new Uint8Array(buffer.slice(0));
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (!workerConfigured) {
      const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
      if (existsSync(workerPath)) pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      workerConfigured = true;
    }
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      pages.push(
        tc.items
          .map((item) => {
            if (!item || typeof item !== "object" || !("str" in item)) return "";
            const it = item as { str: string; hasEOL?: boolean };
            return it.str + (it.hasEOL ? "\n" : " ");
          })
          .join(""),
      );
    }
    const text = pages.join("\n");
    if (text.replace(/\s/g, "").length > 80) return text;
  } catch (e) {
    console.warn("[kfzgutachten] pdfjs_failed", { fileName, message: e instanceof Error ? e.message.slice(0, 200) : "?" });
  }
  const fallback = await extractPdfTextDetailed(buffer, { fileName });
  return fallback.text;
}
