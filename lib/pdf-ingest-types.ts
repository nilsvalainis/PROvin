/** PDF avota imports — Plan A (lokāls) vai Plan B (Gemini). */
export type PdfIngestEngine = "local_parser" | "gemini_fallback";

export type PdfIngestMeta = {
  engine: PdfIngestEngine;
  charCount: number;
  /** pdf-parse | pdfjs */
  textBackend?: "pdf-parse" | "pdfjs" | "none";
};
