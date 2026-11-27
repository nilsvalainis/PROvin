/**
 * CheckThisReg automātiskā ievade (Nila «jā» 27.11.2026, A) - tīrā loģika (bez server-only, testējama).
 *
 * Plūsma: Hetzner darbinieks (relay/provin-ctr-inbox) lasa Nila pastu, no «Your Report is Ready!» /
 * «Update About Your Order» paņem guest saiti, GET pasūtījuma JSON + PDF un sūta uz `/api/ctr/ingest`.
 * Sistēma NEKAD nepērk, netērē tokenus un neizsauc redeem/purchase/refund - tikai lasa Nila jau nopirkto.
 */
import { timingSafeEqual } from "node:crypto";

import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import { normalizeAutoRecordsOdometer, sortAutoRecordsDescending, type AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsServiceWorkRowHasData,
  mergeAutoRecordsServiceWorkRow,
  sortAutoRecordsServiceWorkRows,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";
import { emptyOilIntervalChart } from "@/lib/oil-change-interval-chart";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const CTR_INGEST_MAX_DOC_BYTES = 20 * 1024 * 1024;
/** Vercel ķermenis ~4,5 MB -> darbinieks sūta PDF daļās pa ≤ 2,5 MB (base64 ~3,4 MB). */
export const CTR_INGEST_CHUNK_MAX_BYTES = 2.5 * 1024 * 1024;
export const CTR_INGEST_MAX_CHUNKS = 10;
export const CTR_INGEST_MAX_DOCS = 40;
/** Pasūtījums ar šo VIN pēdējās 120 dienās. */
export const CTR_ORDER_WINDOW_MS = 120 * 24 * 60 * 60_000;
/** Gaidošie (pasūtījums vēl nav atrasts) - 30 dienas, kā CheckThisReg saite. */
export const CTR_PENDING_TTL_MS = 30 * 24 * 60 * 60_000;

export const CTR_SOURCE_LABEL = "CheckThisReg";

/** `Authorization: Bearer <CTR_INGEST_TOKEN>`; bez env (≥ 24 zīmes) maršruts izslēgts. */
export function verifyCtrIngestToken(header: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = (env.CTR_INGEST_TOKEN ?? "").trim();
  if (secret.length < 24) return false;
  const given = extractBearerToken(header);
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** CheckThisReg pasūtījuma id («token_<laiks>_<kods>», «cs_live_…») - drošs Blob ceļam. */
export function isSafeCtrOrderId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{6,120}$/.test(id);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export type CtrDocumentChunk = {
  ctrOrderId: string;
  md5: string;
  fileName: string;
  index: number;
  count: number;
  bytes: Uint8Array;
};

export function parseCtrDocumentChunk(body: Record<string, unknown>): CtrDocumentChunk | { error: string } {
  if (!isSafeCtrOrderId(body.ctrOrderId)) return { error: "invalid_order_id" };
  const md5 = str(body.md5, 40).toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(md5)) return { error: "invalid_md5" };
  const fileName = str(body.fileName, 160);
  const count = typeof body.chunkCount === "number" ? body.chunkCount : 1;
  const index = typeof body.chunkIndex === "number" ? body.chunkIndex : 0;
  if (!Number.isInteger(count) || count < 1 || count > CTR_INGEST_MAX_CHUNKS) return { error: "invalid_chunk" };
  if (!Number.isInteger(index) || index < 0 || index >= count) return { error: "invalid_chunk" };
  const b64 = typeof body.chunkBase64 === "string" ? body.chunkBase64 : "";
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.byteLength === 0 || bytes.byteLength > CTR_INGEST_CHUNK_MAX_BYTES) return { error: "invalid_chunk_size" };
  return { ctrOrderId: body.ctrOrderId, md5, fileName, index, count, bytes };
}

export type CtrEmailKind = "ready" | "update";

export type CtrFinalizeDoc = { md5: string; fileName: string; size: number };

export type CtrFinalize = {
  ctrOrderId: string;
  orderNumber: string;
  vin: string;
  manufacturer: string;
  product: string;
  emailKind: CtrEmailKind;
  /** E-pasta laiks (ISO). */
  receivedAt: string;
  /** CheckThisReg pasūtījuma statuss («completed» u.c.). */
  ctrStatus: string;
  documents: CtrFinalizeDoc[];
};

