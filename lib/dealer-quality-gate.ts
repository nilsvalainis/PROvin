/**
 * Dīlera datu «ēnu režīma» kvalitātes pārbaude (Nils 22.11.2026).
 * Tīra funkcija: ievade = darba statuss + melnraksta dati (RAW, servisa tabula, AI lauki, PDF),
 * izvade = spriedums «would_send» / «would_hold» + pārbaužu saraksts ar konkrētiem piemēriem.
 * Neko nesūta un neko nemaina - tikai statistikai, lai pēc 2-3 nedēļām lemtu par pusautomātisku sūtīšanu.
 * Kļūdu tipi no audita zurnals/dilera-atskaite-audits-2026-11-22.md.
 */
import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  autoRecordsServiceWorkRowIsPrintable,
  DEALER_VISIT_SAME_DATE_MAX_KM_DIFF,
  normalizeAutoRecordsServiceWorkRow,
  serviceVisitDatesAreClose,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { isDealerRecommendationSentence } from "@/lib/dealer-comments-review-core";
import { commentContradictsPowertrain, extractLoadedPowertrainIdentity } from "@/lib/comment-powertrain-guard";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import {
  DEALER_SHADOW_GATE_VERSION,
  dealerGateVerdictFromChecks,
  type DealerGateCheck,
  type DealerGateCheckId,
  type DealerGatePlace,
  type DealerGateSeverity,
  type DealerShadowGate,
  type DealerShadowGatePdf,
} from "@/lib/dealer-shadow-types";
import { oneautoWorksNeedLvTranslation } from "@/lib/dealer-works-language";
import type { OneautoServiceEvent } from "@/lib/oneauto-catalog";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { buildDealerVisitSummary } from "@/lib/pdf-dealer-timeline";
import { extractVehicleDrivetrain, findDrivetrainContradictions, type RegistryDrivetrain } from "@/lib/registry-drivetrain";
import { checkSourceConsistency, formatSourceIssueLine, type SourceIssue } from "@/lib/source-consistency";

export type DealerQualityGateInput = {
  jobVin: string;
  job: Pick<DealerDataJob, "status" | "error" | "refund" | "skipTranslate" | "commentLang"> | null;
  /** Servisa tabula tā, kā to drukā PDF. */
  serviceWorks: readonly AutoRecordsServiceWorkRow[];
  /** OneAuto RAW (oriģinālvalodā, pirms tulkojuma). */
  rawEvents: readonly OneautoServiceEvent[];
  /** AI lauki kā vienkāršs teksts. */
  oilNotes: string;
  comments: string;
  /** Koda fakti (tie paši, ko PDF un AI prompts). */
  code: {
    oilChangeCount: number;
    avgIntervalKm: number | null;
    ringIntervalKm: number | null;
    maxIntervalKm: number | null;
    minIntervalKm: number | null;
    longestGapKm: number | null;
    longestGapMonths: number | null;
    monthsSinceLast: number | null;
  };
  drivetrain: RegistryDrivetrain | null;
  /** AI teksts min citu dzinēju / degvielu nekā ielasītie dati. */
  powertrainContradiction: boolean;
  /** Melnraksta VIN (auto dati); tukšs, ja nav. */
  draftVin: string;
  /** Kritiskas avotu pretrunas (lib/source-consistency.ts), bez AI teksta punktiem - tos pārbauda augstāk. */
  sourceIssues?: readonly SourceIssue[];
  pdf: DealerShadowGatePdf | null;
};

const TITLES: Record<DealerGateCheckId, string> = {
  job_status: "Ielases statuss",
  raw_dates: "Datumi un km atbilst RAW",
  oil_facts: "Eļļas maiņu skaitļi sakrīt ar kodu",
  translation: "Darbi pārtulkoti",
  forbidden: "Aizliegtie vārdi un ieteikumi",
  contradictions: "Pretrunas ar datiem",
  pdf: "PDF gatavs, VIN sakrīt",
  ai_fields: "Abi AI lauki aizpildīti",
};

/** Minimālais garums, zem kura AI lauks uzskatāms par nepabeigtu. */
export const DEALER_GATE_MIN_OIL_CHARS = 40;
export const DEALER_GATE_MIN_COMMENTS_CHARS = 80;
/** Netulkotas rindas: līdz šim skaitam - brīdinājums, vairāk - aizturēt. */
export const DEALER_GATE_UNTRANSLATED_WARN_MAX = 2;

function ok(id: DealerGateCheckId, place?: DealerGatePlace): DealerGateCheck {
  return { id, title: TITLES[id], state: "ok", severity: "block", reason: "", ...(place ? { place } : {}) };
}

