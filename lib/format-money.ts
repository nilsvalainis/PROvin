export function formatMoneyEur(amountCents: number | null, currency: string | null): string {
  if (amountCents == null) return "—";
  const code = currency && currency.length === 3 ? currency.toUpperCase() : "EUR";
  try {
    return new Intl.NumberFormat("lv-LV", {
      style: "currency",
      currency: code,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} EUR`;
  }
}