export function parseCtrFinalize(body: Record<string, unknown>): CtrFinalize | { error: string } {
  if (!isSafeCtrOrderId(body.ctrOrderId)) return { error: "invalid_order_id" };
  const vin = normalizeVin(str(body.vin, 40));
  if (!isValidVin(vin)) return { error: "invalid_vin" };
  const emailKind = body.emailKind === "update" ? "update" : body.emailKind === "ready" ? "ready" : null;
  if (!emailKind) return { error: "invalid_email_kind" };
  const rawDocs = Array.isArray(body.documents) ? body.documents : [];
  if (rawDocs.length > CTR_INGEST_MAX_DOCS) return { error: "too_many_documents" };
  const documents: CtrFinalizeDoc[] = [];
  for (const d of rawDocs) {
    if (!d || typeof d !== "object") return { error: "invalid_document" };
    const o = d as Record<string, unknown>;
    const md5 = str(o.md5, 40).toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(md5)) return { error: "invalid_document" };
    if (documents.some((x) => x.md5 === md5)) continue;
    documents.push({
      md5,
      fileName: str(o.fileName, 160) || `${md5}.pdf`,
      size: typeof o.size === "number" && Number.isFinite(o.size) ? Math.max(0, Math.trunc(o.size)) : 0,
    });
  }
  const receivedAt = str(body.receivedAt, 40);
  return {
    ctrOrderId: body.ctrOrderId,
    orderNumber: str(body.orderNumber, 40).replace(/[^A-Za-z0-9-]/g, ""),
    vin,
    manufacturer: str(body.manufacturer, 40).replace(/[^\p{L}\p{N} .&-]/gu, ""),
    product: str(body.product, 60),
    emailKind,
    receivedAt: Number.isFinite(Date.parse(receivedAt)) ? receivedAt : new Date().toISOString(),
    ctrStatus: str(body.ctrStatus, 40),
    documents,
  };
}

/* ------------------------------------------------------------------ */
/* Pasūtījuma atrašana                                                 */

export type CtrOrderCandidate = {
  id: string;
  createdMs: number;
  vins: Array<string | null | undefined>;
  checkoutLine?: string | null;
  isManual?: boolean;
  /** Atskaite jau nosūtīta klientam (`clientReportReadyAt`). */
  reportSent: boolean;
};

/** Dīlera dati, AUDITS (premium/audit), Business; manuālajiem līnija var nebūt. MINI / SELECT / konsultācija - nē. */
export function ctrOrderLineAllowed(line: string | null | undefined, isManual?: boolean): boolean {
  if (!line) return Boolean(isManual);
  return line === "dealer" || line === "premium" || line === "audit" || line === "business";
}

/**
 * Jaunākais apmaksātais dīlera datu vai AUDITS pasūtījums ar šo VIN, kas vēl nav nosūtīts klientam.
 * Dīlera datu pasūtījumam priekšroka (tieši tam CheckThisReg ir domāts).
 */