function skip(id: DealerGateCheckId, reason = ""): DealerGateCheck {
  return { id, title: TITLES[id], state: "skip", severity: "warn", reason };
}

function fail(id: DealerGateCheckId, severity: DealerGateSeverity, reason: string, place?: DealerGatePlace): DealerGateCheck {
  return { id, title: TITLES[id], state: "fail", severity, reason: reason.slice(0, 400), ...(place ? { place } : {}) };
}

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function kmDigits(odometer: string): string {
  return (odometer ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function kmText(odometer: string): string {
  const d = kmDigits(odometer);
  return d ? `${groupDigits(Number(d))} km` : "km nav";
}

function clip(s: string, max = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function sentencesOf(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=\p{Lu})/u))
    .map((s) => s.trim())
    .filter(Boolean);
}

// (h) ---------------------------------------------------------------------------------------------

function checkJobStatus(input: DealerQualityGateInput): DealerGateCheck {
  const job = input.job;
  if (!job) return fail("job_status", "block", "Ielases darba ieraksta nav - nav ko sūtīt.", "job");
  if (job.refund) return fail("job_status", "block", "Maksājums jau atgriezts - atskaite netiek sūtīta.", "job");
  switch (job.status) {
    case "done":
      return ok("job_status");
    case "no_data":
      return fail("job_status", "block", "Dīlera datu nav - klientam sūta «datu nav» ziņu, ne atskaiti.", "job");
    case "no_vin":
      return fail("job_status", "block", "Pasūtījumam nav VIN - ielase nav notikusi.", "job");
    case "pending":
    case "running":
      return fail("job_status", "block", "Ielase vēl nav pabeigta.", "job");
    case "retry_wait":
      return fail("job_status", "block", "OneAuto serveris neatbild - ielase atkārtosies automātiski.", "job");
    case "failed":
      return fail("job_status", "block", `Ielase beidzās ar kļūdu (${clip(job.error ?? "nezināma", 60)}).`, "job");
    default:
      return fail("job_status", "block", "Nezināms ielases statuss.", "job");
  }
}

// (a) ---------------------------------------------------------------------------------------------

function normalizedRaw(rawEvents: readonly OneautoServiceEvent[]): AutoRecordsServiceWorkRow[] {
  return rawEvents
    .filter((e) => (e.date ?? "").trim() || (e.odometer ?? "").trim())
    .map((e) =>
      normalizeAutoRecordsServiceWorkRow({ date: e.date ?? "", odometer: e.odometer ?? "", location: e.place ?? "", works: e.works ?? "" }),
    );
}

/** Vai tabulas rinda atrodama RAW pēc #1118 sapludināšanas noteikumiem. */
export function dealerRowFoundInRaw(row: AutoRecordsServiceWorkRow, raw: readonly AutoRecordsServiceWorkRow[]): boolean {
  const km = kmDigits(row.odometer);
  const date = row.date.trim();
  return raw.some((r) => {
    const rKm = kmDigits(r.odometer);
    const rDate = r.date.trim();
    if (!km) return Boolean(date) && rDate === date;
    if (rKm === km) {
      if (!date || !rDate || rDate === date) return true;
      // Viena vizīte (vienāds km, tuvi datumi) - tabulā var palikt kāds no grupas datumiem.
      return serviceVisitDatesAreClose(r, row);
    }
    // Tajā pašā dienā ar nelielu km starpību vizītes tiek apvienotas.
    return Boolean(date) && rDate === date && rKm !== "" && Math.abs(Number(rKm) - Number(km)) <= DEALER_VISIT_SAME_DATE_MAX_KM_DIFF;
  });
}

function nearestRaw(row: AutoRecordsServiceWorkRow, raw: readonly AutoRecordsServiceWorkRow[]): AutoRecordsServiceWorkRow | null {
  const km = kmDigits(row.odometer);
  return raw.find((r) => km && kmDigits(r.odometer) === km) ?? raw.find((r) => r.date.trim() === row.date.trim()) ?? null;
}

