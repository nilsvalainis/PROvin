import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";

const CSDD_SECTION_MARKERS = [
  "Iepriekšējās reģistrācijas valsts",
  "Transportlīdzekļa reģistrācija",
  "Tehniskie dati",
  "Detalizētais vērtējums",
  "Iepriekšējās apskates dati",
  "Nobraukuma vēsture",
  "Nobraukums ārvalst",
  "Tehnisko apskašu vēsture",
  "Pēdējā tehniskā apskate",
] as const;

/** Apvieno PDF teksta slāni un AI transkriptu — PDF teksts ir primārais avots. */
export function mergeCsddPdfRawSources(textHint: string, aiRaw: string): string {
  const pdf = normalizeCsddRawText(textHint).trim();
  const ai = normalizeCsddRawText(aiRaw).trim();
  if (!pdf) return ai;
  if (!ai) return pdf;
  if (pdf.includes(ai)) return pdf;
  if (ai.includes(pdf) && pdf.length >= ai.length * 0.55) return pdf;

  const missingChunks: string[] = [];
  for (const marker of CSDD_SECTION_MARKERS) {
    if (ai.includes(marker) && !pdf.includes(marker)) {
      const idx = ai.indexOf(marker);
      missingChunks.push(ai.slice(idx, idx + 12_000));
    }
  }
  if (missingChunks.length === 0) return pdf.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN);
  return `${pdf}\n\n${missingChunks.join("\n\n")}`.slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN);
}
