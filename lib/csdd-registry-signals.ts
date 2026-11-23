/**
 * e.csdd teksta sadaļas, kas nav atsevišķi formas lauki: aizliegumi, CSNg, OCTA, reģistrācijas statusa
 * nozīme, nodokļa samaksa, tirdzniecības reģistrs, pilnvara, kā arī deterministiska TA defektu analīze.
 *
 * Lieto tikai AI faktu lapā (AUDITS/PRO komentāri) un OCTA lauka aizpildei. PDF izkārtojumu nemaina.
 * Parsē no saglabātā RAW katrā reizē - veci melnraksti strādā bez datu pārrakstīšanas.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  effectiveInspectionSeverity,
  normalizeCsddRawText,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";

const DAY_MS = 86_400_000;
const LV_DATE_RE = /(\d{2})[./](\d{2})[./](\d{4})/;

function lvDate(raw: string): string {
  const m = raw.match(LV_DATE_RE);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : "";
}

function lvDateToUtcMs(lv: string): number | null {
  const m = lv.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const ms = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isFinite(ms) ? ms : null;
}

function isoToLv(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

function utcDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function oneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** „Nav” / „Nav datu” / tukšs - sadaļa ir, ierakstu nav. */
function isNavValue(s: string): boolean {
  return /^nav\.?$/i.test(s.trim());
}

/* -------------------------------------------------------------------------- */
/* OCTA                                                                       */
/* -------------------------------------------------------------------------- */

export type CsddOctaFromRaw = {
  /** `unknown` - tekstā sadaļas nav; `none` - „Civiltiesiskā apdrošināšana: Nav”. */
  state: "unknown" | "none" | "policy";
  /** DD.MM.YYYY vai tukšs. */
  validFrom: string;
  validUntil: string;
};

const OCTA_SECTION_RE =
  /Civiltiesisk[āa]\s+apdrošināšana\s*:?[ \t]*\n?([\s\S]{0,400}?)(?=\n\s*(?:Pēdēj[āa]\s+tehnisk|Nobraukuma\s+vēsture|Tehnisko\s+apska|Transportlīdzekļa\s|Informācija\s+sagatavota|Aizliegumi|Reģistrācijas\s+dati|Tehniskie\s+dati)|$)/i;

/** OCTA no e.csdd teksta: polises termiņš vai „Nav”. Polises numuru neatgriež. */
export function parseCsddOctaFromRaw(raw: string): CsddOctaFromRaw {
  const text = normalizeCsddRawText(raw);
  const sec = text.match(OCTA_SECTION_RE)?.[1];
  if (sec == null) return { state: "unknown", validFrom: "", validUntil: "" };
  const end = sec.match(/Beigu\s+datums\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i)?.[1] ?? "";
  const start = sec.match(/Spēkā\s+stāšanās\s+datums\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i)?.[1] ?? "";
  if (end) return { state: "policy", validFrom: lvDate(start), validUntil: lvDate(end) };
  const firstLine = sec.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  if (isNavValue(firstLine)) return { state: "none", validFrom: "", validUntil: "" };
  return { state: "unknown", validFrom: "", validUntil: "" };
}

/** Vērtība formas laukam „OCTA polise derīga līdz”: ISO datums, „Nav” vai tukšs (nav zināms). */
export function csddOctaFieldValueFromRaw(raw: string): string {
  const o = parseCsddOctaFromRaw(raw);
  if (o.state === "none") return "Nav";
  if (o.state === "policy") {
    const m = o.validUntil.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  }
  return "";
}

/* -------------------------------------------------------------------------- */
/* Aizliegumi, CSNg, statuss, nodoklis, tirdzniecības reģistrs, pilnvara       */
/* -------------------------------------------------------------------------- */

export type CsddSectionState = "not_checked" | "none" | "present";