function checkRawDates(input: DealerQualityGateInput): DealerGateCheck {
  const rows = input.serviceWorks.filter((r) => r.date.trim() || r.odometer.trim());
  if (rows.length === 0) return fail("raw_dates", "block", "Servisa tabula ir tukša.", "service_table");
  const raw = normalizedRaw(input.rawEvents);
  if (raw.length === 0) {
    return fail("raw_dates", "warn", "Melnrakstā nav saglabāts OneAuto RAW - datumus pārbaudīt nevar.", "service_table");
  }
  // 1) Katra tabulas rinda (datums + km) ir RAW.
  const missing = rows.filter((r) => !dealerRowFoundInRaw(r, raw));
  if (missing.length > 0) {
    const first = missing[0]!;
    const near = nearestRaw(first, raw);
    const hint = near ? ` (RAW tuvākais: ${near.date || "datums nav"} · ${kmText(near.odometer)})` : "";
    const more = missing.length > 1 ? ` Vēl ${missing.length - 1} rindas.` : "";
    return fail(
      "raw_dates",
      "block",
      `Tabulā ${first.date || "datums nav"} · ${kmText(first.odometer)} - RAW šāda ieraksta nav${hint}.${more}`,
      "service_table",
    );
  }
  // 2) Katra RAW vizīte ar darbiem ir tabulā; ja tās km tabulā ir pie cita (tāla) datuma - vizīte sapludināta (audits K1).
  const printableRaw = raw.filter(autoRecordsServiceWorkRowIsPrintable);
  const lost = printableRaw.filter((r) => !rows.some((t) => dealerRowFoundInRaw(t, [r])));
  const merged = lost.find((r) => {
    const km = kmDigits(r.odometer);
    return Boolean(km) && rows.some((t) => kmDigits(t.odometer) === km);
  });
  if (merged) {
    const into = rows.find((t) => kmDigits(t.odometer) === kmDigits(merged.odometer))!;
    return fail(
      "raw_dates",
      "block",
      `RAW vizīte ${merged.date || "datums nav"} · ${kmText(merged.odometer)} tabulā pielikta pie ${into.date || "cita datuma"} - darbiem nepareizs datums.`,
      "service_table",
    );
  }
  if (lost.length > 0) {
    const first = lost[0]!;
    const more = lost.length > 1 ? ` Vēl ${lost.length - 1}.` : "";
    return fail(
      "raw_dates",
      "warn",
      `RAW vizīte ${first.date || "datums nav"} · ${kmText(first.odometer)} tabulā nav.${more}`,
      "service_table",
    );
  }
  return ok("raw_dates", "service_table");
}

// (b) ---------------------------------------------------------------------------------------------

const LV_NUMBER_WORDS: Record<string, number> = {
  viena: 1, viens: 1, vienu: 1, vienas: 1,
  divas: 2, divi: 2,
  trīs: 3,
  četras: 4, četri: 4,
  piecas: 5, pieci: 5,
  sešas: 6, seši: 6,
  septiņas: 7, septiņi: 7,
  astoņas: 8, astoņi: 8,
  deviņas: 9, deviņi: 9,
  desmit: 10, vienpadsmit: 11, divpadsmit: 12, trīspadsmit: 13, četrpadsmit: 14, piecpadsmit: 15,
};
const NUM = `(\\d{1,3}|${Object.keys(LV_NUMBER_WORDS).join("|")})`;
const OIL_FILLER = "(?:(?:dzinēja|motora|fiksētas|fiksēta|reģistrētas|dīlera|veiktas|atzīmētas|dokumentētas|kopā)\\s+){0,3}";
/** «6 eļļas maiņas», «sešas dzinēja eļļas maiņas». Skaitlis nedrīkst būt tūkstošu grupa («30 000 km eļļas»). */
const OIL_COUNT_BEFORE_RE = new RegExp(
  `(?<!\\d[\\s.,]?)(?<![\\d\\p{L}])${NUM}\\s+${OIL_FILLER}(?:motor)?eļļas\\s+(?:un\\s+(?:eļļas\\s+)?filtra\\s+)?maiņ`,
  "giu",
);
/** «eļļas maiņa veikta 6 reizes», «eļļas maiņas: 6». */
const OIL_COUNT_AFTER_RE = new RegExp(
  `eļļas\\s+(?:un\\s+(?:eļļas\\s+)?filtra\\s+)?maiņ\\p{L}*(?:\\s+skaits)?(?:\\s*:\\s*|\\s+(?:\\p{L}+\\s+){0,3}?)${NUM}(?!\\d)(?:\\s+reiz\\p{L}*|(?=\\s*[;,)]|\\s*\\.(?!\\d)|\\s*$))`,
  "giu",
);
const KM_IN_TEXT_RE = /(\d{1,3}(?:[  ]\d{3})+|\d{4,6})\s*km/u;
const MONTHS_IN_TEXT_RE = /(\d{1,3})\s*(?:mēn|mēneš)/u;

function numberOf(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return LV_NUMBER_WORDS[t] ?? null;
}

