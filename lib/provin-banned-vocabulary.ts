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
    label: "duāla vēsture",
    pattern: /duāl\w*\s+vēstur/i,
    replacement: "sāc ar fiksētajiem faktiem, bez vēstures dualisma ievada",
    code: "vocabulary_duala_vesture",
  },
  {
    label: "caurskatāma vēsture (ievads)",
    pattern: /caurskatām\w*/i,
    replacement: "sāc ar fiksēto faktu, bez vēstures vērtējuma ievada",
    code: "vocabulary_caurskatama",
  },
  {
    label: "no vienas puses / no otras puses",
    pattern: /no\s+vienas\s+puses|no\s+otras\s+puses/i,
    replacement: "raksti faktu, tad ja vajag - servisa pārbaudi; bez pretstatījuma",
    code: "vocabulary_no_vienas_puses",
  },
  {
    label: "kas nav dārgs risks (šablona ievads)",
    pattern: /kas\s+nav\s+dārgs\s+risk/i,
    replacement: "raksti tikai aktuālo mezglu; bez nolieguma ievada",
    code: "vocabulary_kas_nav_dargs_risks",
  },
  {
    label: "uz šo motoru/agregātu neattiecas (nolieguma eseja)",
    pattern: /uz šo (?:motoru|agregātu|konstrukciju) neattiecas/i,
    replacement: "raksti tikai šim auto aktuālos mezglus; citu kodu kaites nemini",
    code: "vocabulary_neattiecas_denial",
  },
  {
    label: "bufer(is/a/i) (bampera vietā)",
    pattern: /\bbufer(is|a|u|i|iem|us|ā)\b/i,
    replacement: "bamperis / bampera / bamperi",
    code: "vocabulary_bufers",
  },
  {
    label: "mūža eļļa nenodrošina ilgmūžību (šablona teikums)",
    pattern: /m[uū]ža\s+e[ļl]{2}[uūas]*[^.]*?nenodrošina/i,
    replacement: "izlaid šo vispārīgo teikumu; ja jāpiemin, raksti konkrētu faktu par ŠO kārbu/agregātu",
    code: "vocabulary_muza_ellas_apgalvojums",
  },
  {
    label: "vakuums",
    pattern: /datu\s+vakuum|informācijas\s+vakuum|\bvakuums(?!ūkn)/i,
    replacement: "trūkums / datu neesamība",
    code: "vocabulary_vakuums",
  },
  {
    label: "svārstību slāpētājs",
    pattern: /(?:kloķvārpstas\s+)?(?:vibrācij[au]|svārstību)\s+slāpētāj/i,
    replacement: "kloķvārpstas skriemelis (demferis)",
    code: "vocabulary_vibraciju_slapetajs",
  },
  {
    label: "eksperts / ekspertīze",
    pattern: /ekspert/i,
    replacement: "apraksti analīzi bez personas lietvārda (ne speciālists)",
    code: "vocabulary_eksperts",
  },
] as const;

/**
 * Iekšējie V2/pipeline termini, ko klients neredz. Nav PROVIN_BANNED_VOCABULARY,
 * lai promptu avoti drīkstētu tos minēt kā aizliegumu.
 */
export const PROVIN_INTERNAL_CLIENT_TERMS: readonly BannedVocabularyEntry[] = [
  {
    label: "Riska kartē",
    pattern: /riska\s+kartē/i,
    replacement: "datos",
    code: "internal_riska_karte",
  },
  {
    label: "Dzinēja identifikācija",
    pattern: /dzinēja\s+identifikācij/i,
    replacement: "dzinēja kods",
    code: "internal_dzineja_identifikacija",
  },
  {
    label: "Dzinēja kods noteikts pēc jaudas",
    pattern: /dzinēja\s+kods noteikts pēc jaudas/i,
    replacement: "dzinēja kods datos nav fiksēts",
    code: "internal_engine_code_guess",
  },
  {
    label: "nav kartē / QA kartē",
    pattern: /atzīmē teikumus|pārraksti tikai tos|(?:nav|ja)\s+kartē/i,
    replacement: "datos",
    code: "internal_karte",
  },
  {
    label: "HECK",
    pattern: /\bHECK\b/,
    replacement: "aizmugures piedziņa",
    code: "internal_heck",
  },
  {
    label: "AGR-Kühler",
    pattern: /AGR[-\s]?K(?:ü|ue|u)hler/i,
    replacement: "EGR dzesētājs",
    code: "internal_agr_kuhler",
  },
  {
    label: "paka / pakā",
    pattern: /\bpakā\b|\bpaka\b/i,
    replacement: "agregātu zināšanas",
    code: "internal_paka",
  },
  {
    label: "brīfs",
    pattern: /\bbrīf/i,
    replacement: "kopsavilkums",
    code: "internal_brifs",
  },
  {
    label: "AVOTU FAKTI",
    pattern: /AVOTU\s+FAKTI/,
    replacement: "avota dati",
    code: "internal_avotu_fakti",
  },
  {
    label: "FLASH MAX",
    pattern: /FLASH\s+MAX/,
    replacement: "",
    code: "internal_flash_max",
  },
  {
    label: "KB:",
    pattern: /\bKB:/,
    replacement: "",
    code: "internal_kb",
  },
  {
    label: "operators / operatora norādes",
    pattern: /operatora\s+(?:norād|piezīm)|saskaņā ar operator/i,
    replacement: "",
    code: "internal_operator",
  },
  {
    label: "šajā auditā",
    pattern: /šajā\s+auditā/i,
    replacement: "",
    code: "internal_this_audit",
  },
  {
    label: "Rückruf",
    pattern: /R(?:ü|ue)ckruf/i,
    replacement: "ražotāja atsaukums",
    code: "internal_ruckruf",
  },
];

