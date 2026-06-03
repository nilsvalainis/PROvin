/** PDF avota imports — lokāls parsers vai Gemini Pro (vizuāli). */
export type PdfIngestEngine = "local_parser" | "gemini_fallback" | "gemini_primary";

export type PdfIngestMeta = {
  engine: PdfIngestEngine;
  charCount: number;
  /** pdf-parse | pdfjs */
  textBackend?: "pdf-parse" | "pdfjs" | "none";
};