export function extractOilChangeCountClaims(text: string): { count: number; sentence: string }[] {
  const out: { count: number; sentence: string }[] = [];
  for (const sentence of sentencesOf(text)) {
    for (const re of [OIL_COUNT_BEFORE_RE, OIL_COUNT_AFTER_RE]) {
      re.lastIndex = 0;
      for (const m of sentence.matchAll(re)) {
        const n = numberOf(m[1]!);
        if (n != null && n < 200) out.push({ count: n, sentence });
      }
    }
  }
  return out;
}

function kmOf(sentence: string, afterIndex: number): number | null {
  const m = sentence.slice(afterIndex).match(KM_IN_TEXT_RE);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function kmClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(300, Math.round(b * 0.03));
}

type NumericClaim = { what: string; stated: string; code: string; sentence: string };

function intervalClaims(text: string, code: DealerQualityGateInput["code"]): NumericClaim[] {
  const out: NumericClaim[] = [];
  for (const s of sentencesOf(text)) {
    const lower = s.toLowerCase();
    const avg = lower.search(/vidēj\p{L}*\s+(?:\p{L}+\s+){0,3}?intervāl|intervāl\p{L}*\s+(?:\p{L}+\s+){0,2}?vidēj/u);
    if (avg >= 0) {
      const km = kmOf(s, avg);
      const refs = [code.avgIntervalKm, code.ringIntervalKm].filter((x): x is number => x != null);
      if (km != null && refs.length > 0 && !refs.some((r) => kmClose(km, r))) {
        out.push({ what: "vidējais intervāls", stated: `${groupDigits(km)} km`, code: `${groupDigits(refs[0]!)} km`, sentence: s });
      }
    }
    const longest = lower.search(/garāk\p{L}*\s+(?:\p{L}+\s+){0,2}?(?:intervāl|solis|posms\s+starp\s+eļļ)/u);
    if (longest >= 0 && code.maxIntervalKm != null) {
      const km = kmOf(s, longest);
      if (km != null && !kmClose(km, code.maxIntervalKm)) {
        out.push({ what: "garākais intervāls", stated: `${groupDigits(km)} km`, code: `${groupDigits(code.maxIntervalKm)} km`, sentence: s });
      }
    }
    const shortest = lower.search(/īsāk\p{L}*\s+(?:\p{L}+\s+){0,2}?(?:intervāl|solis)/u);
    if (shortest >= 0 && code.minIntervalKm != null) {
      const km = kmOf(s, shortest);
      if (km != null && !kmClose(km, code.minIntervalKm)) {
        out.push({ what: "īsākais intervāls", stated: `${groupDigits(km)} km`, code: `${groupDigits(code.minIntervalKm)} km`, sentence: s });
      }
    }
    const gap = lower.search(/garāk\p{L}*\s+(?:\p{L}+\s+){0,1}?(?:rob|period\p{L}*\s+bez\s+ierakst)/u);
    if (gap >= 0) {
      const km = kmOf(s, gap);
      if (km != null && code.longestGapKm != null && !kmClose(km, code.longestGapKm)) {
        out.push({ what: "garākais periods bez ierakstiem", stated: `${groupDigits(km)} km`, code: `${groupDigits(code.longestGapKm)} km`, sentence: s });
      }
      const mm = s.slice(gap).match(MONTHS_IN_TEXT_RE);
      if (mm && code.longestGapMonths != null && Math.abs(Number(mm[1]) - code.longestGapMonths) > 1) {
        out.push({ what: "garākais periods bez ierakstiem", stated: `${mm[1]} mēn.`, code: `${code.longestGapMonths} mēn.`, sentence: s });
      }
    }
    const since = lower.search(/kopš\s+pēdēj\p{L}*\s+(?:\p{L}+\s+){0,2}?ierakst/u);
    if (since >= 0 && code.monthsSinceLast != null) {
      const mm = s.slice(since).match(MONTHS_IN_TEXT_RE);
      if (mm && Math.abs(Number(mm[1]) - code.monthsSinceLast) > 1) {
        out.push({ what: "kopš pēdējā ieraksta", stated: `${mm[1]} mēn.`, code: `${code.monthsSinceLast} mēn.`, sentence: s });
      }
    }
  }
  return out;
}

