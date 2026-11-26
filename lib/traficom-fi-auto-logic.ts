import {
  sortVinRegistryMileage,
  sortVinRegistryTimeline,
  type VinRegistryBlockState,
  type VinRegistryMileageRow,
  type VinRegistryTimelineRow,
} from "@/lib/admin-source-blocks";
import { ADMIN_RAW_UNPROCESSED_MAX_LEN } from "@/lib/admin-raw-field-limits";
import { applyTraficomReportToBlock } from "@/lib/traficom-report-parse";
import type {
  TraficomFiAutoStatus,
  TraficomFiData,
  TraficomFiFlag,
  TraficomFiRelaySession,
  TraficomFiSection,
} from "@/lib/traficom-fi-auto-types";
import { detectFinlandLink, type FinlandLinkRow } from "@/lib/vin-scan/finland-link";

/**
 * Traficom (FI) automātikas tīrā loģika (bez tīkla): releja notikumi -> stāvoklis, kad palaist automātiski,
 * rezultāts -> `traficom_fi` bloks (tas pats parseris kā PDF / ielīmējums + apskate, nobraukums, karogi).
 */

const FI = "Somija";

export type TraficomFiRelayEvent = {
  jobId: string;
  ref: string;
  vin: string;
  state: "queued" | "awaiting_eparaksts" | "searching" | "result" | "error";
  verificationCode?: string;
  found?: boolean;
  rawText?: string;
  data?: TraficomFiData;
  pdfBase64?: string;
  cached?: boolean;
  code?: string;
  message?: string;
  at?: string;
};

export type TraficomFiRelayConfig = { baseUrl: string; token: string; autoEnabled: boolean };

export function readTraficomFiRelayConfig(env: Record<string, string | undefined> = process.env): TraficomFiRelayConfig | null {
  const baseUrl = (env.TRAFICOM_RELAY_URL ?? "").trim().replace(/\/+$/, "");
  const token = (env.TRAFICOM_RELAY_TOKEN ?? "").trim();
  if (!baseUrl.startsWith("https://") || token.length < 16) return null;
  return { baseUrl, token, autoEnabled: /^(1|true|yes)$/i.test((env.TRAFICOM_AUTO_ENABLED ?? "").trim()) };
}

/** Pasūtījuma atsauce (nevis VIN SCAN `vs_…` vai ātrais vērtējums `qe_…`). */
export function isTraficomOrderRef(ref: string): boolean {
  return !/^(qe|vs)_/.test(ref);
}

const RELAY_ERROR_LV: Record<string, string> = {
  eparaksts_timeout: "eParaksts netika apstiprināts 5 min laikā - spied «Pieprasīt vēlreiz»",
  eparaksts_refused: "eParaksts pieprasījums atteikts vai atcelts",
  captcha: "Traficom vai Suomi.fi prasa captcha - jāpārbauda manuāli",
  page_changed: "Traficom lapa mainījusies - ielīmē datus ar roku",
  unavailable: "Traficom vai Suomi.fi nav pieejams",
  paid: "Traficom prasīja maksu - relejs apstājās (neko neapmaksā)",
  not_configured: "Relejam nav eParaksts lietotāja numura (serverī)",
  invalid_vin: "VIN nav derīgs Traficom meklēšanai",
  queue_full: "Traficom rinda pilna - mēģini vēlāk",
};

export function traficomFiRelayErrorLv(code: string | undefined, fallback?: string): string {
  return (code && RELAY_ERROR_LV[code]) || fallback?.slice(0, 200) || "Traficom pieprasījums neizdevās";
}

/** Atbildes, kas nav galīgs rezultāts: atjauno tikai stāvokli. */
export function reduceTraficomFiProgress(prev: TraficomFiAutoStatus | null, ev: TraficomFiRelayEvent, now: string): TraficomFiAutoStatus {
  const base: TraficomFiAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    vin: ev.vin || prev?.vin,
    jobId: ev.jobId || prev?.jobId,
    updatedAt: now,
  };
  delete base.verificationCode;
  delete base.errorCode;
  if (ev.state === "awaiting_eparaksts") {
    const code = /^[0-9A-Za-z]{2,8}$/.test(ev.verificationCode ?? "") ? ev.verificationCode : undefined;
    return { ...base, state: "awaiting_eparaksts", ...(code ? { verificationCode: code } : {}), message: "Gaida eParaksts apstiprinājumu telefonā" };
  }
  if (ev.state === "searching") return { ...base, state: "searching", message: "Meklē Traficom pēc VIN" };
  if (ev.state === "error") {
    return { ...base, state: "error", ...(ev.code ? { errorCode: ev.code.slice(0, 40) } : {}), message: traficomFiRelayErrorLv(ev.code, ev.message) };
  }
  return { ...base, state: "queued", message: "Gaida rindā" };
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function rows(v: unknown, max = 200): [string, string][] {
  if (!Array.isArray(v)) return [];
  const out: [string, string][] = [];
  for (const r of v) {
    if (!Array.isArray(r)) continue;
    const l = str(r[0], 160);
    const val = str(r[1], 600);
    if (l && val) out.push([l, val]);
    if (out.length >= max) break;
  }
  return out;
}

