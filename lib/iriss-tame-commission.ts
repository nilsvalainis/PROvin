/**
 * Dzintarzeme Auto tāmes komisija. Noklusējums = līdzšinējie cietie skaitļi.
 * Saglabāšana: `lib/iriss-tame-commission-store.ts`.
 */

export const DEFAULT_IRISS_TAME_COMMISSION = {
  variantANet: 1190,
  variantBBaseNet: 990,
  variantBLoanPercent: 3.5,
} as const;

export type IrissTameCommissionRates = {
  /** A variants, EUR neto. */
  variantANet: number;
  /** B variants bāze, EUR neto. */
  variantBBaseNet: number;
  /** B variants: % no atlikuma pēc priekšapmaksas. */
  variantBLoanPercent: number;
};

export type IrissTameCommissionSettings = IrissTameCommissionRates & {
  updatedAt: string;
};

const MAX_MONEY = 1_000_000;

export function defaultIrissTameCommissionSettings(now = ""): IrissTameCommissionSettings {
  return {
    variantANet: DEFAULT_IRISS_TAME_COMMISSION.variantANet,
    variantBBaseNet: DEFAULT_IRISS_TAME_COMMISSION.variantBBaseNet,
    variantBLoanPercent: DEFAULT_IRISS_TAME_COMMISSION.variantBLoanPercent,
    updatedAt: now,
  };
}

function moneyOr(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_MONEY) return fallback;
  return Math.round(n * 100) / 100;
}

function percentOr(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return Math.round(n * 100) / 100;
}

export function parseIrissTameCommissionSettings(raw: unknown, now = ""): IrissTameCommissionSettings {
  const base = defaultIrissTameCommissionSettings(now);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt;
  return {
    variantANet: moneyOr(o.variantANet, base.variantANet),
    variantBBaseNet: moneyOr(o.variantBBaseNet, base.variantBBaseNet),
    variantBLoanPercent: percentOr(o.variantBLoanPercent, base.variantBLoanPercent),
    updatedAt,
  };
}

export function formatIrissTameMoney(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function formatIrissTamePercent(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded).replace(".", ",");
}
