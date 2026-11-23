/**
 * OneAuto dienas tēriņa uzraudzība (tikai brīdinājums, nekad nebloķē pasūtījumus).
 * Tīras funkcijas: dienas atslēga Rīgas laikā, sliekšņi un lēmums par vienu brīdinājumu dienā.
 */

export const ONEAUTO_DAILY_ALERT_EUR_DEFAULT = 30;
export const ONEAUTO_DAILY_MANUAL_ALERT_COUNT = 15;

export type OneautoDailySpendDoc = {
  day: string;
  cents: number;
  calls: number;
  manualCalls: number;
  alertedAt: string | null;
};

export function emptyOneautoDailySpendDoc(day = ""): OneautoDailySpendDoc {
  return { day, cents: 0, calls: 0, manualCalls: 0, alertedAt: null };
}

export function parseOneautoDailySpendDoc(raw: unknown): OneautoDailySpendDoc {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    day: typeof o.day === "string" ? o.day : "",
    cents: num(o.cents),
    calls: num(o.calls),
    manualCalls: num(o.manualCalls),
    alertedAt: typeof o.alertedAt === "string" ? o.alertedAt : null,
  };
}

/** YYYY-MM-DD Rīgas laikā. */
export function rigaDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Slieksnis eiro no env ONEAUTO_DAILY_ALERT_EUR (nederīga vērtība -> noklusējums 30 €). */
export function oneautoDailyAlertThresholdEur(raw = process.env.ONEAUTO_DAILY_ALERT_EUR): number {
  const n = Number(String(raw ?? "").replace(",", ".").trim());
  return raw != null && String(raw).trim() && Number.isFinite(n) && n > 0 ? n : ONEAUTO_DAILY_ALERT_EUR_DEFAULT;
}

/**
 * Pieskaita vienu izsaukumu. `alert` = true tikai pirmo reizi dienā, kad pārsniegts EUR slieksnis
 * vai manuālo pirkumu skaits > 15.
 */
export function addOneautoDailySpend(
  current: OneautoDailySpendDoc,
  add: { costCents: number; manual: boolean; day: string; nowIso: string; thresholdEur: number },
): { next: OneautoDailySpendDoc; alert: boolean } {
  const base = current.day === add.day ? current : emptyOneautoDailySpendDoc(add.day);
  const cents = Math.max(0, Math.floor(add.costCents));
  const next: OneautoDailySpendDoc = {
    ...base,
    day: add.day,
    cents: base.cents + cents,
    calls: base.calls + (cents > 0 ? 1 : 0),
    manualCalls: base.manualCalls + (add.manual && cents > 0 ? 1 : 0),
  };
  const over =
    next.cents > Math.round(add.thresholdEur * 100) || next.manualCalls > ONEAUTO_DAILY_MANUAL_ALERT_COUNT;
  const alert = over && !base.alertedAt;
  if (alert) next.alertedAt = add.nowIso;
  return { next, alert };
}

export function formatEurCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function oneautoDailySpendAlertText(doc: OneautoDailySpendDoc, thresholdEur: number): { title: string; body: string } {
  return {
    title: "OneAuto dienas tēriņš pārsniegts",
    body: `Šodien (${doc.day}) OneAuto izmaksas ${formatEurCents(doc.cents)} (slieksnis ${formatEurCents(
      Math.round(thresholdEur * 100),
    )}), maksas izsaukumi ${doc.calls}, no tiem manuāli ${doc.manualCalls}. Pasūtījumi netiek bloķēti - pārbaudi izmaksu sadaļā.`,
  };
}