export type CsddRegistrySignals = {
  /** „Informācija sagatavota elektroniski DD.MM.YYYY” - e.csdd teksta datums; tukšs, ja nav. */
  infoDate: string;
  restrictions: { state: CsddSectionState; text: string };
  csngPolice: { state: CsddSectionState; text: string };
  csngInsurers: { state: CsddSectionState; text: string };
  status: {
    text: string;
    notRegistered: boolean;
    removedFromRegister: boolean;
    /** „atļauts piedalīties ceļu satiksmē līdz” DD.MM.YYYY; tukšs, ja nav norādīts. */
    allowedUntil: string;
    /** `null`, ja termiņš nav zināms. */
    permitExpired: boolean | null;
  };
  octa: CsddOctaFromRaw & {
    /** Polises garums dienās (sākums - beigas); `null`, ja nav abu datumu. */
    termDays: number | null;
    /** Dienas līdz beigām no atskaites dienas (negatīvs = beigusies); `null`, ja beigu datuma nav. */
    daysLeft: number | null;
  };
  roadTax: { state: "unknown" | "paid" | "unpaid"; paidText: string };
  tradeRegisterListed: boolean;
  /** Pilnvaras veids un datums bez personas datiem; tukšs, ja nav. */
  powerOfAttorney: string;
  /** Pēdējā TA ir „Atļauja ... ārvalstī izsniegtā atļauja” - Latvijā TA nav veikta. */
  foreignInspectionPermit: boolean;
};

/**
 * Zināmie e.csdd sadaļu virsraksti (PDF teksts un releja tadati akordeoni). Sadaļas vērtība beidzas pie nākamā
 * virsraksta - tukša/sakļauta sadaļa nedrīkst „paņemt” nākamās sadaļas tekstu (piem. CSNg -> Nobraukuma vēsture LV).
 */
const SECTION_STOP =
  "Aizliegumi|Būtiski\\s+bojājumi|Informācija\\s+no\\s+(?:policijas|apdrošinātājiem)|Reģistrācijas\\s+dati|Reģistrācijas\\s+numurs|Tehniskie\\s+dati|Transportlīdzekļa\\s|Civiltiesisk|Pilnvara|Informācija\\s+sagatavota" +
  "|Nobraukuma\\s+vēsture|Nobraukums\\s+ārvalstīs|Bremžu\\s+vērtējums|Detalizētais\\s+vērtējums|Pēdēj[āa]\\s+tehnisk|Tehnisko\\s+apska|Uzņēmuma\\s+vieglo|Iepriekšējās\\s+reģistrācijas|Datums\\s*:?\\s+Odometrs|Powered\\s+by";

const SECTION_HEADING_RE = new RegExp(`^(?:${SECTION_STOP})`, "i");

/** Rinda ir cita e.csdd sadaļas virsraksts, nevis vērtība. */
export function isCsddSectionHeadingLine(line: string): boolean {
  return SECTION_HEADING_RE.test(line.trim());
}

function sectionAfterLine(text: string, headRe: string): string | null {
  const re = new RegExp(`(?:^|\\n)[ \\t]*${headRe}[ \\t]*:?[ \\t]*([^\\n]*)([\\s\\S]{0,2000}?)(?=\\n[ \\t]*(?:${SECTION_STOP})|$)`, "i");
  const m = text.match(re);
  if (!m) return null;
  return [m[1] ?? "", m[2] ?? ""].join("\n").trim();
}

function sectionState(body: string | null): { state: CsddSectionState; text: string } {
  if (body == null) return { state: "not_checked", text: "" };
  const all = body.split("\n").map((l) => l.trim()).filter(Boolean);
  // Drošībai: vērtība nekad neturpinās pāri citas sadaļas virsrakstam.
  const stop = all.findIndex(isCsddSectionHeadingLine);
  const lines = stop >= 0 ? all.slice(0, stop) : all;
  if (lines.length === 0) return { state: "not_checked", text: "" };
  if (lines.every(isNavValue)) return { state: "none", text: "" };
  return { state: "present", text: oneLine(lines.filter((l) => !isNavValue(l)).join("; "), 300) };
}

