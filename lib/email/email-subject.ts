/**
 * Viens e-pastu tēmas formāts (Nils 06.11 „jā”): „PROVIN · <notikums> · <produkts> · <VIN>”.
 * Produkts un VIN - tikai, ja ir; VIN tikai derīgs 17 zīmju.
 */
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const EMAIL_SUBJECT_SEPARATOR = " · ";

export function provinEmailSubject(event: string, opts?: { product?: string | null; vin?: string | null }): string {
  const parts = ["PROVIN", event.trim()];
  const product = (opts?.product ?? "").trim();
  if (product) parts.push(product);
  const rawVin = (opts?.vin ?? "").trim();
  const vin = isValidVin(rawVin) ? normalizeVin(rawVin) : "";
  if (vin) parts.push(vin);
  return parts.join(EMAIL_SUBJECT_SEPARATOR);
}

/** Summa e-pastam: „24.99” / 2499 centi → „24,99 €”. */
export function formatEmailAmountEur(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "-";
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount).replace(",", "."));
  if (!Number.isFinite(n)) return String(amount);
  const cents = Math.round(n * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${whole},${String(abs % 100).padStart(2, "0")} €`;
}