/** Releja `data` (neuzticams JSON) -> tipizēti dati ar robežām. */
export function sanitizeTraficomFiData(raw: unknown): TraficomFiData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const flags: TraficomFiFlag[] = (Array.isArray(o.flags) ? o.flags : [])
    .map((f) => {
      const x = (f ?? {}) as Record<string, unknown>;
      const text = str(x.text, 300);
      return text ? ({ level: x.level === "red" ? "red" : "yellow", text } as TraficomFiFlag) : null;
    })
    .filter((f): f is TraficomFiFlag => Boolean(f))
    .slice(0, 40);
  const sections: TraficomFiSection[] = (Array.isArray(o.sections) ? o.sections : [])
    .map((s) => {
      const x = (s ?? {}) as Record<string, unknown>;
      const title = str(x.title, 160);
      const r = rows(x.rows);
      return title && r.length ? { title, rows: r } : null;
    })
    .filter((s): s is TraficomFiSection => Boolean(s))
    .slice(0, 30);
  const data: TraficomFiData = {
    vehicleTitle: str(o.vehicleTitle, 200),
    banners: (Array.isArray(o.banners) ? o.banners : []).map((b) => str(b, 300)).filter(Boolean).slice(0, 10),
    summary: rows(o.summary, 60),
    flags,
    source: str(o.source, 120),
    sections,
  };
  return data.summary.length || data.sections.length || data.flags.length || data.vehicleTitle ? data : undefined;
}

/** Gala rezultāts no releja. */
export function reduceTraficomFiResult(prev: TraficomFiAutoStatus | null, ev: TraficomFiRelayEvent, now: string): TraficomFiAutoStatus {
  const base: TraficomFiAutoStatus = {
    ...(prev ?? { state: "queued", updatedAt: now }),
    vin: ev.vin || prev?.vin,
    jobId: ev.jobId || prev?.jobId,
    updatedAt: now,
    checkedAt: ev.at || now,
  };
  for (const k of ["verificationCode", "appliedAt", "appliedBy", "restoredAt", "rawText", "data", "errorCode", "cached", "pdf"] as const) delete base[k];
  const raw = (ev.rawText ?? "").trim();
  const data = sanitizeTraficomFiData(ev.data);
  if (ev.found && (raw || data)) {
    return {
      ...base,
      state: "found",
      ...(raw ? { rawText: raw.slice(0, 60_000) } : {}),
      ...(data ? { data } : {}),
      ...(ev.cached ? { cached: true } : {}),
      message: ev.cached ? "Traficom dati (kešs, ≤7 d)" : "Traficom dati ielasīti",
    };
  }
  if (ev.found) return { ...base, state: "error", message: "Traficom atdeva tukšu lapu - ielīmē datus ar roku" };
  return { ...base, state: "not_found", message: "Traficom šo VIN neatrada" };
}

/**
 * Vai automātika (pēc apmaksas / VIN SCAN) drīkst palaist Traficom: tikai, ja ir pazīmes, ka auto bijis Somijā
 * (FI numurs, FI izsole / sludinājums, citos avotos FI valsts, CARFAX FI, car.info FI eksports). Tā mazāk lieku
 * eParaksts pieprasījumu. Poga «Ielasīt no reģistra» strādā vienmēr.
 */
export function traficomFiAutoSignal(
  rows: readonly FinlandLinkRow[],
  plates?: { fi?: string } | null,
  extraTexts: readonly { source: string; text: string }[] = [],
): { start: boolean; reason: string } {
  const hit = detectFinlandLink(rows, plates ? { fi: plates.fi ?? "" } : null);
  if (hit.linked === true) return { start: true, reason: hit.source };
  for (const t of extraTexts) {
    if (detectFinlandLink([{ id: "carinfo", status: "found", summary: t.text }]).linked === true) return { start: true, reason: t.source };
  }
  return { start: false, reason: "" };
}

/** Vai automātika drīkst sākt (iepriekšējais stāvoklis neliedz): vienu VIN automātika prasa tikai vienreiz. */
export function traficomFiAutoPrevAllowsStart(prev: TraficomFiAutoStatus | null | undefined): boolean {
  if (!prev) return true;
  return prev.state === "skipped" || prev.state === "not_configured";
}