function checkOilFacts(input: DealerQualityGateInput): DealerGateCheck {
  const lang = input.job?.commentLang;
  if (lang && lang !== "lv") return skip("oil_facts", "Komentārs nav latviski - skaitļu pārbaude tikai LV tekstam.");
  const fields: { text: string; place: DealerGatePlace }[] = [
    { text: input.oilNotes, place: "oil_notes" },
    { text: input.comments, place: "comments" },
  ];
  for (const f of fields) {
    const wrong = extractOilChangeCountClaims(f.text).find((c) => c.count !== input.code.oilChangeCount);
    if (wrong) {
      return fail(
        "oil_facts",
        "block",
        `Tekstā ${wrong.count} eļļas maiņas, kods (PDF tabula) - ${input.code.oilChangeCount}: «${clip(wrong.sentence)}»`,
        f.place,
      );
    }
  }
  for (const f of fields) {
    const wrong = intervalClaims(f.text, input.code)[0];
    if (wrong) {
      return fail(
        "oil_facts",
        "block",
        `${wrong.what[0]!.toUpperCase()}${wrong.what.slice(1)} tekstā ${wrong.stated}, kods - ${wrong.code}: «${clip(wrong.sentence)}»`,
        f.place,
      );
    }
  }
  return ok("oil_facts", "oil_notes");
}

// (c) ---------------------------------------------------------------------------------------------

function worksLines(works: string): string[] {
  return works
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && /\p{L}{3,}/u.test(l));
}

/** EN / DA / NL dīlera vārdi, ko `oneautoWorksNeedLvTranslation` nepārtver (audits: «Nissan Customer Maintenance Plan»). */
const EXTRA_FOREIGN_WORDS_RE =
  /(?<!\p{L})(?:customer|maintenance|roadside|recovery|history|standard|scope|vehicle|replace|battery|brake|fluid|tyres?|tires?|wheels?|wiper|bulb|lamp|mirror|coolant|gearbox|clutch|exhaust|sensor|module|programming|coding|udskift\p{L}*|eftersyn|bremse\p{L}*|olie\p{L}*|skift|dæk|vervang\p{L}*|onderhoud|banden|remmen|beurt)(?!\p{L})/iu;

/** Netulkota rinda: esošais detektors vai (bez LV diakritikas) svešvalodas dīlera vārds. */
export function dealerWorksLineLooksUntranslated(line: string): boolean {
  if (oneautoWorksNeedLvTranslation(line)) return true;
  return !/[āčēģīķļņšūž]/i.test(line) && EXTRA_FOREIGN_WORDS_RE.test(line);
}

