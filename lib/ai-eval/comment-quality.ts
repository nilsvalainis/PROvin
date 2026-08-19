/**
 * Deterministic quality checks for PROVIN expert AI comments (no API calls).
 * Used by golden fixtures and as a regression harness when prompts change.
 */
import { findBannedVocabularyHits } from "@/lib/provin-banned-vocabulary";

export type CommentQualityIssue = {
  code: string;
  message: string;
};

export type CommentQualityOptions = {
  /** Per-source comments must not contain a full mileage-synthesis essay. */
  field?:
    | "source"
    | "mileage"
    | "incidents"
    | "generic"
    | "technical_risks"
    | "inspection"
    | "summary";
};

const AUTOMIBILIS_RE = /\bautomobīl/i;
const LEADING_DASH_PARA_RE = /(^|\n\n)\s*[-–•]\s+/;
const LIST_LINE_RE = /^\s*[-•*]\s+/m;

/** Pārspīlējumi un absolūti apgalvojumi — PROVIN raksta atturīgi. */
const HYPERBOLE_RE =
  /\b(kritisk\w*|anomālij\w*|katastrofāl\w*|šokējoš\w*|drastisk\w*|briesmīg\w*|milzīg\w*|nepārprotami|acīmredzami|garantēti)\b/i;

/** Maksimālais saprātīgais garums pēc lauka (bez operatora materiāla). */
const MAX_CHARS_BY_FIELD: Record<string, number> = {
  source: 1400,
  incidents: 1800,
  mileage: 2400,
  generic: 1800,
  technical_risks: 16_000,
  inspection: 10_000,
};

const MIN_PARAS_BY_FIELD: Partial<Record<string, number>> = {
  technical_risks: 7,
  inspection: 5,
};

const MIN_CHARS_BY_FIELD: Partial<Record<string, number>> = {
  technical_risks: 1800,
  inspection: 650,
};

/** Heuristics for a full mileage essay that belongs only in NOBRAUKUMA VĒSTURES KOMENTĀRS. */
const MILEAGE_ESSAY_SIGNALS = [
  /vidēji\s+\*?\*?[\d\s]+(?:–|-|līdz)\s*[\d\s]+\*?\*?\s*km\s+gadā/i,
  /motorstund/i,
  /datu\s+vakuum/i,
  /pilsētas[–-]šosejas|šosejas\s+režīm/i,
  /lineār[au]\s+.*nobraukum|nobraukuma\s+līkne\s+ir\s+lineār/i,
];

