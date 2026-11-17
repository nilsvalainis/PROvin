import { parseIrissOrderBudget } from "@/lib/iriss-listings-orders";

export const IRISS_CLIENT_FINANCING_PRESETS = [20, 50, 100] as const;

export function parseIrissClientFinancingPercent(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function irissClientFinancingEuroFromBudget(totalBudget: string, percent: number): number {
  if (percent <= 0) return 0;
  const base = parseIrissOrderBudget(totalBudget);
  if (base == null || base <= 0) return 0;
  return Math.round(base * (percent / 100));
}

export function formatIrissClientFinancingChip(totalBudget: string, percent: number): string {
  const euro = irissClientFinancingEuroFromBudget(totalBudget, percent);
  if (euro <= 0) return `${percent} %`;
  return `${percent} % · ${euro.toLocaleString("lv-LV")} €`;
}

/** Sinhronizē vecos checkbox laukus ar procentu. */
export function irissClientFinancingPatchFromPercent(percent: number): {
  clientFinancingPercent: number;
  dealClientFinancing20: boolean;
  dealClientFinancing100: boolean;
} {
  const p = parseIrissClientFinancingPercent(percent);
  return {
    clientFinancingPercent: p,
    dealClientFinancing20: p === 20,
    dealClientFinancing100: p === 100,
  };
}

/**
 * Faktiskais finansējuma % (QA 29.10): vecajiem pasūtījumiem procents ir 0, bet ieķeksēts vecais
 * «Klienta finansējums 100 % / 20 %» - tad to ņem no ķeksīša, lai izvēle un kopsavilkums sakrīt ar galveni.
 */
export function irissEffectiveClientFinancingPercent(rec: {
  clientFinancingPercent?: unknown;
  dealClientFinancing100?: boolean;
  dealClientFinancing20?: boolean;
}): number {
  const p = parseIrissClientFinancingPercent(rec.clientFinancingPercent);
  if (p > 0) return p;
  if (rec.dealClientFinancing100) return 100;
  if (rec.dealClientFinancing20) return 20;
  return 0;
}
