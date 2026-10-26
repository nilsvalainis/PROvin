import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import { toActiveWaybillRows } from "@/lib/iriss-pavadzimes-active";
import { computeWaybillLifecycles, sortWaybillsNewestFirst } from "@/lib/iriss-pavadzimes-lifecycle";
import { matchIrissPavadzimesToOrders } from "@/lib/iriss-pavadzimes-match";
import { waybillValidityTone } from "@/lib/iriss-pavadzimes-parse";
import { listIrissPavadzimes, readIrissPavadzimesCached } from "@/lib/iriss-pavadzimes-store";
import type { IrissPavadzimeListRow, IrissPavadzimeRecord } from "@/lib/iriss-pavadzimes-types";
import { isAllowlistedWaybillPlate, withdrawnWaybillNos, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import {
  CSDD_PLATES_FRESH_MS,
  mergeCsddActiveRows,
  type CsddActiveWaybill,
  type CsddPlatesDoc,
} from "@/lib/iriss-waybill-csdd-plates";
import { composeWaybillPlateStates } from "@/lib/iriss-waybill-live-plates";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";
import { readCsddPlatesDocSafe } from "@/lib/iriss-waybill-csdd-plates-store";
import type { IrissSection } from "@/lib/staff-roles";

export type IrissPavadzimesPageData = {
  rows: IrissPavadzimeListRow[];
  pendingParse: number;
  dropboxConfigured: boolean;
  dropboxError: string | null;
};

/** Pasūtījuma saiti (klienta vārdu) pie pavadzīmes redz tikai administrators vai darbinieks ar sadaļu Pasūtījumi. */
export function canSeeWaybillOrders(actor: { kind: "admin" } | { kind: "staff"; user: { sections: readonly IrissSection[] } }): boolean {
  return actor.kind === "admin" || actor.user.sections.includes("pasutijumi");
}

/** Darbiniekam bez Pasūtījumiem: tikai pavadzīmes lauki - bez pasūtījuma saites un krātuves (Dropbox/Blob) ceļiem. */
export function waybillRowWithoutOrder<T extends IrissPavadzimeListRow>(row: T): T {
  return { ...row, order: null, dropboxId: "", dropboxPath: "", dropboxRev: "", dropboxContentHash: "", blobPath: "" };
}

export async function loadIrissPavadzimesPageData(
  now = new Date(),
  opts: { withOrders?: boolean } = {},
): Promise<IrissPavadzimesPageData> {
  const withOrders = opts.withOrders ?? true;
  // Pasūtījumus lasa paralēli Dropbox sinhronizācijai (agrāk - pēc tās, +1 secīgs Blob ceļš).
  const [listed, csdd, orders] = await Promise.all([
    listIrissPavadzimes(),
    readCsddPlatesDocSafe(),
    withOrders ? listIrissPasutijumi().catch(() => []) : Promise.resolve([]),
  ]);
  const lifecycles = computeWaybillLifecycles(listed.rows, now, csdd);
  const matched = matchIrissPavadzimesToOrders(listed.rows, orders).map((row, i) => {
    const src = listed.rows[i];
    const info = src ? lifecycles.get(src) : undefined;
    return {
      ...row,
      validityTone: waybillValidityTone(row.validUntil, now),
      lifecycle: info?.lifecycle ?? "unknown",
      ...(info?.supersededBy ? { supersededBy: info.supersededBy } : {}),
    };
  });
  const withdrawn = withdrawnWaybillNos(listed.rows, csdd);
  const sorted = sortWaybillsNewestFirst(appendCsddOnlyRows(matched, csdd, withdrawn, now));
  return {
    rows: withOrders ? sorted : sorted.map(waybillRowWithoutOrder),
    pendingParse: listed.pendingParse,
    dropboxConfigured: listed.dropboxConfigured,
    dropboxError: listed.dropboxError,
  };
}

function csddWaybillStillActive(w: CsddActiveWaybill, checkedAt: string, nowMs: number): boolean {
  const until = Date.parse(w.validUntil);
  if (Number.isFinite(until)) return until > nowMs;
  return nowMs - Date.parse(checkedAt) <= CSDD_PLATES_FRESH_MS;
}

function csddOnlyListRow(
  w: CsddActiveWaybill,
  plate: string,
  updatedAt: string,
  now: Date,
): IrissPavadzimeListRow {
  const tone = waybillValidityTone(w.validUntil, now);
  return {
    id: "",
    number: w.waybillNo,
    brandModel: w.brandModel,
    vin: "",
    plate,
    issuedAt: "",
    validUntil: w.validUntil,
    fileName: "",
    source: "upload",
    dropboxId: "",
    dropboxPath: "",
    dropboxRev: "",
    dropboxContentHash: "",
    blobPath: "",
    parsedAt: "",
    updatedAt,
    validityTone: tone === "unknown" ? "ok" : tone,
    lifecycle: "active",
    order: null,
  };
}

/**
 * Aktīvās saraksts: CSDD-aktīva pavadzīme, kuras nav indeksā (piem. P02827, PDF nav Dropbox),
 * tiek pievienota kā rinda bez PDF (tukšs id). Indeksa rindas nekad neizstāj.
 */
export function appendCsddOnlyRows(
  rows: IrissPavadzimeListRow[],
  doc: CsddPlatesDoc | null,
  withdrawnNos: ReadonlySet<string>,
  now = new Date(),
): IrissPavadzimeListRow[] {
  if (!doc) return rows;
  const nowMs = now.getTime();
  const known = new Set(rows.map((r) => r.number.trim().toUpperCase()).filter(Boolean));
  const extra: IrissPavadzimeListRow[] = [];
  for (const entry of doc.plates) {
    for (const w of entry.active) {
      if (!csddWaybillStillActive(w, entry.checkedAt, nowMs)) continue;
      const no = w.waybillNo.trim().toUpperCase();
      if (!no || known.has(no) || withdrawnNos.has(no)) continue;
      known.add(no);
      extra.push(csddOnlyListRow(w, entry.plate, doc.updatedAt, now));
    }
  }
  return extra.length ? [...rows, ...extra] : rows;
}

/** Sānjosla / mobilā josla: tikai dzīvie dīlera nr., bez B861-6. */
export function selectActiveCardWaybills(
  rows: IrissPavadzimeRecord[],
  now = new Date(),
): IrissPavadzimeListRow[] {
  return toActiveWaybillRows(rows, now).filter((row) => isAllowlistedWaybillPlate(row.plate));
}

/** Sānjoslas karte: tikai kešs, bez Dropbox sync un bez pasūtījumu saskaņošanas. */
export async function loadIrissPavadzimesActiveCardData(
  now = new Date(),
  opts: { withOrders?: boolean } = {},
): Promise<{
  rows: IrissPavadzimeListRow[];
  /** Numuru stāvoklis - tas pats, ko rāda numura pogas (j25). Apļi to ņem par pamatu, rows tikai PDF saitei. */
  plates: WaybillPlateState[];
}> {
  const [cached, csdd, requests] = await Promise.all([readIrissPavadzimesCached(), readCsddPlatesDocSafe(), readWaybillRequestsSafe()]);
  // CSDD reģistrā aktīvas (arī ar roku izrakstītas) pavadzīmes, kuru nav indeksā - lai josla nerāda "brīvs".
  const rows = mergeCsddActiveRows(selectActiveCardWaybills(cached, now), csdd, now);
  const plates = composeWaybillPlateStates(cached, csdd, requests, now);
  return { rows: opts.withOrders ?? true ? rows : rows.map(waybillRowWithoutOrder), plates };
}

/** Pieprasījumu rinda apļiem; kļūda nav fatāla (tad tikai indekss + CSDD). */
async function readWaybillRequestsSafe() {
  try {
    return (await readWaybillRequestsDoc()).requests;
  } catch (err) {
    console.error("[iriss pavadzimes] requests_failed", err instanceof Error ? err.message : err);
    return [];
  }
}