/** Droši aizstājami vārdi bez otra maksas izsaukuma (P13). */
const SAFE_VOCAB_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\binjektor(?:i|iem|u|a)?\b/gi, "iesmidzinātāji"],
  [/\bswirl\s+flap\w*/gi, "ieplūdes kolektors"],
  [/\bvirpuļvārst\w*/gi, "ieplūdes kolektors"],
  [/\bintegritāt\w*/gi, "stāvoklis"],
  [/\bšim automašīn/gi, "šai automašīn"],
  [/tipiski šim agregātam ir/gi, "šim dzinējam raksturīga"],
  [/tipiski šim agregātam/gi, "šim dzinējam raksturīga"],
];

export function applyBannedVocabularyReplacements(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, rep] of SAFE_VOCAB_REPLACEMENTS) out = out.replace(re, rep);
  return out;
}

export function findInternalClientTermHits(text: string): BannedVocabularyEntry[] {
  if (!text) return [];
  return PROVIN_INTERNAL_CLIENT_TERMS.filter((e) => e.pattern.test(text));
}

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
 * Explicit client-copy ban (LV/EN/RU/DE). Lives here so prompt source files
 * can inject it without embedding the Latvian e-word in scanned literals.
 */
export function buildForbiddenPersonaNounPromptRules(): string {
  return [
    "FORBIDDEN PERSONA NOUNS in client-facing copy (all languages, no exceptions):",
    "never the Latvian e-word family (eksperts and every inflection) and never ekspertīze;",
    "never English expert/experts; never Russian эксперт; never German Experte/Expertin/Experten;",
    "never speciālists as a substitute. Describe the analysis and the facts; do not name a persona.",
  ].join(" ");
}

const FORBIDDEN_PERSONA_NOUN_RES: readonly RegExp[] = [
  /ekspert/i,
  /\bspeciālist/i,
  /\bexperts?\b/i,
  /эксперт/i,
  /\bExpert(?:e|en|in|innen)?\b/,
];

export type ForbiddenPersonaNounHit = { label: string; code: string };

/** Eval / self-correction: persona nouns leaked into generated comment text. */
export function findForbiddenPersonaNounHits(text: string): ForbiddenPersonaNounHit[] {
  if (!text) return [];
  const hits: ForbiddenPersonaNounHit[] = [];
  if (/\bspeciālist/i.test(text)) hits.push({ label: "speciālists", code: "vocabulary_specialists" });
  if (/\bexperts?\b/i.test(text)) hits.push({ label: "expert", code: "vocabulary_expert_en" });
  if (/эксперт/i.test(text)) hits.push({ label: "эксперт", code: "vocabulary_expert_ru" });
  if (/\bExpert(?:e|en|in|innen)?\b/.test(text)) {
    hits.push({ label: "Experte", code: "vocabulary_expert_de" });
  }
  return hits;
}

const PERSONA_NOUN_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ekspertīz\w*/gi, "izvērtējums"],
  [/tehnisk(?:ais|ā|o)\s+ekspert(?:s|a|am|u|i|iem)?/gi, "tehniskā analīze"],
  [/auto\s+ekspert(?:s|a|am|u|i|iem)?/gi, "analīze"],
  [/eksperta\s+komentār(\w*)/gi, "komentār$1"],
  [/eksperta\s+novērojum(\w*)/gi, "novērojum$1"],
  [/eksperta\s+piezīm(\w*)/gi, "piezīm$1"],
  [/eksperta\s+sadaļ(\w*)/gi, "sadaļ$1"],
  [/eksperta\s+ziņojum(\w*)/gi, "ziņojum$1"],
  [/eksperta\s+atzinum(\w*)/gi, "atzinum$1"],
  [/eksperta\s+viedokl(\w*)/gi, "vērtējum$1"],
  [/\bekspert(?:s|a|am|u|i|iem|os|e)?\b/gi, ""],
  [/\bspeciālist(?:s|a|am|u|i|iem|e)?\b/gi, ""],
  [/\bexperts?\b/gi, ""],
  [/эксперт\w*/gi, ""],
  [/\bExpert(?:e|en|in|innen)?\b/g, ""],
];

/**
 * Deterministic safety net on AI-generated comment text only.
 * Replaces or drops persona nouns so they never reach the saved field.
 */
export function stripForbiddenPersonaNouns(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, rep] of PERSONA_NOUN_REPLACEMENTS) out = out.replace(re, rep);
  return out.replace(/[^\S\n]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");
}

export function textHasForbiddenPersonaNoun(text: string): boolean {
  if (!text) return false;
  return FORBIDDEN_PERSONA_NOUN_RES.some((re) => re.test(text));
}

const SUMMARY_DUALISM_OPENER = [
  /Pēc pieejamajiem datiem,?\s*automašīnai ir[^.]{0,160}(?:caurskatām|duāl)[^.]{0,80}\.\s*/gi,
  /[^.!?\n]*no\s+vienas\s+puses[^.!?\n]*[.!?]\s*/gi,
  /[^.!?\n]*no\s+otras\s+puses[^.!?\n]*[.!?]\s*/gi,
];

/** Noņem kopsavilkuma dual-history / on-one-hand ievada teikumus un veco virsrakstu. */
export function stripSummaryDualismOpener(text: string): string {
  if (!text) return text;
  let out = text.replace(/^Kopējā aina\s*$/gim, "Fakti");
  for (const re of SUMMARY_DUALISM_OPENER) {
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
