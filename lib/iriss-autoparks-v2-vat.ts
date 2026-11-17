/**
 * PVN režīms no izsoles rēķina teksta ar esošo noteicēju (`lib/iriss-listings-vat.ts`, teksta kārta):
 * "§25a / Differenzbesteuerung / margin" -> margin, "inkl. 19 % MwSt" -> PVN, "zzgl. MwSt / excl. VAT / netto" -> neto.
 * Pieņem tikai, ja teksts tiešām atpazīts (nevis noklusējums) - citādi tukšs un Nils izvēlas pats.
 */
import { detectListingTax } from "@/lib/iriss-listings-vat";
import type { V2VatMode } from "@/lib/iriss-autoparks-v2";

export function vatModeFromInvoiceText(text: string): V2VatMode {
  const note = text.replace(/\s+/g, " ").trim().slice(0, 20_000);
  if (!note) return "";
  const t = detectListingTax({ platform: "autobid", vatNote: note });
  if (t.basis !== "text") return "";
  return t.kind === "gross" ? "gross" : t.kind === "net" ? "net" : "margin";
}