export function evaluateExpertCommentQuality(
  text: string,
  opts: CommentQualityOptions = {},
): CommentQualityIssue[] {
  const issues: CommentQualityIssue[] = [];
  const t = (text ?? "").trim();
  if (!t) {
    issues.push({ code: "empty", message: "Komentārs ir tukšs" });
    return issues;
  }

  if (AUTOMIBILIS_RE.test(t)) {
    issues.push({
      code: "vocabulary_automobilis",
      message: 'Nedrīkst lietot „automobīlis” — izmanto „automašīna”',
    });
  }

  for (const hit of findBannedVocabularyHits(t)) {
    issues.push({
      code: hit.code,
      message: `Nedrīkst lietot „${hit.label}” — izmanto: ${hit.replacement}`,
    });
  }

  if (/[\u2012\u2013\u2014\u2015\u2212]/.test(t)) {
    issues.push({
      code: "unicode_dash",
      message: "Klientam redzamā tekstā lieto īso ASCII defisi „-”, ne garo/vidējo domuzīmi",
    });
  }

  if (LEADING_DASH_PARA_RE.test(t) || LIST_LINE_RE.test(t)) {
    issues.push({
      code: "list_prefix",
      message: "Eksperta komentārā nedrīkst sākt rindas ar saraksta prefiksu (-, •, *)",
    });
  }

  const hyperbole = HYPERBOLE_RE.exec(t);
  if (hyperbole) {
    issues.push({
      code: "hyperbolic_language",
      message: `Pārspīlēts formulējums „${hyperbole[0]}” — izmanto atturīgu vārdu (neatbilstība, būtisks, paaugstināts risks)`,
    });
  }

  if (/!/.test(t)) {
    issues.push({
      code: "exclamation",
      message: "Eksperta komentārā nelieto izsaukuma zīmes",
    });
  }

  if (/\*/.test(t)) {
    issues.push({
      code: "markdown_asterisk",
      message: "Klientam redzamā tekstā nelieto * vai ** — virsraksts savā rindā, tad rindkopa",
    });
  }

  const field = opts.field ?? "generic";
  const maxChars = MAX_CHARS_BY_FIELD[field] ?? MAX_CHARS_BY_FIELD.generic;
  if (t.length > maxChars) {
    issues.push({
      code: "too_long",
      message: `Komentārs ir pārāk garš (${t.length} rakstzīmes, mērķis līdz ${maxChars})`,
    });
  }

  if (field === "source") {
    const hits = MILEAGE_ESSAY_SIGNALS.filter((re) => re.test(t)).length;
    if (hits >= 2) {
      issues.push({
        code: "source_mileage_essay",
        message:
          "Avota komentārs satur pārāk daudz nobraukuma sintēzes — atstāj to „NOBRAUKUMA VĒSTURES KOMENTĀRAM”",
      });
    }
  }

  if (field === "mileage") {
    const hasKm = /\b\d[\d\s]*\s*km\b/i.test(t) || /nobraukum/i.test(t);
    if (!hasKm) {
      issues.push({
        code: "mileage_missing_focus",
        message: "Nobraukuma komentāram jābūt ar km / nobraukuma fokusu",
      });
    }
  }

  const paraCount = t.split(/\n\s*\n/).filter((p) => p.trim().length > 40).length;
  const minParas = MIN_PARAS_BY_FIELD[field];
  if (minParas != null && paraCount < minParas) {
    issues.push({
      code: "too_short",
      message: `Flagship laukam par maz rindkopu (${paraCount}, mērķis ≥ ${minParas})`,
    });
  }
  const minChars = MIN_CHARS_BY_FIELD[field];
  if (minChars != null && t.length < minChars) {
    issues.push({
      code: "too_short",
      message: `Flagship laukam par īsu (${t.length} rakstzīmes, mērķis ≥ ${minChars})`,
    });
  }

  if (field === "technical_risks" || field === "inspection") {
    if (/€/.test(t) || /\bEUR\b/.test(t) || /orientējoš[\w]*\s+[^\n]{0,60}eiro/i.test(t)) {
      issues.push({
        code: "invented_repair_eur",
        message: "Tehnisko risku un apskates komentāros nav orientējošu remonta EUR joslu",
      });
    }
  }

  if (field === "source" || field === "mileage") {
    if (/orientējoš[\w]*\s+[^\n]{0,80}(?:€|EUR|eiro)|remonta izmaks|profilakses izmaks|Baltijas neatkarīg/i.test(t)) {
      issues.push({
        code: "invented_repair_eur",
        message: "Avotu/nobraukuma komentāros nav izdomātu remonta EUR tāmju",
      });
    }
  }

  if (field === "technical_risks") {
    if (!/identifik|dzinēj|ātrumkārb|kārba|ķēd|zobsiksn|piedziņ/i.test(t)) {
      issues.push({
        code: "missing_aggregate",
        message: "Tehnisko risku analīzē jāidentificē agregāts (dzinējs/kārba/ķēde), ne vispārīgs dīzelis",
      });
    }
    const firstPara = t.split(/\n\s*\n/)[0] ?? "";
    const firstLine = firstPara.split("\n")[0] ?? "";
    if (
      /identifikācij/i.test(firstLine) ||
      /\*\*[^*]*identifikācij[^*]*\*\*/i.test(firstPara) ||
      (/\b(šis ir|šī ir|šī automašīna ir|šis auto ir)\b/i.test(firstPara) &&
        /(bmw|audi|volkswagen|\bvw\b|mercedes|renault|volvo|škoda|toyota)/i.test(firstPara))
    ) {
      issues.push({
        code: "tech_risks_identity_intro",
        message: "Pirmā rindkopa nedrīkst būt auto prezentācija — sāc ar riska faktu",
      });
    }
  }

  if (field === "inspection") {
    if (!/jāpārbauda|ieteicams|rūpīgi jā/i.test(t)) {
      issues.push({
        code: "missing_inspection_verb",
        message: "Apskates ieteikumos jālieto „Jāpārbauda” / „Ieteicams” / „Rūpīgi jā…”",
      });
    }
  }

  if (field === "summary") {
    if (/€/.test(t) || /\bEUR\b/.test(t)) {
      issues.push({
        code: "summary_price",
        message: "Kopsavilkumā neraksta cenas / EUR summas — sludinājuma cena ir cenas vērtējumā, remonta tāmes nav nevienā komentārā",
      });
    }
  }

  return issues;
}

export function assertExpertCommentQuality(
  text: string,
  opts?: CommentQualityOptions,
): void {
  const issues = evaluateExpertCommentQuality(text, opts);
  if (issues.length > 0) {
    throw new Error(issues.map((i) => `${i.code}: ${i.message}`).join("; "));
  }
}
