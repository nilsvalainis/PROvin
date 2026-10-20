import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { isSafeVendorPurchaseVinKey } from "@/lib/vendor-purchase-lock";
import {
  newVendorPurchaseDone,
  newVendorPurchasePending,
  parseVendorPurchaseLockEntry,
  vendorPurchaseLockDecision,
  type VendorPurchaseLockEntry,
} from "@/lib/vendor-purchase-lock";

export type OutvinVinPurchaseDoc = {
  vin: string;
  vehicle?: VendorPurchaseLockEntry;
  history: Record<string, VendorPurchaseLockEntry>;
};

export type AutodnaVinPurchaseDoc = {
  vin: string;
  report?: VendorPurchaseLockEntry;
};

function emptyOutvinDoc(vin: string): OutvinVinPurchaseDoc {
  return { vin, history: {} };
}

function emptyAutodnaDoc(vin: string): AutodnaVinPurchaseDoc {
  return { vin };
}

function parseOutvinDoc(raw: unknown): OutvinVinPurchaseDoc {
  if (!raw || typeof raw !== "object") throw new Error("invalid_outvin_purchase_doc");
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin.trim().toUpperCase() : "";
  if (!isSafeVendorPurchaseVinKey(vin)) throw new Error("invalid_outvin_purchase_doc");
  const history: Record<string, VendorPurchaseLockEntry> = {};
  if (o.history && typeof o.history === "object") {
    for (const [k, v] of Object.entries(o.history as Record<string, unknown>)) {
      const entry = parseVendorPurchaseLockEntry(v);
      if (entry) history[k] = entry;
    }
  }
  const vehicle = parseVendorPurchaseLockEntry(o.vehicle) ?? undefined;
  return { vin, history, ...(vehicle ? { vehicle } : {}) };
}

function parseAutodnaDoc(raw: unknown): AutodnaVinPurchaseDoc {
  if (!raw || typeof raw !== "object") throw new Error("invalid_autodna_purchase_doc");
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin.trim().toUpperCase() : "";
  if (!isSafeVendorPurchaseVinKey(vin)) throw new Error("invalid_autodna_purchase_doc");
  const report = parseVendorPurchaseLockEntry(o.report) ?? undefined;
  return { vin, ...(report ? { report } : {}) };
}

const outvinStore = createJsonDocStore<OutvinVinPurchaseDoc>({
  blobPrefix: "vendor-purchase/outvin/",
  dirName: "vendor-purchase-outvin",
  isSafeKey: isSafeVendorPurchaseVinKey,
  parse: parseOutvinDoc,
  empty: () => emptyOutvinDoc(""),
});

const autodnaStore = createJsonDocStore<AutodnaVinPurchaseDoc>({
  blobPrefix: "vendor-purchase/autodna/",
  dirName: "vendor-purchase-autodna",
  isSafeKey: isSafeVendorPurchaseVinKey,
  parse: parseAutodnaDoc,
  empty: () => emptyAutodnaDoc(""),
});

export type VendorPurchaseClaim =
  | { action: "replay"; entry: VendorPurchaseLockEntry }
  | { action: "in_progress" }
  | { action: "run" };

export async function claimOutvinVehiclePurchase(vin: string, now = Date.now()): Promise<VendorPurchaseClaim> {
  const key = vin.trim().toUpperCase();
  return outvinStore.update<VendorPurchaseClaim>(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key };
    const decision = vendorPurchaseLockDecision(current.vehicle, now);
    if (decision === "replay" && current.vehicle) return { value: { action: "replay", entry: current.vehicle } };
    if (decision === "in_progress") return { value: { action: "in_progress" } };
    return {
      value: { action: "run" },
      next: { ...current, vehicle: newVendorPurchasePending(now) },
    };
  });
}

export async function completeOutvinVehiclePurchase(
  vin: string,
  entry: { ok: boolean; httpStatus?: number; payload?: unknown },
  now = Date.now(),
): Promise<void> {
  const key = vin.trim().toUpperCase();
  await outvinStore.update(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key };
    return {
      value: undefined,
      next: {
        ...current,
        vehicle: newVendorPurchaseDone({ now, ...entry }),
      },
    };
  });
}

