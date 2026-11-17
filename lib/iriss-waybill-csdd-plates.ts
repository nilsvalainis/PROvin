/**
 * CSDD reģistra numuru stāvoklis (Hetzner worker sync.js -> POST /api/iriss/aivars/waybill-plates).
 * Incidents 23.10: B193-7 rādīja "brīvs", jo P02812 Nils izrakstīja ar roku CSDD un mūsu indeksā (Dropbox) tās nebija.
 * Tāpēc numura aizņemtība = mūsu indekss VAI CSDD momentuzņēmums (jebkurš avots saka "aizņemts" -> aizņemts).
 * CSDD "brīvs" nekad nepārraksta mūsu "aizņemts": ja nolasījums būtu kļūdains, labāk pajautāt nekā izveidot pāri.
 */

import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { compactDealerPlate, displayDealerPlate, IRISS_DEALER_PLATES, type IrissDealerPlate, type WaybillPlateState } from "@/lib/iriss-waybill-plates";

export type CsddActiveWaybill = {
  waybillNo: string;
  validUntil: string;
  brandModel: string;
};

export type CsddPlateEntry = {
  plate: IrissDealerPlate;
  /** Nolasījums izdevās (ja nē - active tukšs un tiek ņemts iepriekšējais). */
  ok: boolean;
  checkedAt: string;
  active: CsddActiveWaybill[];
  error: string;
};

export type CsddPlatesDoc = {
  version: 1;
  updatedAt: string;
  plates: CsddPlateEntry[];
};

/** Momentuzņēmums ir "svaigs" (UI var rakstīt "pārbaudīts CSDD"). Vecāks joprojām skaitās aizņemts līdz validUntil. */
export const CSDD_PLATES_FRESH_MS = 15 * 60 * 1000;
const WAYBILL_NO_RE = /^P\d{5,6}$/;

export function emptyCsddPlatesDoc(): CsddPlatesDoc {
  return { version: 1, updatedAt: new Date().toISOString(), plates: [] };
}

function iso(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

function parseActive(raw: unknown): CsddActiveWaybill[] {
  if (!Array.isArray(raw)) return [];
  const out: CsddActiveWaybill[] = [];
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const waybillNo = typeof o.waybillNo === "string" ? o.waybillNo.trim().toUpperCase() : "";
    if (!WAYBILL_NO_RE.test(waybillNo)) continue;
    out.push({
      waybillNo,
      validUntil: iso(o.validUntil),
      brandModel: typeof o.brandModel === "string" ? o.brandModel.trim().slice(0, 80) : "",
    });
  }
  return out;
}

function parseEntry(raw: unknown): CsddPlateEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const plate = displayDealerPlate(typeof o.plate === "string" ? o.plate : "");
  const checkedAt = iso(o.checkedAt);
  if (!plate || !checkedAt) return null;
  const ok = o.ok === true;
  return {
    plate,
    ok,
    checkedAt,
    active: ok ? parseActive(o.active) : [],
    error: typeof o.error === "string" ? o.error.slice(0, 160) : "",
  };
}

/** Worker POST ķermenis -> ieraksti (nederīgie izmesti). null, ja nav neviena derīga. */
export function parseCsddPlatesReport(raw: unknown): CsddPlateEntry[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const list = (raw as { plates?: unknown }).plates;
  if (!Array.isArray(list)) return null;
  const entries = list.map(parseEntry).filter((e): e is CsddPlateEntry => Boolean(e));
  return entries.length ? entries : null;
}

export function parseCsddPlatesDoc(raw: unknown): CsddPlatesDoc {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyCsddPlatesDoc();
  const o = raw as Record<string, unknown>;
  const plates = Array.isArray(o.plates) ? o.plates.map(parseEntry).filter((e): e is CsddPlateEntry => Boolean(e)) : [];
  return { version: 1, updatedAt: iso(o.updatedAt) || new Date().toISOString(), plates };
}

/**
 * Jauns nolasījums aizstāj veco tikai, ja tas izdevās un ir jaunāks. Neizdevies nolasījums atstāj iepriekšējo
 * (aktīvās pavadzīmes paliek aizņemtas līdz derīguma beigām), bet atzīmē kļūdu.
 */
export function applyCsddPlatesReport(doc: CsddPlatesDoc, entries: CsddPlateEntry[], now = new Date()): CsddPlatesDoc {
  const byPlate = new Map(doc.plates.map((e) => [e.plate, e]));
  for (const e of entries) {
    const prev = byPlate.get(e.plate);
    if (prev && Date.parse(prev.checkedAt) > Date.parse(e.checkedAt)) continue;
    byPlate.set(e.plate, e.ok || !prev ? e : { ...prev, error: e.error || "nolasījums neizdevās" });
  }
  return {
    version: 1,
    updatedAt: now.toISOString(),
    plates: IRISS_DEALER_PLATES.map((p) => byPlate.get(p)).filter((e): e is CsddPlateEntry => Boolean(e)),
  };
}

