/**
 * Deterministic quality checks for PROVIN expert AI comments (no API calls).
 * Used by golden fixtures and as a regression harness when prompts change.
 */
import { findBannedVocabularyHits } from "@/lib/provin-banned-vocabulary";
import { findCopiedOtherAuditPhrases } from "@/lib/admin-ai-other-audit-style";

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
  /** Deterministiskais TA noseguma līmenis — pastiprina nodiluma-kā-riska pārbaudi. */
  taCoverageLevel?: "fresh" | "valid" | "expired" | "none";
  /** Kontekstā (jebkurā laukā) minēta aplīmēšana — riskiem un kopsavilkumam jāpiemin. */
  wrapPresentInContext?: boolean;
  /** Deterministiskais ziemas sāls / rūsas bloks saka OBLIGĀTI. */
  winterSaltRustRequiredInContext?: boolean;
  /** Pilnais user prompt — lai noķertu sveša auto faktu kopēšanu. */
  sourcePrompt?: string;
};

/** Aplīmēšana / plēve / PPF — ne CSS „wrap”. */
export const VEHICLE_WRAP_MENTION_RE =
  /aplīm|aizsargplēv|vinila\s+plēv|\bppf\b|plēv(?:e|es|i|ēm|ēm|ītes)?\b/i;

const VEHICLE_WRAP_RISK_RE =
  /zem plēves|bez (?:plēves )?demontāž|demontēj|neredz|nevar (?:novērtēt|konstatēt)|slēpj|nokopēt|tona maiņ|mainīt ton|ražotājs nav zināms|uzņem(?:ties|ts) risks|atjaunotā detaļa/i;

const WINTER_SALT_RUST_TOPIC_RE = /rūs|korozij/i;

export function mentionsWinterSaltRust(text: string): boolean {
  return WINTER_SALT_RUST_TOPIC_RE.test(text ?? "");
}

/** Tipiskās ziemas sāls vietas — jānosauc vismaz divas. */
export function countTypicalWinterSaltRustSpots(text: string): number {
  const t = text ?? "";
  let n = 0;
  if (/ark/i.test(t)) n += 1;
  if (/sliekš/i.test(t)) n += 1;
  if (/numura zīm|bagāžniek|numurzīm/i.test(t)) n += 1;
  return n;
}

export function mentionsVehicleWrap(text: string): boolean {
  return VEHICLE_WRAP_MENTION_RE.test(text ?? "");
}

/**
 * Self-correction drīkst skatīt tikai ŠĪ auto faktus.
 * Uzdevuma rindas („Ja kontekstā auto ir aplīmēts”), citu auditu fragmenti
 * un stila korpuss NAV triggeris — citādi plēve tiek uzspiesta katram auto.
 */
export function extractOrderFactsForWrapDetection(prompt: string): string {
  let t = prompt ?? "";
  t = t
    .split(/(?=^### )/m)
    .filter(
      (block) =>
        !/^### (?:Vēsturiskie PROVIN auditi|Citu PROVIN auditu stils|PROVIN stilistiskā atmiņa|Mācījumi no iepriekšējām)/.test(
          block,
        ),
    )
    .join("");
  const dash = t.lastIndexOf("\n---\n");
  if (dash >= 0 && /Sagatavo|OBLIGĀTI:|Uzdevums:/i.test(t.slice(dash))) {
    t = t.slice(0, dash);
  }
  t = t.replace(
    /(?:^|\n)[^\n]*(?:WRAP\s*\/\s*(?:FILM|APLĪMĒŠANA)|Ja kontekstā auto ir aplīmēts|Ja jebkurā (?:laukā|kontekstā)[^\n]{0,120}aplīmēts|Neizdomā plēvi)[^\n]*/gi,
    "",
  );
  return t;
}

export function mentionsVehicleWrapInOrderFacts(prompt: string): boolean {
  return mentionsVehicleWrap(extractOrderFactsForWrapDetection(prompt));
}

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
  technical_risks: 3,
  inspection: 3,
};

const MIN_CHARS_BY_FIELD: Partial<Record<string, number>> = {
  technical_risks: 800,
  inspection: 400,
};

