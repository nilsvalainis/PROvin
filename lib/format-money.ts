export function formatMoneyEur(amountCents: number | null | undefined, currency: string | null | undefined): string {
  if (amountCents == null || typeof amountCents !== "number" || !Number.isFinite(amountCents)) return "—";
  const euros = amountCents / 100;
  if (!Number.isFinite(euros)) return "—";
  const code = typeof currency === "string" && currency.length === 3 ? currency.toUpperCase() : "EUR";
  try {
    return new Intl.NumberFormat("lv-LV", {
      style: "currency",
      currency: code,
    }).format(euros);
  } catch {
    return `${euros.toFixed(2)} EUR`;
  }
}
