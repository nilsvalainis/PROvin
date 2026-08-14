/**
 * Deterministic quality checks for PROVIN expert AI comments (no API calls).
 * Used by golden fixtures and as a regression harness when prompts change.
 */

export type CommentQualityIssue = {
  code: string;
  message: string;
};

export type CommentQualityOptions = {
  /** Per-source comments must not contain a full mileage-synthesis essay. */
  field?: "source" | "mileage" | "incidents" | "generic";
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
