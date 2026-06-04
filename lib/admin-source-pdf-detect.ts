import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";

/** Noteic avota bloku pēc faila nosaukuma un (ja ir) PDF teksta fragmenta. */
export function detectSourcePdfIngestTarget(fileName: string, text: string): SourcePdfIngestTarget | null {
  const hay = `${fileName.toLowerCase()}\n${text.slice(0, 80_000).toLowerCase()}`;
  if (/car[\s_-]*vertical|carvertical/.test(hay)) return "carvertical";
  if (/auto[\s_-]*dna|autodna/.test(hay)) return "autodna";
  if (/ltab|octa[\s_-]?apdro|apdrošin/.test(hay)) return "ltab";
  if (/auto[\s_-]*records|autorecords|odometer\s+check/.test(hay)) return "auto_records";
  if (
    /\bcsdd\b|e\.csdd\.lv|ceļu\s*satiksmes\s*un\s*drošības|reģistrācijas\s+dati|tehnisko\s+apskašu\s+vēsture/i.test(
      hay,
    )
  ) {
    return "csdd";
  }
  return null;
}

/** Nosaukums bez atpazīstama avota — Gemini klasificē pēc satura; citādi CITI AVOTI. */
export function labelFromUnknownPdfFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "").trim();
  return base.length > 0 ? base.slice(0, 80) : "Nezināms avots";
}