/** Nodilums kā pirkuma risks — neatkarīgi no TA, šis nav modeļa risks. */
const TA_WEAR_AS_RISK_RE =
  /(?:bieži nepieciešam\w*.{0,80}(?:buš|bukš|lodbalst|svir)|(?:buš|bukš|lodbalst|sviru).{0,50}nomaiņ)/i;

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
    if (TA_WEAR_AS_RISK_RE.test(t) || (opts.taCoverageLevel === "fresh" && /galvenais (?:pirkuma )?risks.{0,60}(?:svir|buš|lodbalst|bremž)/i.test(t))) {
      issues.push({
        code: "ta_wear_as_risk",
        message:
          "Tehnisko risku sadaļā nedrīkst pasniegt TA nosegtu nodilumu (sviras, bukses, lodbalsti, bremzes) kā pirkuma risku — tas ir klātienes punkts vai vispār nav jāmin",
      });
    }
    if (opts.wrapPresentInContext && !mentionsVehicleWrap(t)) {
      issues.push({
        code: "wrap_film_missing",
        message:
          "Kontekstā auto ir aplīmēts — tehnisko risku analīzē jāpiemin plēve un neredzamais darbs zem tās",
      });
    } else if (mentionsVehicleWrap(t) && !VEHICLE_WRAP_RISK_RE.test(t)) {
      issues.push({
        code: "wrap_film_risk_incomplete",
        message:
          "Aplīmēšanu nedrīkst atstāt kā faktu vien — jāpasaka, ka zem plēves kvalitāti nevar novērtēt bez demontāžas",
      });
    }
    if (opts.winterSaltRustRequiredInContext && !mentionsWinterSaltRust(t)) {
      issues.push({
        code: "winter_salt_rust_missing",
        message:
          "Ziemas sāls ekspozīcija ir obligāta — tehnisko risku analīzē jāpiemin rūsa kā klimata risks (ne kā pierādīts defekts)",
      });
    } else if (opts.winterSaltRustRequiredInContext && countTypicalWinterSaltRustSpots(t) < 2) {
      issues.push({
        code: "winter_salt_rust_spots_missing",
        message:
          "Rūsas rindkopā jāsauc tipiskās vietas: arkas, sliekšņi, bagāžnieka vāks / numura zīmes apgaismojums",
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
    if (opts.winterSaltRustRequiredInContext && !mentionsWinterSaltRust(t)) {
      issues.push({
        code: "winter_salt_rust_missing",
        message:
          "Ziemas sāls ekspozīcija ir obligāta — ieteikumos jāliek rūsas pārbaude tipiskajās vietās",
      });
    } else if (opts.winterSaltRustRequiredInContext && countTypicalWinterSaltRustSpots(t) < 2) {
      issues.push({
        code: "winter_salt_rust_spots_missing",
        message:
          "Ieteikumos jāsauc vismaz divas tipiskās rūsas vietas: arkas, sliekšņi, bagāžnieka vāks / numura zīmes gaismas",
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
    if (opts.wrapPresentInContext && !mentionsVehicleWrap(t)) {
      issues.push({
        code: "wrap_film_missing",
        message: "Kontekstā auto ir aplīmēts — kopsavilkumā tas jāpiemin kā pircēja uzņemts risks",
      });
    } else if (mentionsVehicleWrap(t) && !VEHICLE_WRAP_RISK_RE.test(t)) {
      issues.push({
        code: "wrap_film_risk_incomplete",
        message:
          "Kopsavilkumā par plēvi jāpasaka, ka zem tās krāsojumu nevar novērtēt — ne tikai ka auto ir aplīmēts",
      });
    }
  }

  if (opts.sourcePrompt != null) {
    if (mentionsVehicleWrap(t) && !mentionsVehicleWrapInOrderFacts(opts.sourcePrompt)) {
      issues.push({
        code: "wrap_film_invented",
        message:
          "Aplīmēšana / plēve nav šī auto datos — to nedrīkst paņemt no cita audita, stila parauga vai uzdevuma rindas",
      });
    }
    const leaks = findCopiedOtherAuditPhrases(
      t,
      opts.sourcePrompt,
      extractOrderFactsForWrapDetection(opts.sourcePrompt),
    );
    if (leaks.length > 0) {
      issues.push({
        code: "foreign_audit_fact_copied",
        message: `Nedrīkst kopēt cita auto faktus. Izejā atkārtojas svešs fragments: „${leaks[0]}”`,
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
