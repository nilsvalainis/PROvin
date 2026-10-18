import { formatB2bWalletEuro, type B2bWallet, type B2bWalletProductId } from "@/lib/b2b-wallet";

export type B2bAdminStatKey = {
  month: string;
  partnerId: string;
  product: B2bWalletProductId;
};

export type B2bAdminStatRow = B2bAdminStatKey & {
  companyName: string;
  orderCount: number;
  refundCount: number;
  revenueCents: number;
  noDataRate: number;
};

function rigaMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  return y && m ? `${y}-${m}` : "";
}

function keyOf(month: string, partnerId: string, product: B2bWalletProductId): string {
  return `${month}|${partnerId}|${product}`;
}

export function accumulateB2bWalletStats(
  partners: readonly { id: string; companyName: string; wallet: B2bWallet }[],
): B2bAdminStatRow[] {
  const map = new Map<string, B2bAdminStatRow>();
  for (const partner of partners) {
    for (const txn of partner.wallet.txns) {
      if (!txn.product) continue;
      const month = rigaMonth(txn.at);
      if (!month) continue;
      const id = keyOf(month, partner.id, txn.product);
      const current = map.get(id) ?? {
        month,
        partnerId: partner.id,
        product: txn.product,
        companyName: partner.companyName,
        orderCount: 0,
        refundCount: 0,
        revenueCents: 0,
        noDataRate: 0,
      };
      if (txn.kind === "purchase") {
        current.orderCount += 1;
        current.revenueCents += Math.abs(txn.amountCents);
      } else if (txn.kind === "refund") {
        current.refundCount += 1;
        current.revenueCents -= Math.abs(txn.amountCents);
      }
      map.set(id, current);
    }
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      noDataRate: row.orderCount > 0 ? row.refundCount / row.orderCount : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.companyName.localeCompare(b.companyName, "lv") || a.product.localeCompare(b.product));
}

export function formatB2bAdminNoDataRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatB2bAdminRevenue(cents: number): string {
  return formatB2bWalletEuro(cents);
}

export const B2B_ADMIN_STAT_PRODUCT_LABEL: Record<B2bWalletProductId, string> = {
  business: "Business",
  dealer_raw: "Dīlera dati RAW",
  dealer_pro: "Dīlera dati PRO",
};