/** Pavadzīme vēl aizņem numuru: derīguma beigas nav zināmas (tad tikai svaigā nolasījumā) vai vēl nav pienākušas. */
function stillActive(w: CsddActiveWaybill, entry: CsddPlateEntry, nowMs: number): boolean {
  const until = Date.parse(w.validUntil);
  if (Number.isFinite(until)) return until > nowMs;
  return nowMs - Date.parse(entry.checkedAt) <= CSDD_PLATES_FRESH_MS;
}

/** CSDD aktīvā pavadzīme šim numuram (jaunākā), ja tāda ir. */
export function csddActiveForPlate(doc: CsddPlatesDoc | null, plate: string, nowMs = Date.now()): CsddActiveWaybill | null {
  if (!doc) return null;
  const want = compactDealerPlate(plate);
  const entry = doc.plates.find((e) => compactDealerPlate(e.plate) === want);
  if (!entry) return null;
  const list = entry.active.filter((w) => stillActive(w, entry, nowMs));
  return list.length ? list[list.length - 1] : null;
}

/**
 * Numuru stāvoklis: mūsu indekss + CSDD. CSDD aktīvā pavadzīme padara numuru aizņemtu, ja tā nav atsauktā
 * indeksa rinda (Arhīvs / CSDD atsaucis) - tad active ir vecs momentuzņēmums, ne īsta OWS.
 */
export function mergeCsddPlateStates(
  states: WaybillPlateState[],
  doc: CsddPlatesDoc | null,
  nowMs = Date.now(),
  withdrawnNos?: ReadonlySet<string>,
): WaybillPlateState[] {
  return states.map((state) => {
    const csdd = csddActiveForPlate(doc, state.plate, nowMs);
    if (!csdd) return state;
    if (withdrawnNos?.has(csdd.waybillNo.toUpperCase())) return state;
    const same = state.current?.number && state.current.number.toUpperCase() === csdd.waybillNo;
    if (state.busy && (same || !csdd.validUntil || Date.parse(state.current?.validUntil ?? "") >= Date.parse(csdd.validUntil))) return state;
    return {
      plate: state.plate,
      busy: true,
      current: {
        number: csdd.waybillNo,
        brandModel: csdd.brandModel || (same ? (state.current?.brandModel ?? "") : ""),
        validUntil: csdd.validUntil,
      },
    };
  });
}

/**
 * Sānjoslas / mobilās joslas rindas: CSDD aktīvā pavadzīme, kuras nav mūsu indeksā (piem. ar roku izrakstīta),
 * tiek pievienota kā rinda bez PDF (tukšs id - UI nerāda "Atvērt PDF"), lai josla nerāda "brīvs".
 */
export function mergeCsddActiveRows(rows: IrissPavadzimeListRow[], doc: CsddPlatesDoc | null, now = new Date()): IrissPavadzimeListRow[] {
  if (!doc) return rows;
  const nowMs = now.getTime();
  const out = [...rows];
  for (const plate of IRISS_DEALER_PLATES) {
    const csdd = csddActiveForPlate(doc, plate, nowMs);
    if (!csdd) continue;
    if (out.some((r) => r.number.toUpperCase() === csdd.waybillNo)) continue;
    const idx = out.findIndex((r) => displayDealerPlate(r.plate) === plate);
    const row: IrissPavadzimeListRow = {
      id: "",
      number: csdd.waybillNo,
      brandModel: csdd.brandModel,
      vin: "",
      plate,
      issuedAt: "",
      validUntil: csdd.validUntil,
      fileName: "",
      source: "upload",
      dropboxId: "",
      dropboxPath: "",
      dropboxRev: "",
      dropboxContentHash: "",
      blobPath: "",
      parsedAt: "",
      updatedAt: doc.updatedAt,
      validityTone: "ok",
      order: null,
    };
    const prevUntil = idx >= 0 ? Date.parse(out[idx].validUntil) : Number.NaN;
    const csddUntil = Date.parse(csdd.validUntil);
    if (idx < 0) out.push(row);
    else if (!Number.isFinite(prevUntil) || prevUntil < nowMs || !Number.isFinite(csddUntil) || csddUntil > prevUntil) out[idx] = row;
  }
  return out;
}

/** Zināmie numuri worker pārbaudei (CSDD probe sākas no lielākā): CSDD aktīvie + jaunākie no indeksa šīs firmas numuriem. */
export function knownWaybillNumbers(
  indexRows: ReadonlyArray<{ number: string; plate: string }>,
  doc: CsddPlatesDoc | null,
  plates: readonly string[],
): string[] {
  const want = new Set(plates.map(compactDealerPlate));
  const nums = new Set<string>();
  for (const e of doc?.plates ?? []) {
    if (want.has(compactDealerPlate(e.plate))) for (const w of e.active) nums.add(w.waybillNo);
  }
  const index = indexRows
    .filter((r) => want.has(compactDealerPlate(r.plate)) && WAYBILL_NO_RE.test(r.number.toUpperCase()))
    .map((r) => r.number.toUpperCase())
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))
    .slice(0, 3);
  for (const n of index) nums.add(n);
  return [...nums].slice(0, 12);
}
