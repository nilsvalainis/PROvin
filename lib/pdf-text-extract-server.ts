import "server-only";

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

export type PdfExtractStage =
  | "text_layer"
  | "text_layer_empty"
  | "load_failed";

export type PdfExtractResult = {
  ok: boolean;
  text: string;
  pageCount: number;
  textLayerCharCount: number;
  stage: PdfExtractStage;
  errorMessage?: string;
  errorName?: string;
  fileName?: string;
};

const MIN_USABLE_TEXT_CHARS = 80;

let workerConfigured = false;

function resolvePdfWorkerUrl(): string {
  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  return pathToFileURL(workerPath).href;
}

async function getPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerUrl();
    workerConfigured = true;
  }
  return pdfjs;
}

function countNonWhitespace(s: string): number {
  return s.replace(/\s/g, "").length;
}

/**
 * Servera PDF teksta izvilkšana (pdfjs-dist legacy + lokāls worker).
 * Skenētiem PDF teksts bieži ir tukšs — izmanto Gemini inline PDF (skat. ai-extract route).
 */
export async function extractPdfTextDetailed(
  buffer: ArrayBuffer,
  opts?: { fileName?: string },
): Promise<PdfExtractResult> {
  const fileName = opts?.fileName;
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  try {
    const pdfjs = await getPdfJs();
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const parts: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const line = tc.items
        .map((item) => {
          if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
            return (item as { str: string }).str;
          }
          return "";
        })
        .join(" ");
      parts.push(line);
    }

    const text = normalizePdfExtractedText(parts.join("\n"));
    const textLayerCharCount = countNonWhitespace(text);
    const stage: PdfExtractStage =
      textLayerCharCount >= MIN_USABLE_TEXT_CHARS ? "text_layer" : "text_layer_empty";

    return {
      ok: stage === "text_layer",
      text,
      pageCount: pdf.numPages,
      textLayerCharCount,
      stage,
      fileName,
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      ok: false,
      text: "",
      pageCount: 0,
      textLayerCharCount: 0,
      stage: "load_failed",
      errorMessage: err.message,
      errorName: err.name,
      fileName,
    };
  }
}

export function logPdfExtractResult(prefix: string, result: PdfExtractResult): void {
  const base = {
    fileName: result.fileName ?? "unknown.pdf",
    stage: result.stage,
    pageCount: result.pageCount,
    textLayerCharCount: result.textLayerCharCount,
    ok: result.ok,
  };
  if (result.ok) {
    console.info(`${prefix} pdf_extract_ok`, base);
    return;
  }
  console.warn(`${prefix} pdf_extract_soft_fail`, {
    ...base,
    errorName: result.errorName,
    errorMessage: result.errorMessage,
    hint:
      result.stage === "text_layer_empty"
        ? "Tukšs teksta slānis — turpinām ar Gemini inline PDF"
        : "PDF.js ielāde neizdevās — turpinām ar Gemini inline PDF, ja buffers ir",
  });
}

export async function extractPdfTextOnServer(buffer: ArrayBuffer, opts?: { fileName?: string }): Promise<string> {
  const r = await extractPdfTextDetailed(buffer, opts);
  return r.text;
}

export { MIN_USABLE_TEXT_CHARS };