export function matchCtrOrder(candidates: readonly CtrOrderCandidate[], vinRaw: string, nowMs: number): string | null {
  const vin = normalizeVin(vinRaw);
  if (!isValidVin(vin)) return null;
  const ok = candidates.filter(
    (c) =>
      !c.reportSent &&
      ctrOrderLineAllowed(c.checkoutLine, c.isManual) &&
      c.createdMs <= nowMs + 60_000 &&
      nowMs - c.createdMs <= CTR_ORDER_WINDOW_MS &&
      c.vins.some((v) => normalizeVin(String(v ?? "")) === vin),
  );
  ok.sort((a, b) => {
    const da = a.checkoutLine === "dealer" ? 1 : 0;
    const db = b.checkoutLine === "dealer" ? 1 : 0;
    return db - da || b.createdMs - a.createdMs;
  });
  return ok[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Dīlera bloka sapludināšana                                          */

export type CtrAutoRecordsPatch = {
  serviceWorks: AutoRecordsServiceWorkRow[];
  serviceHistory: AutoRecordsServiceRow[];
  rawText: string;
  aiContext: string;
  oilInterval: { km: number | null; months: number | null } | null;
};

function appendBlock(prev: string, add: string): string {
  const a = (prev ?? "").trim();
  const b = add.trim();
  if (!b) return a;
  if (a.includes(b)) return a;
  return a ? `${a}\n\n${b}` : b;
}

function historyKey(r: Pick<AutoRecordsServiceRow, "date" | "odometer">): string {
  return `${r.date.trim()}|${normalizeAutoRecordsOdometer(r.odometer ?? "")}`;
}

/**
 * Sapludina CheckThisReg datus esošajā dīlera blokā: servisa rindas pēc datuma+km (tā pati vizīte netiek dublēta),
 * nobraukuma rindas pēc datuma+km, RAW / AI konteksts pievienots beigās, ražotāja eļļas intervāls tikai tukšā grafikā.
 * Operatora jau ievadītais netiek dzēsts.
 */
export function applyCtrToAutoRecords(ar: AutoRecordsBlockState, patch: CtrAutoRecordsPatch): AutoRecordsBlockState {
  let works = (ar.serviceWorks ?? []).filter(autoRecordsServiceWorkRowHasData);
  for (const row of patch.serviceWorks) works = mergeAutoRecordsServiceWorkRow(works, row);
  works = sortAutoRecordsServiceWorkRows(works);

  const history = (ar.serviceHistory ?? []).filter((r) => r.date.trim() || r.odometer.trim());
  const seen = new Set(history.map(historyKey));
  for (const r of patch.serviceHistory) {
    const k = historyKey(r);
    if (!r.date.trim() || !normalizeAutoRecordsOdometer(r.odometer) || seen.has(k)) continue;
    seen.add(k);
    history.push({ date: r.date, odometer: normalizeAutoRecordsOdometer(r.odometer), country: r.country ?? "" });
  }

  let chart = ar.oilIntervalChart;
  if (patch.oilInterval && (patch.oilInterval.km || patch.oilInterval.months)) {
    const base = chart ?? emptyOilIntervalChart();
    chart = {
      ...base,
      oemKm: base.oemKm ?? patch.oilInterval.km ?? null,
      oemMonths: base.oemMonths ?? patch.oilInterval.months ?? null,
    };
  }

  return {
    ...ar,
    serviceWorks: works,
    serviceHistory: sortAutoRecordsDescending(history),
    rawUnprocessedData: appendBlock(ar.rawUnprocessedData ?? "", patch.rawText),
    aiContextRaw: appendBlock(ar.aiContextRaw ?? "", patch.aiContext),
    ...(chart ? { oilIntervalChart: chart } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Ieraksts pasūtījumam (admin čips) un statistika                     */

export type CtrResult = "data" | "no_data" | "manual_needed";

export type CtrOrderRecord = {
  status: CtrResult;
  at: string;
  ctrOrderIds: string[];
  orderNumbers: string[];
  docCount: number;
  serviceRows: number;
  mileageRows: number;
  formats: string[];
};

export function normalizeCtrOrderRecord(raw: unknown): CtrOrderRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status === "data" || o.status === "no_data" || o.status === "manual_needed" ? o.status : null;
  const at = str(o.at, 40);
  if (!status || !Number.isFinite(Date.parse(at))) return null;
  const list = (v: unknown, re: RegExp) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && re.test(x)).slice(0, 20) : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0);
  return {
    status,
    at,
    ctrOrderIds: list(o.ctrOrderIds, /^[A-Za-z0-9_-]{6,120}$/),
    orderNumbers: list(o.orderNumbers, /^[A-Za-z0-9-]{1,40}$/),
    docCount: num(o.docCount),
    serviceRows: num(o.serviceRows),
    mileageRows: num(o.mileageRows),
    formats: list(o.formats, /^[a-z_]{1,40}$/),
  };
}

/** Jauns ieraksts pēc ievades; «dati» uzvar pār «nav datu» (vairāki pirkumi vienam pasūtījumam). */
export function nextCtrOrderRecord(
  prev: CtrOrderRecord | null,
  add: { status: CtrResult; at: string; ctrOrderId: string; orderNumber: string; docCount: number; serviceRows: number; mileageRows: number; formats: string[] },
): CtrOrderRecord {
  const rank: Record<CtrResult, number> = { no_data: 0, manual_needed: 1, data: 2 };
  const status = prev && rank[prev.status] > rank[add.status] ? prev.status : add.status;
  const uniq = (a: string[]) => [...new Set(a.filter(Boolean))].slice(-20);
  return {
    status,
    at: add.at,
    ctrOrderIds: uniq([...(prev?.ctrOrderIds ?? []), add.ctrOrderId]),
    orderNumbers: uniq([...(prev?.orderNumbers ?? []), add.orderNumber]),
    docCount: (prev?.docCount ?? 0) + add.docCount,
    serviceRows: Math.max(prev?.serviceRows ?? 0, add.serviceRows),
    mileageRows: Math.max(prev?.mileageRows ?? 0, add.mileageRows),
    formats: uniq([...(prev?.formats ?? []), ...add.formats]),
  };
}

function dmyRiga(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}.${get("month")}`;
}

/** Admin čips dīlera blokā. */
export function ctrChipLabel(rec: CtrOrderRecord | null): { text: string; tone: "ok" | "missing" | "manual" } | null {
  if (!rec) return null;
  if (rec.status === "data") return { text: `${CTR_SOURCE_LABEL}: dati ievadīti ${dmyRiga(rec.at)}`, tone: "ok" };
  if (rec.status === "manual_needed") return { text: `${CTR_SOURCE_LABEL}: PDF saņemts, jāapstrādā ar roku`, tone: "manual" };
  return { text: `${CTR_SOURCE_LABEL}: nav datu`, tone: "missing" };
}

/**
 * Rezultāts: PDF ar atpazītiem datiem -> data; PDF bez atpazīta formāta -> manual_needed;
 * nav PDF (parasti «Update About Your Order») -> no_data.
 */
export function decideCtrResult(args: { docCount: number; hasStructuredData: boolean; serviceRows: number; mileageRows: number; unknownDocs: number }): CtrResult {
  if (args.docCount === 0) return "no_data";
  if (args.serviceRows > 0 || args.mileageRows > 0) return "data";
  if (args.unknownDocs > 0) return "manual_needed";
  return args.hasStructuredData ? "data" : "manual_needed";
}

export type CtrStatsEntry = {
  at: string;
  make: string;
  model: string;
  year: number | null;
  result: CtrResult | "pending";
  docs: number;
  serviceRows: number;
  emailKind: CtrEmailKind;
};

export const CTR_STATS_MAX = 3000;

export function appendCtrStats(list: readonly CtrStatsEntry[], entry: CtrStatsEntry): CtrStatsEntry[] {
  return [...list, entry].slice(-CTR_STATS_MAX);
}

export function normalizeCtrStats(raw: unknown): CtrStatsEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CtrStatsEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const result = ["data", "no_data", "manual_needed", "pending"].includes(String(o.result)) ? (o.result as CtrStatsEntry["result"]) : null;
    if (!result || !Number.isFinite(Date.parse(str(o.at, 40)))) continue;
    out.push({
      at: str(o.at, 40),
      make: str(o.make, 40),
      model: str(o.model, 120),
      year: typeof o.year === "number" && Number.isFinite(o.year) ? o.year : null,
      result,
      docs: typeof o.docs === "number" ? o.docs : 0,
      serviceRows: typeof o.serviceRows === "number" ? o.serviceRows : 0,
      emailKind: o.emailKind === "update" ? "update" : "ready",
    });
  }
  return out.slice(-CTR_STATS_MAX);
}

/** Modelis statistikai: pirmā virsraksta daļa līdz komatam («Trafic II (J83)», «MEGANE 100% ELEC (BCB)», «BMW F11»). */
export function ctrModelFromVehicleLine(line: string): string {
  return line.split(",")[0]?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "";
}

export type CtrPendingEntry = {
  ctrOrderId: string;
  vin: string;
  at: string;
  /** Pēdējais atkārtotais mēģinājums (ne biežāk kā reizi stundā - katrs lasa pasūtījumu sarakstu). */
  triedAt?: string;
  finalize: CtrFinalize;
};

export const CTR_PENDING_RETRY_EVERY_MS = 60 * 60_000;

export function ctrPendingDue(p: Pick<CtrPendingEntry, "triedAt">, nowMs: number): boolean {
  const t = p.triedAt ? Date.parse(p.triedAt) : NaN;
  return !Number.isFinite(t) || nowMs - t >= CTR_PENDING_RETRY_EVERY_MS;
}

export function normalizeCtrPending(raw: unknown, nowMs: number = Date.now()): CtrPendingEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CtrPendingEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const at = str(o.at, 40);
    const fin = o.finalize && typeof o.finalize === "object" ? parseCtrFinalize(o.finalize as Record<string, unknown>) : null;
    if (!fin || "error" in fin || !Number.isFinite(Date.parse(at))) continue;
    if (nowMs - Date.parse(at) > CTR_PENDING_TTL_MS) continue;
    if (out.some((x) => x.ctrOrderId === fin.ctrOrderId)) continue;
    const triedAt = str(o.triedAt, 40);
    out.push({ ctrOrderId: fin.ctrOrderId, vin: fin.vin, at, ...(Number.isFinite(Date.parse(triedAt)) ? { triedAt } : {}), finalize: fin });
  }
  return out.slice(-100);
}
