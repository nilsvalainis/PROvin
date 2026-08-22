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
    label: "jaudas pārveidotājs",
    pattern: /jaudas\s+pārveidotāj/i,
    replacement: "divmasu spararats (vai hidrotransformators, ja runa par kārbas sajūgu)",
    code: "vocabulary_jaudas_parveidotajs",
  },
  {
    label: "virpuļvārsts",
    pattern: /virpuļvārst/i,
    replacement: "ieplūdes kolektors",
    code: "vocabulary_virpulyvarsts",
  },
  {
    label: "swirl flap",
    pattern: /swirl\s+flap/i,
    replacement: "ieplūdes kolektors",
    code: "vocabulary_swirl_flap",
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