function foldWorks(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function checkTranslation(input: DealerQualityGateInput): DealerGateCheck {
  if (input.job?.skipTranslate || input.job?.commentLang === "source") {
    return skip("translation", "RAW produkts - darbi paliek oriģinālvalodā.");
  }
  const raw = normalizedRaw(input.rawEvents);
  const rawWorks = new Set(raw.map((r) => foldWorks(r.works)).filter(Boolean));
  const bad: { row: AutoRecordsServiceWorkRow; line: string }[] = [];
  let sameAsRaw = 0;
  for (const row of input.serviceWorks) {
    const lines = worksLines(row.works);
    if (lines.length > 0 && rawWorks.has(foldWorks(row.works)) && lines.some(dealerWorksLineLooksUntranslated)) sameAsRaw++;
    for (const line of lines) if (dealerWorksLineLooksUntranslated(line)) bad.push({ row, line });
  }
  if (bad.length === 0) return ok("translation", "service_table");
  const first = bad[0]!;
  const severity: DealerGateSeverity = bad.length > DEALER_GATE_UNTRANSLATED_WARN_MAX ? "block" : "warn";
  const extra = sameAsRaw > 0 ? ` ${sameAsRaw} rindās tulkojums = oriģināls.` : "";
  return fail(
    "translation",
    severity,
    `${bad.length} netulkotas rindas, piem. ${first.row.date || "datums nav"}: «${clip(first.line, 80)}».${extra}`,
    "service_table",
  );
}

// (d) ---------------------------------------------------------------------------------------------

/** Ieteikumu frāzes (dīlera produktā tikai fakti, Nils 22.11). */
export const DEALER_GATE_RECOMMENDATION_RE =
  /jāpārbauda|ieteicam\p{L}*|iesakām|iesak\p{L}*|ieteikum\p{L}*|pārdevējam\s+jā\p{L}*|jālūdz\p{L}*|jāprasa\p{L}*|lūdziet|pārbaudiet|pārbaudīt\s+apskat\p{L}*|apskatē\s+(?:jā)?pārbaud\p{L}*|vajadzētu|būtu\s+jā\p{L}*|jāpārliecinās|vērts\s+pārbaudīt|nepieciešams\s+(?:pārbaudīt|pieprasīt|lūgt)|pieprasīt\p{L}*\s+(?:dokument|rēķin|servisa\s+grāmatiņ)\p{L}*/iu;
/**
 * 27.11: vārti ķer ieteikumus visās PRO klienta valodās - LV vārtu regex + kopīgais
 * `isDealerRecommendationSentence` (LV / EN / RU / DE), ko lieto arī automātiskā tīrīšana.
 */
export const DEALER_GATE_RECOMMENDATION_TEST = {
  test: (s: string): boolean => DEALER_GATE_RECOMMENDATION_RE.test(s) || isDealerRecommendationSentence(s),
};
const EXPERT_RE = /eksper\p{L}*/iu;
/** Vecā dīlera „Komentāri” lomu virsraksti, kas atkārto PDF tabulas (pirms #1115 / #1118). */
export const DEALER_GATE_OLD_COMMENT_ROLE_RE =
  /agregātu\s+(?:un\s+aprīkojuma\s+|\/\s*aprīkojuma\s+)?identifikācij\p{L}*|servisa\s+vēstures\s+ieraksti|servisa\s+(?:un|\/)\s+remontu\s+vēsture/iu;
const LONG_DASH_RE = /[—–]/u;
const IRISS_RE = /(?<!\p{L})[iī]riss(?!\p{L})/iu;

function firstHit(text: string, re: { test(s: string): boolean }): string | null {
  for (const s of sentencesOf(text)) if (re.test(s)) return s;
  return null;
}

function checkForbidden(input: DealerQualityGateInput): DealerGateCheck {
  const fields: { text: string; place: DealerGatePlace; label: string }[] = [
    { text: input.oilNotes, place: "oil_notes", label: "Eļļas intervāli" },
    { text: input.comments, place: "comments", label: "Komentāri" },
  ];
  const rules: { re: { test(s: string): boolean }; what: string }[] = [
    { re: DEALER_GATE_RECOMMENDATION_TEST, what: "ieteikums" },
    { re: EXPERT_RE, what: "vārds «eksperts»" },
    { re: LONG_DASH_RE, what: "garā domuzīme" },
    { re: IRISS_RE, what: "«IRISS»" },
  ];
  for (const rule of rules) {
    for (const f of fields) {
      const hit = firstHit(f.text, rule.re);
      if (hit) return fail("forbidden", "block", `${f.label}: ${rule.what} - «${clip(hit)}»`, f.place);
    }
  }
  // 23.11.2026: vecā prompta struktūra „Komentāros” (identifikācija, vizīšu uzskaite) - PDF to jau drukā tabulās.
  const oldRole = firstHit(input.comments, DEALER_GATE_OLD_COMMENT_ROLE_RE);
  if (oldRole) return fail("forbidden", "block", `Komentāri: vecā struktūra (identifikācija / vizīšu uzskaite) - «${clip(oldRole)}»`, "comments");
  const tableHit = input.serviceWorks.find((r) => IRISS_RE.test(r.works) || IRISS_RE.test(r.location));
  if (tableHit) return fail("forbidden", "block", `Servisa tabulā «IRISS» (${tableHit.date || "datums nav"}).`, "service_table");
  return ok("forbidden");
}

// (e) ---------------------------------------------------------------------------------------------

const LV_MONTHS: Record<string, number> = {
  janvār: 1, februār: 2, mart: 3, aprīl: 4, maij: 5, jūnij: 6,
  jūlij: 7, august: 8, septembr: 9, oktobr: 10, novembr: 11, decembr: 12,
};
const LV_LONG_DATE_RE = /(\d{4})\.\s*gada\s+(\d{1,2})\.\s*(janvār|februār|mart|aprīl|maij|jūnij|jūlij|august|septembr|oktobr|novembr|decembr)\p{L}*/giu;
const DOT_DATE_RE = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/g;
/** LV teksts apgalvo darbību. */
const LV_ACTION_RE = /(?<!\p{L})(?:nomainīt|nomainīj|pārbaudīt|pārbaudīj|uzstādīt|uzstādīj|salabot|salaboj|remontēt|atjaunot|atjaunoj|ieregulēt)\p{L}*/iu;
/** RAW rindā ir darbība (DE / EN / NL / LV). */
const RAW_ACTION_RE =
  /ersetz|erneu|wechsel|tausch|pr[üu]f|kontroll|einbau|ausbau|eingebaut|ausgebaut|montag|montier|reparier|instand|durchgef|einstell|aktualis|reinig|replace|renew|change|check|inspect|install|fitted|repair|adjust|perform|update|clean|vervang|controle|apkop|maiņ|nomain|pārbaud|uzstād|remont|inspektion|wartung|service|maintenance|durchsicht/iu;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function datesInSentence(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(DOT_DATE_RE)) out.push(`${pad2(Number(m[1]))}.${pad2(Number(m[2]))}.${m[3]}`);
  for (const m of s.matchAll(LV_LONG_DATE_RE)) {
    const month = LV_MONTHS[m[3]!.toLowerCase()];
    if (month) out.push(`${pad2(Number(m[2]))}.${pad2(month)}.${m[1]}`);
  }
  return out;
}

