/**
 * VIENOTAIS AVOTS (Single Source of Truth) aizliegtajam latviešu vārdu krājumam
 * klienta redzamajā ✨ tekstā. Promptu teksts (source-summary-comment-format.ts →
 * PROVIN_REPORT_COPY_VOCABULARY) un eval pārbaudes (lib/ai-eval/comment-quality.ts)
 * lasa TIKAI šo sarakstu — nedublē atsevišķus regex citur, lai neatkārtotos vecā
 * stila-noteikumu sadrumstalotība starp failiem.
 */

export type BannedVocabularyEntry = {
  /** Cilvēkam lasāms aizliegtais vārds/frāze (rāda promptā un eval ziņojumā). */
  label: string;
  /** Detektēšanas regex (case-insensitive) klienta tekstā. */
  pattern: RegExp;
  /** Ieteicamais aizstājējs. */
  replacement: string;
  /** Eval issue kods. */
  code: string;
};

export const PROVIN_BANNED_VOCABULARY: readonly BannedVocabularyEntry[] = [
  {
    label: "saime",
    pattern: /\bsaime/i,
    replacement: "agregāts / konstrukcija / paaudze",
    code: "vocabulary_saime",
  },
  {
    label: "Baltija / Baltijas",
    pattern: /baltij/i,
    replacement: "nosauc valstis atsevišķi (Latvija, Lietuva, Igaunija)",
    code: "vocabulary_baltija",
  },
  {
    label: "injektori",
    pattern: /injektor/i,
    replacement: "iesmidzinātājs (sprausla)",
    code: "vocabulary_injektori",
  },
  {
    label: "vidējs uzturēšanas risks",
    pattern: /vidējs uzturēšanas risks/i,
    replacement: "ierasta uzturēšanas izmaksa",
    code: "vocabulary_videjs_risks",
  },
  {
    label: "kontrolpunkts klātienē",
    pattern: /kontrolpunkts klātienē/i,
    replacement: "jāpārbauda klātienē / pārbaudes punkts",
    code: "vocabulary_kontrolpunkts",
  },
  {
    label: "vakuums",
    pattern: /datu\s+vakuum|informācijas\s+vakuum|\bvakuums(?!ūkn)/i,
    replacement: "trūkums / datu neesamība",
    code: "vocabulary_vakuums",
  },
  {
    label: "vibrāciju slāpētājs",
    pattern: /(?:vibrācij[au]|svārstību)\s+slāpētāj/i,
    replacement: "kloķvārpstas skriemelis (demferis)",
    code: "vocabulary_vibraciju_slapetajs",
  },
] as const;

/** Ģenerē prompta bloku no vienotā saraksta — nekad nekopē manuāli citur. */
export function buildBannedVocabularyPromptRules(): string {
  const rows = PROVIN_BANNED_VOCABULARY.map((e) => `„${e.label}” → ${e.replacement}`).join("; ");
  return `BANNED VOCABULARY (never in client-facing Latvian text, no exceptions): ${rows}.`;
}

/** Atrod pārkāpumus tekstā — izmanto eval un runtime self-correction pārbaudei. */
export function findBannedVocabularyHits(text: string): BannedVocabularyEntry[] {
  if (!text) return [];
  return PROVIN_BANNED_VOCABULARY.filter((e) => e.pattern.test(text));
}

/**
 * Mehāniskais drošības tīkls pēc ģenerēšanas. Vakuma sūknis / vakuumsūknis paliek
 * (tas ir mezgls, ne datu metafora).
 */
export function applyBannedVocabularyReplacements(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/kloķvārpstas\s+(?:vibrācij[au]|svārstību)\s+slāpētāj\p{L}*(?:\s*\(\s*skriemelis\s*\))?/giu, (
    match,
  ) => preserveLeadingCase(match, "kloķvārpstas skriemelis (demferis)"));
  out = out.replace(/(?:vibrācij[au]|svārstību)\s+slāpētāj\p{L}*/giu, (match) =>
    preserveLeadingCase(match, "kloķvārpstas skriemelis (demferis)"),
  );
  out = out.replace(/datu\s+vakuum[aāusm]*/gi, (match) =>
    preserveLeadingCase(match, "datu neesamība"),
  );
  out = out.replace(/informācijas\s+vakuum[aāusm]*/gi, (match) =>
    preserveLeadingCase(match, "datu neesamība"),
  );
  out = out.replace(/\bVakuums(?!ūkn)/g, "Trūkums");
  out = out.replace(/\bvakuums(?!ūkn)/g, "trūkums");
  return out;
}

function preserveLeadingCase(original: string, replacement: string): string {
  const first = original.trimStart()[0];
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