/* ---------------- Rezultāts -> traficom_fi bloks ---------------- */

const KM_RE = /(\d{1,3}(?:[\s., ]\d{3})+|\d{3,7})\s*(?:km)?\b/i;
const DATE_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

function dateFi(raw: string): string {
  const m = DATE_RE.exec(raw);
  return m ? `${m[1]!.padStart(2, "0")}.${m[2]!.padStart(2, "0")}.${m[3]}` : "";
}

function kmOf(raw: string): string {
  const m = KM_RE.exec(raw.replace(DATE_RE, " "));
  if (!m) return "";
  const n = Number(m[1]!.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 && n < 3_000_000 ? String(n) : "";
}

function find(rowsList: readonly [string, string][], re: RegExp): string {
  return rowsList.find(([l]) => re.test(l))?.[1] ?? "";
}

function inspectionResultLv(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^(approved|passed|hyväksytty|ok)\b/i.test(t)) return "Izturēta";
  if (/rejected|failed|hylätty|not\s+approved|ei\s+hyväksytty/i.test(t)) return "Neizturēta";
  if (/re-?inspection|jälkitarkastus|conditionally|ehdollisesti/i.test(t)) return "Jāveic atkārtota apskate";
  return `${t} (oriģināls)`;
}

export type TraficomFiInspection = { date: string; odometer: string; result: string; defects: string; station: string };

/** Pēdējās apskates dati no "Inspection information" (bezmaksas) sadaļas, ja tādi ir. */
export function traficomFiLastInspection(data: TraficomFiData | null | undefined): TraficomFiInspection | null {
  if (!data) return null;
  const section = data.sections.find((s) => /inspection\s+information|katsastustiedot|katsastus/i.test(s.title));
  if (!section) return null;
  const r = section.rows;
  const date = dateFi(find(r, /(date|päivä|time)/i) || find(r, /last|latest|viimeisin|edellinen/i));
  const odometer = kmOf(find(r, /odometer|mileage|kilometr|matkamittari|km/i));
  const result = inspectionResultLv(find(r, /result|tulos|decision|päätös/i));
  const defects = r
    .filter(([l]) => /defect|fault|deficien|vika|puute|viat|remark|huomautus/i.test(l))
    .map(([, v]) => v)
    .join("; ")
    .slice(0, 400);
  const station = find(r, /station|asema|inspector|place/i).slice(0, 80);
  if (!date && !odometer && !result && !defects) return null;
  return { date, odometer, result, defects, station };
}

function mergeMileage(existingRaw: readonly VinRegistryMileageRow[], add: VinRegistryMileageRow | null): VinRegistryMileageRow[] {
  // Tukšās ievades rindas (jauns bloks) neskaitās.
  const existing = existingRaw.filter((r) => String(r.date ?? "").trim() || String(r.odometer ?? "").trim());
  if (!add) return [...existing];
  if (existing.some((r) => r.date === add.date && String(r.odometer) === add.odometer)) return [...existing];
  return sortVinRegistryMileage([...existing, add]);
}

function mergeTimeline(existingRaw: readonly VinRegistryTimelineRow[], add: VinRegistryTimelineRow | null): VinRegistryTimelineRow[] {
  const existing = existingRaw.filter((r) => String(r.date ?? "").trim() || String(r.event ?? "").trim());
  if (!add) return [...existing];
  const rest = existing.filter((r) => !(r.date === add.date && /apskate/i.test(r.event)));
  return sortVinRegistryTimeline([...rest, add]);
}

/** Karogi latviski blokā (sarkanie pirmie); nezināmie - oriģinālā ar «(oriģināls)». */
const FLAG_LV: Array<{ re: RegExp; lv: string }> = [
  { re: /prohibition\s+of\s+driving\s+or\s+use|k[aä]ytt[oö]kielto|ajokielto/i, lv: "Transportlīdzeklim noteikts braukšanas / lietošanas aizliegums." },
  { re: /periodic\s+inspection\s+not\s+performed/i, lv: "Tehniskā apskate nav nokārtota / apstiprināta." },
  { re: /due\s+to\s+a\s+damage/i, lv: "Auto noņemts no reģistra bojājuma dēļ." },
  { re: /reregistration\s+abroad/i, lv: "Auto noņemts no reģistra (reģistrēts ārzemēs)." },
  { re: /export/i, lv: "Auto noņemts no reģistra (eksports)." },
  { re: /^pending\s+data$/i, lv: "Reģistrā ir neapstiprināti dati." },
  { re: /notification\s+of\s+transfer\s+entry/i, lv: "Reģistrā ir paziņojums par īpašuma maiņu." },
  { re: /stolen|varastettu/i, lv: "Auto reģistrēts kā zagts." },
];