/** AI apgalvo darbību datumā, kurā RAW ir tikai pozīciju saraksts (audits 2.3). */
export function findPositionOnlyActionClaims(
  text: string,
  rawEvents: readonly OneautoServiceEvent[],
): { sentence: string; date: string }[] {
  const raw = normalizedRaw(rawEvents);
  if (raw.length === 0) return [];
  const out: { sentence: string; date: string }[] = [];
  for (const s of sentencesOf(text)) {
    if (!LV_ACTION_RE.test(s)) continue;
    for (const date of datesInSentence(s)) {
      const onDate = raw.filter((r) => r.date.trim() === date);
      if (onDate.length === 0) continue;
      const lines = onDate.flatMap((r) => worksLines(r.works));
      if (lines.length > 0 && !lines.some((l) => RAW_ACTION_RE.test(l))) {
        out.push({ sentence: s, date });
        break;
      }
    }
  }
  return out;
}

function checkContradictions(input: DealerQualityGateInput): DealerGateCheck {
  const fields: { text: string; place: DealerGatePlace }[] = [
    { text: input.oilNotes, place: "oil_notes" },
    { text: input.comments, place: "comments" },
  ];
  for (const f of fields) {
    const hit = findDrivetrainContradictions(f.text, input.drivetrain)[0];
    if (hit) return fail("contradictions", "block", `${hit.message} «${clip(hit.sentence)}»`, f.place);
  }
  if (input.powertrainContradiction) {
    return fail("contradictions", "block", "Komentārs min citu dzinēju vai degvielu nekā ielasītie dati.", "comments");
  }
  for (const f of fields) {
    const hit = findPositionOnlyActionClaims(f.text, input.rawEvents)[0];
    if (hit) {
      return fail(
        "contradictions",
        "warn",
        `AI apgalvo darbību, bet RAW ${hit.date} ir tikai pozīcija bez darbības: «${clip(hit.sentence)}»`,
        f.place,
      );
    }
  }
  // BF 27.11 (S1): dīleris pret vēlāku reģistra km - arī «warn» līmenī (klienta tekstā to vēl nemin).
  const sourceIssue =
    (input.sourceIssues ?? []).find((i) => i.kind === "dealer_registry_mileage" && i.severity !== "info") ??
    (input.sourceIssues ?? []).find((i) => i.severity === "critical");
  if (sourceIssue) {
    // Ēnu režīms: tikai brīdinājums (spriedumu nemaina), lai statistikā redzētu, cik bieži tas trāpa.
    return fail("contradictions", "warn", `Avotu pretruna: ${clip(formatSourceIssueLine(sourceIssue))}`, "service_table");
  }
  return ok("contradictions");
}

// (f) ---------------------------------------------------------------------------------------------

