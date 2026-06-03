import type { SourcePdfIngestTarget } from "@/lib/pdf-source-ingest";

/** Noteic avota bloku pēc faila nosaukuma un (ja ir) PDF teksta fragmenta. */
export function detectSourcePdfIngestTarget(fileName: string, text: string): SourcePdfIngestTarget | null {
  const hay = `${fileName.toLowerCase()}\n${text.slice(0, 80_000).toLowerCase()}`;
  if (/car[\s_-]*vertical|carvertical/.test(hay)) return "carvertical";
  if (/auto[\s_-]*dna|autodna/.test(hay)) return "autodna";
  if (/ltab|octa[\s_-]?apdro|apdrošin/.test(hay)) return "ltab";
  if (/auto[\s_-]*records|autorecords|odometer\s+check/.test(hay)) return "auto_records";
  return null;
}
