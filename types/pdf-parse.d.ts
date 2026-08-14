declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;

  export default pdfParse;
}

/** Kodola modulis bez pakotnes iegājiena demo režīma (tas ESM vidē met ENOENT). */
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";

  export default pdfParse;
}
