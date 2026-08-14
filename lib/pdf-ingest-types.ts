/** PDF avota imports — lokāls parsers vai Claude Sonnet (vizuāli). */
export type PdfIngestEngine = "local_parser" | "ai_fallback" | "ai_primary";

export type PdfIngestMeta = {
  engine: PdfIngestEngine;
  charCount: number;
  /** pdf-parse | pdfjs */
  textBackend?: "pdf-parse" | "pdfjs" | "none";
};
