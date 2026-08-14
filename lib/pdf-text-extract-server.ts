import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

export type PdfExtractStage =
  | "text_layer"
  | "text_layer_empty"
  | "load_failed";

export type PdfTextBackend = "pdf-parse" | "pdfjs" | "none";

export type PdfExtractResult = {
  ok: boolean;
  text: string;
  pageCount: number;
  textLayerCharCount: number;
  stage: PdfExtractStage;
  backend: PdfTextBackend;
  errorMessage?: string;
  errorName?: string;
  fileName?: string;
};

const MIN_USABLE_TEXT_CHARS = 80;

let workerConfigured = false;

/** Kopā ar deploy nonāk tikai tas, ko Next izseko — worker fails var arī neeksistēt. */
function resolvePdfWorkerUrl(): string | null {
  const workerPath = join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  return existsSync(workerPath) ? pathToFileURL(workerPath).href : null;
}

type PdfParseFn = (data: Buffer) => Promise<{ text?: unknown; numpages?: unknown }>;

/**
 * `pdf-parse` iegājiens (`index.js`) palaiž savu demo režīmu, kad `module.parent` nav definēts —
 * ESM / serverless vidē tas mēģina atvērt `./test/data/05-versions-space.pdf` un met ENOENT.
 * Kodola modulis ir tīra funkcija bez šī sānefekta.
 */
async function loadPdfParse(): Promise<PdfParseFn> {
  try {
    const core = (await import("pdf-parse/lib/pdf-parse.js")) as { default?: PdfParseFn };
    if (typeof core.default === "function") return core.default;
    if (typeof core === "function") return core as unknown as PdfParseFn;
  } catch {
    // Vecākas / citādi iepakotas versijas — atkāpjamies uz publisko iegājienu.
  }
  const mod = (await import("pdf-parse")) as { default?: PdfParseFn };
  const fn = mod.default ?? (mod as unknown as PdfParseFn);
  if (typeof fn !== "function") throw new Error("pdf-parse export is not callable");
  return fn;
}

async function extractWithPdfParse(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const pdfParse = await loadPdfParse();
  const buf = Buffer.from(data);
  const result = await pdfParse(buf);
  return {
    text: typeof result.text === "string" ? result.text : "",
    pageCount: typeof result.numpages === "number" ? result.numpages : 0,
  };
}

async function extractWithPdfJs(data: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!workerConfigured) {
    // Ja worker faila nav, pdfjs Node vidē pats ielādē savu iebūvēto; nederīgs ceļš to nogalinātu.
    const workerUrl = resolvePdfWorkerUrl();
    if (workerUrl) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    workerConfigured = true;
  }
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
  return { text: parts.join("\n"), pageCount: pdf.numPages };
}

function countNonWhitespace(s: string): number {
  return s.replace(/\s/g, "").length;
}

function buildResult(
  text: string,
  pageCount: number,
  backend: PdfTextBackend,
  fileName?: string,
  error?: { message: string; name: string },
): PdfExtractResult {
  const normalized = normalizePdfExtractedText(text);
  const textLayerCharCount = countNonWhitespace(normalized);
  const stage: PdfExtractStage =
    textLayerCharCount >= MIN_USABLE_TEXT_CHARS ? "text_layer" : textLayerCharCount > 0 ? "text_layer_empty" : "load_failed";

  if (error && textLayerCharCount === 0) {
    return {
      ok: false,
      text: normalized,
      pageCount,
      textLayerCharCount,
      stage: "load_failed",
      backend: "none",
      errorMessage: error.message,
      errorName: error.name,
      fileName,
    };
  }

  return {
    ok: stage === "text_layer",
    text: normalized,
    pageCount,
    textLayerCharCount,
    stage,
    backend,
    fileName,
  };
}

/**
 * Plan A teksta izvilkšana: vispirms `pdf-parse` (bez worker), tad `pdfjs-dist` rezerve.
 */
export async function extractPdfTextDetailed(
  buffer: ArrayBuffer,
  opts?: { fileName?: string },
): Promise<PdfExtractResult> {
  const fileName = opts?.fileName;
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  try {
    const parsed = await extractWithPdfParse(data);
    const r = buildResult(parsed.text, parsed.pageCount, "pdf-parse", fileName);
    if (r.ok || r.textLayerCharCount > 0) return r;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.warn("[pdf-text-extract] pdf-parse_failed", { fileName, message: err.message.slice(0, 200) });
  }

  try {
    const parsed = await extractWithPdfJs(data);
    return buildResult(parsed.text, parsed.pageCount, "pdfjs", fileName);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return buildResult("", 0, "none", fileName, { message: err.message, name: err.name });
  }
}

export function logPdfExtractResult(prefix: string, result: PdfExtractResult): void {
  const base = {
    fileName: result.fileName ?? "unknown.pdf",
    stage: result.stage,
    backend: result.backend,
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
        ? "Tukšs teksta slānis — iespējams skenēts PDF (Plan B: AI)"
        : "Teksta izvilkšana neizdevās — Plan B: AI",
  });
}

export async function extractPdfTextOnServer(buffer: ArrayBuffer, opts?: { fileName?: string }): Promise<string> {
  const r = await extractPdfTextDetailed(buffer, opts);
  return r.text;
}

export { MIN_USABLE_TEXT_CHARS };
