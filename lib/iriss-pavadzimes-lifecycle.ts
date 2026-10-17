import type { IrissPavadzimeLifecycle } from "@/lib/iriss-pavadzimes-types";

type LifecycleInput = {
  number: string;
  plate: string;
  issuedAt: string;
  validUntil: string;
};

export type WaybillLifecycleInfo = {
  lifecycle: IrissPavadzimeLifecycle;
  supersededBy?: string;
};

function ts(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Automātisks pavadzīmes statuss (bez manuālas atzīmēšanas):
 * - „pārtraukta”, ja tam pašam tirdzniecības nr. izdota jaunāka pavadzīme, pirms šīs termiņš beidzās
 *   (piem. P02787 B193-7 derīga līdz 14.10 15:59, bet P02788 B193-7 izdota 14.10 13:41);
 * - „beigusies”, ja termiņš pagājis;
 * - „derīga” citādi.
 */
export function computeWaybillLifecycles<T extends LifecycleInput>(rows: readonly T[], now = new Date()): Map<T, WaybillLifecycleInfo> {
  const nowMs = now.getTime();
  const byPlate = new Map<string, T[]>();
  for (const row of rows) {
    const plate = row.plate.trim().toUpperCase();
    if (!plate) continue;
    const list = byPlate.get(plate) ?? [];
    list.push(row);
    byPlate.set(plate, list);
  }

  const out = new Map<T, WaybillLifecycleInfo>();
  for (const row of rows) {
    const until = ts(row.validUntil);
    const issued = ts(row.issuedAt);
    const plate = row.plate.trim().toUpperCase();
    let next: T | undefined;
    if (plate && issued && until) {
      for (const other of byPlate.get(plate) ?? []) {
        if (other === row || other.number === row.number) continue;
        const oIssued = ts(other.issuedAt);
        if (!oIssued || oIssued <= issued || oIssued >= until) continue;
        if (!next || oIssued < ts(next.issuedAt)) next = other;
      }
    }
    if (next) {
      out.set(row, { lifecycle: "interrupted", supersededBy: next.number });
    } else if (!until) {
      out.set(row, { lifecycle: "unknown" });
    } else {
      out.set(row, { lifecycle: until < nowMs ? "expired" : "active" });
    }
  }
  return out;
}

/** Saraksts: jaunākās pavadzīmes augšā (pēc izdošanas laika, tad numura). */
export function sortWaybillsNewestFirst<T extends { issuedAt: string; validUntil: string; number: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ia = ts(a.issuedAt) || ts(a.validUntil);
    const ib = ts(b.issuedAt) || ts(b.validUntil);
    if (ia !== ib) return ib - ia;
    return b.number.localeCompare(a.number, "lv", { numeric: true });
  });
}

export function waybillLifecycleLabel(lifecycle: IrissPavadzimeLifecycle | undefined): string {
  if (lifecycle === "interrupted") return "Pārtraukta";
  if (lifecycle === "expired") return "Beigusies";
  if (lifecycle === "active") return "Derīga";
  return "";
}