export async function releaseOutvinVehiclePurchase(vin: string): Promise<void> {
  const key = vin.trim().toUpperCase();
  await outvinStore.update(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key };
    if (!current.vehicle || current.vehicle.status === "done") return { value: undefined };
    const next = { ...current };
    delete next.vehicle;
    return { value: undefined, next };
  });
}

export async function resetOutvinVehiclePurchase(vin: string): Promise<void> {
  const key = vin.trim().toUpperCase();
  await outvinStore.update(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key };
    if (!current.vehicle) return { value: undefined };
    const next = { ...current };
    delete next.vehicle;
    return { value: undefined, next };
  });
}

export async function claimOutvinHistoryPurchase(
  vin: string,
  historyType: number,
  now = Date.now(),
): Promise<VendorPurchaseClaim> {
  const key = vin.trim().toUpperCase();
  const slot = String(historyType);
  return outvinStore.update<VendorPurchaseClaim>(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key, history: { ...doc.history } };
    const decision = vendorPurchaseLockDecision(current.history[slot], now);
    if (decision === "replay" && current.history[slot]) {
      return { value: { action: "replay", entry: current.history[slot]! } };
    }
    if (decision === "in_progress") return { value: { action: "in_progress" } };
    current.history[slot] = newVendorPurchasePending(now);
    return { value: { action: "run" }, next: current };
  });
}

export async function completeOutvinHistoryPurchase(
  vin: string,
  historyType: number,
  entry: { ok: boolean; httpStatus?: number; payload?: unknown },
  now = Date.now(),
): Promise<void> {
  const key = vin.trim().toUpperCase();
  const slot = String(historyType);
  await outvinStore.update(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key, history: { ...doc.history } };
    current.history[slot] = newVendorPurchaseDone({ now, ...entry });
    return { value: undefined, next: current };
  });
}

export async function releaseOutvinHistoryPurchase(vin: string, historyType: number): Promise<void> {
  const key = vin.trim().toUpperCase();
  const slot = String(historyType);
  await outvinStore.update(key, (doc) => {
    const current = { ...emptyOutvinDoc(key), ...doc, vin: key, history: { ...doc.history } };
    const prev = current.history[slot];
    if (!prev || prev.status === "done") return { value: undefined };
    delete current.history[slot];
    return { value: undefined, next: current };
  });
}

export async function claimAutodnaReportPurchase(vin: string, now = Date.now()): Promise<VendorPurchaseClaim> {
  const key = vin.trim().toUpperCase();
  return autodnaStore.update<VendorPurchaseClaim>(key, (doc) => {
    const current = { ...emptyAutodnaDoc(key), ...doc, vin: key };
    const decision = vendorPurchaseLockDecision(current.report, now);
    if (decision === "replay" && current.report) return { value: { action: "replay", entry: current.report } };
    if (decision === "in_progress") return { value: { action: "in_progress" } };
    return { value: { action: "run" }, next: { ...current, report: newVendorPurchasePending(now) } };
  });
}

export async function completeAutodnaReportPurchase(
  vin: string,
  entry: { ok: boolean; httpStatus?: number; payload?: unknown },
  now = Date.now(),
): Promise<void> {
  const key = vin.trim().toUpperCase();
  await autodnaStore.update(key, (doc) => {
    const current = { ...emptyAutodnaDoc(key), ...doc, vin: key };
    return { value: undefined, next: { ...current, report: newVendorPurchaseDone({ now, ...entry }) } };
  });
}

export async function releaseAutodnaReportPurchase(vin: string): Promise<void> {
  const key = vin.trim().toUpperCase();
  await autodnaStore.update(key, (doc) => {
    const current = { ...emptyAutodnaDoc(key), ...doc, vin: key };
    if (!current.report || current.report.status === "done") return { value: undefined };
    const next = { ...current };
    delete next.report;
    return { value: undefined, next };
  });
}

/** Operators apzināti pasūta jaunu atskaiti (`force`). */
export async function resetAutodnaReportPurchase(vin: string): Promise<void> {
  const key = vin.trim().toUpperCase();
  await autodnaStore.update(key, (doc) => {
    const current = { ...emptyAutodnaDoc(key), ...doc, vin: key };
    if (!current.report) return { value: undefined };
    const next = { ...current };
    delete next.report;
    return { value: undefined, next };
  });
}