function vinSlug(v: string): string {
  return (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** VIN no dīlera PDF faila nosaukuma («OFICIALA_DILERA_DATI_<VIN>[_EN].pdf»). */
export function vinFromDealerPdfFilename(filename: string): string {
  const m = (filename ?? "").toUpperCase().match(/(?:^|[^A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?=[^A-Z0-9]|$)/);
  return m ? m[1]! : "";
}

function checkPdf(input: DealerQualityGateInput): DealerGateCheck {
  const jobVin = vinSlug(input.jobVin);
  const draftVin = vinSlug(input.draftVin);
  if (draftVin && jobVin && draftVin !== jobVin) {
    return fail("pdf", "block", `Melnraksta VIN ${draftVin} nesakrīt ar ielases VIN ${jobVin}.`, "pdf");
  }
  if (!input.pdf) {
    return fail("pdf", "warn", "PDF vēl nav - pārbaude atkārtosies, kad atvērsi sūtīšanas formu vai izveidosi PDF.", "pdf");
  }
  const pdfVin = vinFromDealerPdfFilename(input.pdf.filename);
  if (!pdfVin) return fail("pdf", "block", `PDF nosaukumā nav VIN («${clip(input.pdf.filename, 60)}»).`, "pdf");
  if (jobVin && pdfVin !== jobVin) {
    return fail("pdf", "block", `PDF VIN ${pdfVin} nesakrīt ar ielases VIN ${jobVin}.`, "pdf");
  }
  return ok("pdf", "pdf");
}

// (g) ---------------------------------------------------------------------------------------------

function checkAiFields(input: DealerQualityGateInput): DealerGateCheck {
  const oil = input.oilNotes.trim();
  const comments = input.comments.trim();
  if (!oil) return fail("ai_fields", "block", "«Eļļas maiņas intervāli» ir tukšs.", "oil_notes");
  if (!comments) return fail("ai_fields", "block", "«Komentāri» ir tukšs.", "comments");
  if (oil.length < DEALER_GATE_MIN_OIL_CHARS) {
    return fail("ai_fields", "block", `«Eļļas maiņas intervāli» par īsu (${oil.length} zīmes).`, "oil_notes");
  }
  if (comments.length < DEALER_GATE_MIN_COMMENTS_CHARS) {
    return fail("ai_fields", "block", `«Komentāri» par īsu (${comments.length} zīmes).`, "comments");
  }
  return ok("ai_fields");
}

// -------------------------------------------------------------------------------------------------

const ORDER: DealerGateCheckId[] = [
  "job_status",
  "raw_dates",
  "oil_facts",
  "translation",
  "forbidden",
  "contradictions",
  "pdf",
  "ai_fields",
];

export function evaluateDealerQualityGate(
  input: DealerQualityGateInput,
  opts: { nowIso?: string; trigger?: DealerShadowGate["trigger"] } = {},
): DealerShadowGate {
  const status = checkJobStatus(input);
  // Bez gatavas ielases pārējās pārbaudes nav jēgpilnas (tikai troksnis statistikā).
  const checks: DealerGateCheck[] =
    status.state !== "ok"
      ? ORDER.map((id) => (id === "job_status" ? status : skip(id)))
      : [
          status,
          checkRawDates(input),
          checkOilFacts(input),
          checkTranslation(input),
          checkForbidden(input),
          checkContradictions(input),
          checkPdf(input),
          checkAiFields(input),
        ];
  return {
    verdict: dealerGateVerdictFromChecks(checks),
    checks,
    at: opts.nowIso ?? new Date().toISOString(),
    version: DEALER_SHADOW_GATE_VERSION,
    ...(opts.trigger ? { trigger: opts.trigger } : {}),
    ...(input.pdf ? { pdf: input.pdf } : {}),
  };
}

/** Ievade no darba ieraksta + melnraksta avotu blokiem (tie paši aprēķini, ko PDF un AI prompts). */
export function buildDealerQualityGateInput(args: {
  job: DealerQualityGateInput["job"] & { vin: string };
  sourceBlocks: WorkspaceSourceBlocks | null | undefined;
  pdf: DealerShadowGatePdf | null;
  nowMs?: number;
}): DealerQualityGateInput {
  const nowMs = args.nowMs ?? Date.now();
  const blocks = mergeSourceBlocksWithDefaults(args.sourceBlocks ?? ({} as WorkspaceSourceBlocks));
  const ar = blocks.auto_records;
  const rows = printableDealerServiceWorks(ar.serviceWorks ?? []);
  const rawEvents = ar.oneautoIngest?.serviceTimelineOriginal ?? [];
  const series = buildOilIntervalSeriesForBlock(ar, { nowMs });
  const facts = rows.length > 0 ? extractDealerFactsFromServiceWorks(rows, rawEvents) : null;
  const summary = rows.length > 0 ? buildDealerVisitSummary(rows, facts, null, nowMs) : null;
  const comments = adminRichHtmlToPlainText(ar.comments ?? "");
  const oilNotes = adminRichHtmlToPlainText(ar.oilChangeIntervalNotes ?? "");
  const identity = extractLoadedPowertrainIdentity(blocks, { vin: args.job.vin });
  return {
    jobVin: args.job.vin,
    job: args.job,
    serviceWorks: rows,
    rawEvents,
    oilNotes,
    comments,
    code: {
      oilChangeCount: series.changeCount,
      avgIntervalKm: series.avgIntervalKm,
      ringIntervalKm: series.ringIntervalKm,
      maxIntervalKm: series.maxIntervalKm,
      minIntervalKm: series.minIntervalKm,
      longestGapKm: summary?.longestGap?.km ?? null,
      longestGapMonths: summary?.longestGap?.months ?? null,
      monthsSinceLast: summary?.monthsSinceLast ?? null,
    },
    drivetrain: extractVehicleDrivetrain(blocks),
    powertrainContradiction: Boolean(comments) && commentContradictsPowertrain(comments, identity),
    draftVin: ar.outvinReport?.vehicleInfo?.vinCode ?? "",
    sourceIssues: checkSourceConsistency({ vin: args.job.vin, sourceBlocks: blocks, nowMs }).filter(
      (i) => i.kind !== "ai_powertrain" && i.kind !== "ai_drivetrain",
    ),
    pdf: args.pdf,
  };
}
