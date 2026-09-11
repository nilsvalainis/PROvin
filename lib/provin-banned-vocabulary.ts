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
  {
    label: "uzturēšanas punkts",
    pattern: /uzturēšanas\s+punkts/i,
    replacement: "ierasta uzturēšanas izmaksa / konkrētais mezgls bez AI-šablona",
    code: "vocabulary_uzturesanas_punkts",
  },
  {
    label: "integritāte",
    pattern: /integritāt/i,
    replacement: "stāvoklis",
    code: "vocabulary_integritate",
  },
  {
    label: "kontūrā",
    pattern: /\bkontūrā\b/i,
    replacement: "virsbūvē (krāsa / virsbūve) vai sistēmā (elektronika / programmatūra)",
    code: "vocabulary_kontura",
  },
  {
    label: "labvēlīgs signāls",
    pattern: /labvēlīg\w*\s+signāl/i,
    replacement: "tas datos izskatās labi / labs rādījums datos (vai vienkārši konkrētais fakts bez šīs frāzes)",
    code: "vocabulary_labveligs_signals",
  },
  {
    label: "labvēlīgs faktors",
    pattern: /labvēlīg\w*\s+faktor/i,
    replacement: "tas palīdz / tas šim mezglam nāk par labu (vai vienkārši fakts)",
    code: "vocabulary_labveligs_faktors",
  },
  {
    label: "dokumentāri pierādījumi",
    pattern: /dokumentār\w*\s+pierādījum/i,
    replacement: "dokumenti",
    code: "vocabulary_dokumentari_pieradijumi",
  },
  {
    label: "tuvākā laika ieguldījums / risks",
    pattern: /tuvāk(?:ā|a)\s+laika\s+(?:ieguldījum|rēķin|risk|izmaks|naudas\s+punkt|profilaks)/i,
    replacement: "konkrētais mezgls / fakts bez „tuvākā laika” šablona",
    code: "vocabulary_tuvaka_laika",
  },
  {
    label: "finansiāli nozīmīgākais … ieguldījums",
    pattern: /finansiāli\s+nozīmīgāk\w*/i,
    replacement: "konkrētais mezgls (bez „finansiāli nozīmīgākais”)",
    code: "vocabulary_finansiali_nozimigakais",
  },
  {
    label: "nākotnes risks",
    pattern: /nākotnes\s+risk/i,
    replacement: "konkrētais fakts / ko pārbaudīt (bez „nākotnes risks”)",
    code: "vocabulary_nakotnes_risks",
  },
  {
    label: "divējādu ainu / pozitīvā puse",
    pattern: /divējād\w*\s+ain|pozitīvā\s+puse\s+ir/i,
    replacement: "sāc ar faktiem, bez „divējādās ainas” / „pozitīvās puses” ievada",
    code: "vocabulary_divejada_aina",
  },
  {
    label: "kas nav dārgs risks (šablona ievads)",
    pattern: /kas\s+nav\s+dārgs\s+risk/i,
    replacement: "ja kaut kas neattiecas - pasaki faktu bez šīs ievada frāzes",
    code: "vocabulary_kas_nav_dargs_risks",
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