export function isCsddForeignInspectionPermit(inspectionType: string): boolean {
  return /ārvalst[īi]\s+izsniegt/i.test(inspectionType) || /atļauja\s+piedalīties[\s\S]*bez\s+kontroles/i.test(inspectionType);
}

/** PDF / admin: teksts ārvalstu TA atļaujai „Novērtējums **” vietā. */
export const CSDD_FOREIGN_PERMIT_NO_LV_INSPECTION_TEXT = "Latvijā TA vēl nav veikta";

/** „**” (bez vērtējuma) vai ārvalstu atļaujas pārbaudes veids. */
export function csddInspectionHasNoLatvianRating(row: { ratingLabel?: string; inspectionType?: string }): boolean {
  const label = String(row.ratingLabel ?? "").trim();
  if (/^\*+$/.test(label)) return true;
  return !/^\d/.test(label) && isCsddForeignInspectionPermit(String(row.inspectionType ?? ""));
}

export function isCsddNotRegisteredStatus(status: string): boolean {
  return /\bnav\s+reģistrēts\b/i.test(status);
}

export function parseCsddRegistrySignals(
  csdd: Pick<
    CsddFormFields,
    "rawUnprocessedData" | "registrationStatus" | "insuranceValidUntil" | "prevInspectionBlock" | "technicalInspectionHistory"
  >,
  nowMs: number = Date.now(),
): CsddRegistrySignals {
  const text = normalizeCsddRawText(csdd.rawUnprocessedData ?? "");
  const today = utcDayStart(nowMs);

  const infoDate = lvDate(text.match(/Informācija\s+sagatavota(?:\s+elektroniski)?\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i)?.[1] ?? "");

  const restrictions = sectionState(sectionAfterLine(text, "Aizliegumi"));
  const csngPolice = sectionState(sectionAfterLine(text, "Informācija\\s+no\\s+policijas"));
  const csngInsurers = sectionState(sectionAfterLine(text, "Informācija\\s+no\\s+apdrošinātājiem"));

  const statusRaw =
    text.match(/Reģistrācijas\s+statuss\s*[:\t ]\s*([^\n]+)/i)?.[1] ??
    text.match(/(?:^|\n)[ \t]*Statuss[ \t]+([^\n]+)/i)?.[1] ??
    "";
  const statusText = oneLine(String(csdd.registrationStatus ?? "").trim() || statusRaw, 160);
  const statusHay = `${statusText}\n${statusRaw}`;
  const removedFromRegister = /noņemts\s+no\s+uzskaites/i.test(statusHay);
  const allowedUntil = lvDate(statusHay.match(/līdz\s+(\d{2}[./]\d{2}[./]\d{4})/i)?.[1] ?? "");
  const allowedMs = allowedUntil ? lvDateToUtcMs(allowedUntil) : null;

  const octaRaw = parseCsddOctaFromRaw(text);
  // API (POL_BEIGAS) vai operatora labots lauks ir svaigāks par ielīmēto tekstu.
  const fieldLv = isoToLv(String(csdd.insuranceValidUntil ?? ""));
  const octa: CsddOctaFromRaw =
    fieldLv && fieldLv !== octaRaw.validUntil
      ? { state: "policy", validFrom: "", validUntil: fieldLv }
      : octaRaw;
  const fromMs = octa.validFrom ? lvDateToUtcMs(octa.validFrom) : null;
  const untilMs = octa.validUntil ? lvDateToUtcMs(octa.validUntil) : null;

  let roadTax: CsddRegistrySignals["roadTax"] = { state: "unknown", paidText: "" };
  if (/Maksājums\s+par\s+tekošo\s+gadu\s+nav\s+veikts/i.test(text)) {
    roadTax = { state: "unpaid", paidText: "" };
  } else {
    const paid = text.match(/Par\s+tekošo\s+gadu\s+samaksāti\s+([\d.,]+)\s*(?:Euro|EUR|€)/i)?.[1];
    if (paid) roadTax = { state: "paid", paidText: `${paid} EUR` };
  }

  const tradeRegisterListed = /Tirdzniecības\s+reģistra\s+statuss\s*:?\s*Ir\s+ievietots/i.test(text);

  let powerOfAttorney = "";
  const poa = text.match(/(?:^|\n)[ \t]*Pilnvara(?![a-zāčēģīķļņšūž])[ \t]*:?[ \t]*([^\n]+)/)?.[1]?.trim() ?? "";
  if (poa && !isNavValue(poa)) {
    const date = lvDate(poa);
    const kind = /atsavin\s?[āa]t/i.test(poa) ? "atsavināt transportlīdzekli citai personai" : "veids nav atpazīts";
    powerOfAttorney = `${kind}${date ? ` (${date})` : ""}`;
  }

  const prevType = String(csdd.prevInspectionBlock?.inspectionType ?? "");
  const headType = text.match(/Pārbaudes\s+veids\s*[:\t ]\s*([^\n]+)/i)?.[1] ?? "";
  const hasRatedInspection = (csdd.technicalInspectionHistory ?? []).some(
    (r) => r.date.trim() && /^\d/.test(r.ratingLabel.trim()),
  );
  const foreignInspectionPermit =
    (isCsddForeignInspectionPermit(prevType) || isCsddForeignInspectionPermit(headType)) && !hasRatedInspection;

  return {
    infoDate,
    restrictions,
    csngPolice,
    csngInsurers,
    status: {
      text: statusText,
      notRegistered: isCsddNotRegisteredStatus(statusHay),
      removedFromRegister,
      allowedUntil,
      permitExpired: allowedMs == null ? null : allowedMs < today,
    },
    octa: {
      ...octa,
      termDays: fromMs != null && untilMs != null ? Math.round((untilMs - fromMs) / DAY_MS) + 1 : null,
      daysLeft: untilMs != null ? Math.round((untilMs - today) / DAY_MS) : null,
    },
    roadTax,
    tradeRegisterListed,
    powerOfAttorney,
    foreignInspectionPermit,
  };
}

