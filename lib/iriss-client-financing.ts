import { parsePriceLike } from "@/lib/iriss-price-format";

export const IRISS_CLIENT_FINANCING_PRESETS = [20, 50, 100] as const;

export function parseIrissClientFinancingPercent(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function irissClientFinancingEuroFromBudget(totalBudget: string, percent: number): number {
  if (percent <= 0) return 0;
  const base = parsePriceLike(totalBudget);
  if (!Number.isFinite(base) || base <= 0) return 0;
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