export function traficomFiFlagLv(text: string): string {
  const known = FLAG_LV.find((f) => f.re.test(text));
  return known ? known.lv : `${text.trim()} (oriģināls)`;
}

/** Karogu rindas blokam ("Uzmanību: ..." sarkanajiem). */
export function traficomFiFlagLines(data: TraficomFiData | null | undefined): string[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...data.flags].sort((a, b) => Number(b.level === "red") - Number(a.level === "red"));
  for (const f of sorted) {
    const lv = traficomFiFlagLv(f.text);
    if (seen.has(lv)) continue;
    seen.add(lv);
    out.push(f.level === "red" ? `Uzmanību: ${lv}` : lv);
  }
  return out;
}

function mergeLines(base: string, add: readonly string[]): string {
  const lines = base.split("\n").map((l) => l.trim()).filter(Boolean);
  const norm = (s: string) => s.replace(/^uzmanību:\s*/i, "").replace(/[.\s]+$/, "").toLowerCase();
  const have = new Set(lines.map(norm));
  for (const l of add) {
    if (have.has(norm(l))) {
      // Jau ir (no parsera) - sarkano karogu pārveido par "Uzmanību: ...".
      if (/^uzmanību:/i.test(l)) {
        const i = lines.findIndex((x) => norm(x) === norm(l));
        if (i >= 0 && !/^uzmanību:/i.test(lines[i]!)) lines[i] = l;
      }
      continue;
    }
    have.add(norm(l));
    lines.push(l);
  }
  return lines.join("\n");
}

/** AI kontekstam un izvēršamajam skatam: visas bezmaksas sadaļas tekstā. */
export function traficomFiDataPlainText(data: TraficomFiData | null | undefined): string {
  if (!data) return "";
  const out: string[] = [];
  if (data.vehicleTitle) out.push(data.vehicleTitle);
  for (const [l, v] of data.summary) out.push(`${l}: ${v}`);
  for (const f of data.flags) out.push(`[${f.level === "red" ? "!" : "⚠"}] ${f.text}`);
  for (const s of data.sections) {
    out.push(`\n${s.title}`);
    for (const [l, v] of s.rows) out.push(`${l}: ${v}`);
  }
  if (data.source) out.push(data.source);
  return out.join("\n");
}

/**
 * Traficom rezultāts -> `traficom_fi` bloks. Tas pats `applyTraficomReportToBlock` kā PDF / ielīmējumam
 * (statuss, ierobežojumi, nodokļi, hronoloģija), plus: pēdējās apskates nobraukums (kopējā nobraukumā), apskate ar
 * trūkumiem laika joslā (TA kartīte), karogi «Uzmanību». Komentāri, bildes un AI konteksts (ja aizpildīts) paliek.
 */
