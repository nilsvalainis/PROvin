import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";

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

/** Apvieno PDF teksta slāni un Gemini transkriptu — PDF teksts ir primārais avots. */
export function mergeCsddPdfRawSources(textHint: string, geminiRaw: string): string {
  const pdf = normalizeCsddRawText(textHint).trim();
  const gemini = normalizeCsddRawText(geminiRaw).trim();
  if (!pdf) return gemini;
  if (!gemini) return pdf;
  if (pdf.includes(gemini)) return pdf;
  if (gemini.includes(pdf) && pdf.length >= gemini.length * 0.55) return pdf;

  const missingChunks: string[] = [];
  for (const marker of CSDD_SECTION_MARKERS) {
    if (gemini.includes(marker) && !pdf.includes(marker)) {
      const idx = gemini.indexOf(marker);
      missingChunks.push(gemini.slice(idx, idx + 12_000));
    }
  }
  if (missingChunks.length === 0) return pdf.slice(0, 500_000);
  return `${pdf}\n\n${missingChunks.join("\n\n")}`.slice(0, 500_000);
}
