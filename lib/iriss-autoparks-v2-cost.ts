/**
 * Pašizmaksa (tikai Iegādes dokumentos, Iegāde + Summas): iepirkuma cena + transports + servisa rēķini + citi izdevumi.
 * Servisa rēķini - apstiprinātā summa AR PVN (20:17). Rēķins bez summas skaitās 0 un "bez summas",
 * lai redzams, ka kopsumma nav pilna. AI ieteikums bez apstiprinājuma netiek skaitīts.
 */
import type { V2Expense, V2Invoice } from "@/lib/iriss-autoparks-v2";

export type AutoparksV2Cost = {
  purchaseEur: number | null;
  transportEur: number | null;
  service: { sumEur: number; count: number; withoutAmount: number };
  otherEur: number;
  totalEur: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function autoparksV2Cost(input: {
  purchaseEur: number | null;
  transportEur: number | null;
  invoices: readonly Pick<V2Invoice, "amountEur">[];
  expenses: readonly Pick<V2Expense, "amountEur">[];
}): AutoparksV2Cost {
  let service = 0;
  let without = 0;
  for (const inv of input.invoices) {
    if (inv.amountEur == null || !Number.isFinite(inv.amountEur)) without += 1;
    else service += inv.amountEur;
  }
  let other = 0;
  for (const e of input.expenses) if (e.amountEur != null && Number.isFinite(e.amountEur)) other += e.amountEur;
  const total = (input.purchaseEur ?? 0) + (input.transportEur ?? 0) + service + other;
  return {
    purchaseEur: input.purchaseEur,
    transportEur: input.transportEur,
    service: { sumEur: cents(service), count: input.invoices.length, withoutAmount: without },
    otherEur: cents(other),
    totalEur: cents(total),
  };
}