export function applyTraficomFiResultToBlock(
  block: VinRegistryBlockState,
  result: { rawText?: string; data?: TraficomFiData | null },
): VinRegistryBlockState {
  const raw = (result.rawText ?? "").slice(0, ADMIN_RAW_UNPROCESSED_MAX_LEN);
  const parsed = raw ? applyTraficomReportToBlock({ ...block, rawUnprocessedData: raw }, raw) : null;
  let next: VinRegistryBlockState = parsed ? { ...parsed.block } : { ...block };
  next.rawUnprocessedData = raw || block.rawUnprocessedData;
  next.comments = block.comments;
  next.photos = block.photos ?? [];
  next.photoGroups = block.photoGroups ?? [];

  const insp = traficomFiLastInspection(result.data);
  if (insp?.date) {
    const mileageRow: VinRegistryMileageRow | null = insp.odometer ? { date: insp.date, odometer: insp.odometer, country: FI, origin: "Apskate" } : null;
    const event = [
      `Tehniskā apskate: ${insp.result || "rezultāts nav norādīts"}`,
      insp.station,
      insp.defects ? `Trūkumi: ${insp.defects}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    next = {
      ...next,
      mileage: mergeMileage(next.mileage ?? [], mileageRow),
      timeline: mergeTimeline(next.timeline ?? [], { date: insp.date, odometer: insp.odometer, country: FI, event }),
    };
  }
  const flagLines = traficomFiFlagLines(result.data);
  if (flagLines.length) next = { ...next, autoNotes: mergeLines(next.autoNotes ?? "", flagLines) };
  if (result.data && !(next.aiContextRaw ?? "").trim()) {
    next = { ...next, aiContextRaw: `Somijas oficiālais reģistrs (Traficom, bezmaksas dati)\n${traficomFiDataPlainText(result.data)}`.slice(0, 12_000) };
  }
  return next;
}

/* ---------------- Klienta pogas (kā e.csdd #1277) ---------------- */

/** Vai Traficom datus (vēl) var ievietot blokā ar pogu «Ievietot datus». */
export function traficomFiCanApplyManually(status: TraficomFiAutoStatus | null | undefined, block: VinRegistryBlockState): boolean {
  if (!status || status.state !== "found" || !(status.rawText ?? "").trim()) return false;
  return (block.rawUnprocessedData ?? "").trim() !== status.rawText!.trim();
}

/** Serveris ievietoja (atzvanā), bet atvērtajā cilnē vēl vecais RAW - cilne pārņem ar to pašu funkciju. */
export function traficomFiClientShouldSync(status: TraficomFiAutoStatus | null | undefined, block: VinRegistryBlockState): boolean {
  if (!status || status.state !== "found" || status.appliedBy !== "auto" || !status.appliedAt || status.restoredAt) return false;
  const raw = (status.rawText ?? "").trim();
  const local = (block.rawUnprocessedData ?? "").trim();
  if (!raw || local === raw) return false;
  return local === (status.previousRawText ?? "").trim();
}

/** Vai rādīt «Atjaunot iepriekšējo RAW». */
export function traficomFiCanRestorePrevious(status: TraficomFiAutoStatus | null | undefined, block: VinRegistryBlockState): boolean {
  if (!status || !status.appliedAt || !(status.previousRawText ?? "").trim()) return false;
  return (block.rawUnprocessedData ?? "").trim() !== status.previousRawText!.trim();
}

/** Iepriekšējo RAW saglabā tikai, ja tas nav tukšs un nav jau Traficom teksts. */
export function traficomFiShouldKeepPreviousRaw(previousRaw: string, newRaw: string): boolean {
  const p = previousRaw.trim();
  return Boolean(p) && p !== newRaw.trim();
}

export function traficomFiSessionSummaryLv(s: TraficomFiRelaySession | null | undefined, fmtTime: (iso: string) => string): string {
  if (!s) return "Traficom relejs nav sasniedzams";
  switch (s.state) {
    case "active":
      return `Serveris pieteicies Traficom${s.lastOkAt ? ` (pēdējais vaicājums ${fmtTime(s.lastOkAt)})` : ""}`;
    case "awaiting_eparaksts":
      return "Gaida eParaksts apstiprinājumu telefonā";
    case "expired":
      return "Traficom sesija, visticamāk, beigusies - nākamais vaicājums prasīs eParaksts";
    default:
      return "Serveris nav pieteicies Traficom - vaicājums prasīs eParaksts apstiprinājumu";
  }
}

/* ---------------- VIN SCAN v4 rinda «Traficom (FI)» ---------------- */

export type TraficomFiScanRowView = {
  status: "found" | "none" | "checking" | "unknown" | "browser_only";
  summary: string;
  detail: string;
};

/** Releja stāvoklis -> VIN SCAN rindas statuss / teksts (bez stāvokļa - rinda paliek, kā ir). */
export function traficomFiScanRowView(status: TraficomFiAutoStatus | null | undefined): TraficomFiScanRowView | null {
  if (!status) return null;
  switch (status.state) {
    case "found": {
      const red = status.data?.flags.filter((f) => f.level === "red").length ?? 0;
      const head = [status.data?.vehicleTitle, red ? `${red} sarkani karogi` : ""].filter(Boolean).join(" · ");
      return {
        status: "found",
        summary: `Traficom (FI): ${head || "dati ielasīti"}`,
        detail: [traficomFiFlagLines(status.data).join("\n"), traficomFiDataPlainText(status.data)].filter(Boolean).join("\n\n").slice(0, 8_000),
      };
    }
    case "not_found":
      return { status: "none", summary: "Traficom (FI): VIN nav atrasts", detail: "" };
    case "queued":
    case "searching":
      return { status: "checking", summary: `Traficom (FI): ${status.message || "Gaida rindā"}`, detail: "" };
    case "awaiting_eparaksts":
      return {
        status: "checking",
        summary: `Traficom (FI): gaida eParaksts apstiprinājumu telefonā${status.verificationCode ? ` · kods ${status.verificationCode}` : ""}`,
        detail: "",
      };
    case "error":
    case "not_configured":
      return { status: "unknown", summary: `Traficom (FI): ${status.message || "kļūda"}`, detail: "" };
    default:
      return null;
  }
}