/* -------------------------------------------------------------------------- */
/* TA defektu analīze                                                          */
/* -------------------------------------------------------------------------- */

export type CsddRepeatedDefect = {
  /** Mezgls - koda pirmie divi līmeņi („5.3”, „8.4”); vecajiem trīsciparu kodiem viss kods. */
  node: string;
  years: number[];
  /** Jaunākā ieraksta apraksts (īss). */
  sample: string;
};

export type CsddInspectionDefectAnalysis = {
  inspectionCount: number;
  /** Apskates ar vērtējumu 2 vai 3 (sliktākais no kopējā vērtējuma un defektiem). */
  failedCount: number;
  rating3Count: number;
  repeated: CsddRepeatedDefect[];
};

export const CSDD_REPEATED_DEFECT_MIN_YEARS = 3;

function defectNode(code: string): string {
  const parts = code.trim().replace(/\.+$/, "").split(".").filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) return `${parts[0]}.${parts[1]}`;
  return /^\d{3}$/.test(code.trim()) ? code.trim() : "";
}

function inspectionYear(date: string): number | null {
  const m = date.match(/(\d{4})\s*$/) ?? date.match(/^(\d{4})-/);
  return m ? Number(m[1]) : null;
}

/** Atkārtoti defekti (tas pats mezgls vismaz 3 dažādos gados) un apskašu ar vērtējumu 2/3 skaits. */
export function analyzeCsddInspectionDefects(rows: readonly CsddTechnicalInspectionRow[]): CsddInspectionDefectAnalysis {
  const seen = new Set<string>();
  const data = (rows ?? []).filter((r) => {
    const d = r.date.trim();
    // Tā pati apskate var būt tekstā divreiz (vecais + jaunais e.csdd formāts).
    const key = `${d}|${r.inspectionType.trim().toLowerCase()}`;
    if (!d || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let failedCount = 0;
  let rating3Count = 0;
  const byNode = new Map<string, { years: Set<number>; sample: string; sampleYear: number }>();
  for (const row of data) {
    const sev = effectiveInspectionSeverity(row);
    if (sev != null && sev >= 2) failedCount += 1;
    if (sev === 3) rating3Count += 1;
    const year = inspectionYear(row.date);
    if (year == null) continue;
    for (const d of row.defects ?? []) {
      const node = defectNode(d.code);
      if (!node) continue;
      const entry = byNode.get(node) ?? { years: new Set<number>(), sample: "", sampleYear: 0 };
      entry.years.add(year);
      if (year >= entry.sampleYear && d.description.trim()) {
        entry.sample = oneLine(d.description, 90);
        entry.sampleYear = year;
      }
      byNode.set(node, entry);
    }
  }
  const repeated = [...byNode.entries()]
    .filter(([, v]) => v.years.size >= CSDD_REPEATED_DEFECT_MIN_YEARS)
    .map(([node, v]) => ({ node, years: [...v.years].sort((a, b) => a - b), sample: v.sample }))
    .sort((a, b) => b.years.length - a.years.length || a.node.localeCompare(b.node));
  return { inspectionCount: data.length, failedCount, rating3Count, repeated };
}

/* -------------------------------------------------------------------------- */
/* AI faktu rindas                                                             */
/* -------------------------------------------------------------------------- */

export const CSDD_SIGNALS_FACTS_TITLE = "CSDD reģistra signāli (deterministiski no e.csdd teksta; NEIZDOMĀ pretējo):";
export const CSDD_RESTRICTIONS_NOT_CHECKED_LINE =
  "- Liegumi / aizliegumi: NAV PĀRBAUDĪTS (e.csdd tekstā sadaļas „Aizliegumi” nav). AIZLIEGTS rakstīt, ka liegumu, aizliegumu, apgrūtinājumu vai ķīlu nav.";

function yearsLabel(years: number[]): string {
  const consecutive = years.every((y, i) => i === 0 || y === years[i - 1]! + 1);
  return consecutive && years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : years.join(", ");
}

/**
 * Fakti AI faktu lapai (AUDITS/PRO). Tukšs masīvs, ja CSDD blokā nav ne teksta, ne lauku.
 * Dīlera datu komentāriem šo nedod (sk. `omitCsddRegistrySignals`).
 */
export function buildCsddRegistrySignalFactLines(csdd: CsddFormFields | null | undefined, nowMs: number = Date.now()): string[] {
  if (!csdd) return [];
  const hasRaw = Boolean((csdd.rawUnprocessedData ?? "").trim());
  const hasFields = Boolean(
    csdd.makeModel.trim() || csdd.registrationNumber.trim() || csdd.registrationStatus.trim() || csdd.registry,
  );
  if (!hasRaw && !hasFields) return [];

  const s = parseCsddRegistrySignals(csdd, nowMs);
  const asOf = s.infoDate ? ` (e.csdd dati uz ${s.infoDate})` : "";
  const lines: string[] = [];

  if (s.restrictions.state === "not_checked") {
    lines.push(CSDD_RESTRICTIONS_NOT_CHECKED_LINE);
  } else if (s.restrictions.state === "none") {
    lines.push(`- e.csdd: aizliegumu nav${s.infoDate ? ` (${s.infoDate})` : ""} - drīkst rakstīt tikai šādi, ar avotu un datumu.`);
  } else {
    lines.push(`- e.csdd AIZLIEGUMI IR${asOf}: ${s.restrictions.text} - obligāti jāmin kā fakts.`);
  }
  for (const [label, sec] of [
    ["policijas", s.csngPolice],
    ["apdrošinātājiem", s.csngInsurers],
  ] as const) {
    if (sec.state === "none") lines.push(`- e.csdd būtiski bojājumi (CSNg), informācija no ${label}: nav${asOf}.`);
    else if (sec.state === "present") {
      lines.push(`- e.csdd būtiski bojājumi (CSNg), informācija no ${label}${asOf}: ${sec.text} - jāmin kā fakts.`);
    }
  }

  if (s.status.notRegistered) {
    lines.push("- Reģistrācijas statuss: nav reģistrēts Latvijā (pirms lietošanas jāreģistrē; reģistrācijas ilgumu Latvijā nerakstīt).");
  } else if (s.status.removedFromRegister) {
    if (s.status.allowedUntil) {
      lines.push(
        s.status.permitExpired
          ? `- Reģistrācijas statuss: noņemts no uzskaites; atļauja piedalīties ceļu satiksmē BEIGUSIES ${s.status.allowedUntil}${asOf} - ja statuss nav mainīts, ar auto braukt nedrīkst un pircējam tas jāreģistrē no jauna.`
          : `- Reģistrācijas statuss: noņemts no uzskaites; atļauts piedalīties ceļu satiksmē tikai līdz ${s.status.allowedUntil}.`,
      );
    } else {
      lines.push("- Reģistrācijas statuss: noņemts no uzskaites (termiņš tekstā nav norādīts).");
    }
  }

  if (s.octa.state === "none") {
    lines.push(`- OCTA: nav spēkā esošas polises${asOf}.`);
  } else if (s.octa.state === "policy" && s.octa.daysLeft != null) {
    if (s.octa.daysLeft < 0) {
      lines.push(`- OCTA: polise beigusies ${s.octa.validUntil}${asOf}.`);
    } else if (s.octa.termDays != null && s.octa.termDays <= 31) {
      lines.push(
        `- OCTA: īstermiņa polise ${s.octa.validFrom}-${s.octa.validUntil} (${s.octa.termDays} dienas) - tipiski auto, ko gatavo pārdošanai.`,
      );
    } else if (s.octa.daysLeft < 30) {
      lines.push(`- OCTA: polise beidzas ${s.octa.validUntil} (atlikušas ${s.octa.daysLeft} dienas).`);
    }
  }

  if (s.roadTax.state === "unpaid") {
    lines.push(`- Ekspluatācijas nodoklis: par tekošo gadu NAV samaksāts${asOf}.`);
  }
  if (s.tradeRegisterListed) {
    lines.push("- CSDD Tirdzniecības reģistrs: auto IR ievietots (auto ir tirgotāja uzskaitē - pārdevējs, visticamāk, ir uzņēmums, nevis privātpersona).");
  }
  if (s.powerOfAttorney) {
    lines.push(`- Pilnvara reģistrā: ${s.powerOfAttorney} - auto var pārdot pilnvarnieks, ne īpašnieks.`);
  }
  if (s.foreignInspectionPermit) {
    lines.push(
      "- Tehniskā apskate: Latvijā TA vēl nav veikta (pieņemta ārvalstī izsniegta atļauja) - Latvijas TA defektu dati par šo auto nav zināmi; neraksti, ka TA ir bez defektiem.",
    );
  }

  const ta = analyzeCsddInspectionDefects(csdd.technicalInspectionHistory ?? []);
  if (ta.inspectionCount > 0 && ta.failedCount > 0) {
    lines.push(
      `- TA ar vērtējumu 2 vai 3: ${ta.failedCount} no ${ta.inspectionCount} apskatēm${ta.rating3Count > 0 ? ` (no tām ar vērtējumu 3: ${ta.rating3Count})` : ""}.`,
    );
  }
  for (const r of ta.repeated.slice(0, 5)) {
    lines.push(
      `- Atkārtots TA defekts, mezgls ${r.node} (${r.years.length} gados: ${yearsLabel(r.years)})${r.sample ? `: ${r.sample}` : ""}`,
    );
  }

  return lines;
}

/** Bloks ar virsrakstu; tukšs, ja nav faktu. */
export function buildCsddRegistrySignalsBrief(csdd: CsddFormFields | null | undefined, nowMs?: number): string {
  const lines = buildCsddRegistrySignalFactLines(csdd, nowMs);
  return lines.length > 0 ? [CSDD_SIGNALS_FACTS_TITLE, ...lines].join("\n") : "";
}
