/**
 * Klienta „atskaite gatava” e-pasti: dīleris / MINI / AUDITS.
 * Tīri stringi - der HTML veidnei un testiem.
 */
import {
  isDealerHighlightAdminOrder,
  isMiniHighlightAdminOrder,
} from "@/lib/admin-customer-identity";
import { isDealerDataAutoFetchOrder } from "@/lib/dealer-data-job-types";

export const REPORT_READY_AUDIT_CTA_URL = "https://provin.lv";
export const REPORT_READY_AUDIT_PRICE_WAS = "99,99 €";
export const REPORT_READY_AUDIT_PRICE_NOW = "79,99 €";

export type ReportReadyProductKind = "dealer" | "mini" | "audits";

export function resolveReportReadyProductKind(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
}): ReportReadyProductKind {
  if (isDealerDataAutoFetchOrder(args) || isDealerHighlightAdminOrder(args)) return "dealer";
  if (isMiniHighlightAdminOrder(args)) return "mini";
  return "audits";
}

function vinPhrase(vin: string): string {
  return vin ? ` transportlīdzeklim ar VIN ${vin}` : "";
}

export function buildReportReadySubject(kind: ReportReadyProductKind, vin: string): string {
  if (kind === "dealer") {
    return vin ? `PROVIN servisa vēstures atskaite (${vin})` : "PROVIN servisa vēstures atskaite";
  }
  if (kind === "mini") {
    return vin ? `PROVIN MINI atskaite (${vin})` : "PROVIN MINI atskaite";
  }
  return vin ? `PROVIN AUDITS atskaite (${vin})` : "PROVIN AUDITS atskaite";
}

export function dealerAuditDiscountPlainBlock(): string {
  return [
    "Plānojat iegādāties šo auto?",
    "Veiciet pilnu pārbaudi pirms pirkuma! Piedāvājam PROVIN AUDITS pakalpojumu ar 20% atlaidi:",
    "",
    "- Padziļināta auto vēstures un risku analīze",
    "- Odometra rādījumu atbilstības pārbaude",
    "- Negadījumu un bojājumu vēsture",
    "",
    `Cena: ${REPORT_READY_AUDIT_PRICE_WAS} → ${REPORT_READY_AUDIT_PRICE_NOW}`,
    "",
    `Pasūtīt PROVIN AUDITS par ${REPORT_READY_AUDIT_PRICE_NOW}: ${REPORT_READY_AUDIT_CTA_URL}`,
  ].join("\n");
}

export function buildReportReadyPlainText(opts: {
  kind: ReportReadyProductKind;
  vin: string;
  attachmentLines: string[];
  offerAuditDiscount?: boolean;
}): string {
  const vin = opts.vin.trim();
  const files = opts.attachmentLines.filter((n) => n.trim());

  if (opts.kind === "dealer") {
    const parts = [
      "Labdien!",
      "",
      `Jūsu pieprasītie oficiālā dīlera servisa vēstures dati${vinPhrase(vin)} ir sagatavoti.`,
      "",
      "Pielikumā atradīsiet šādus dokumentus:",
    ];
    if (files.length > 0) {
      parts.push("", ...files.map((n) => `- ${n}`));
    }
    if (opts.offerAuditDiscount) {
      parts.push("", dealerAuditDiscountPlainBlock());
    }
    parts.push(
      "",
      "Ja Jums rodas papildu jautājumi, droši rakstiet mums uz info@provin.lv.",
      "",
      "Ar cieņu,",
      "PROVIN.LV komanda",
    );
    return parts.join("\n");
  }

  if (opts.kind === "mini") {
    return [
      "Labdien!",
      "",
      `Jūsu pasūtītā PROVIN MINI atskaite${vinPhrase(vin)} ir sagatavota un pievienota šī e-pasta pielikumā.`,
      "",
      "Ja Jums rodas kādi jautājumi, droši rakstiet mums uz info@provin.lv, labprāt palīdzēsim!",
      "",
      "Ar cieņu,",
      "PROVIN.LV komanda",
    ].join("\n");
  }

  return [
    "Labdien!",
    "",
    `Jūsu pasūtītā PROVIN AUDITS atskaite${vinPhrase(vin)} ir sagatavota.`,
    "",
    "E-pasta pielikumā atradīsiet:",
    "",
    "- Kopsavilkuma PDF atskaiti",
    "- Papildu materiālus un pielikumus",
    "",
    "Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet mums uz info@provin.lv, labprāt palīdzēsim!",
    "",
    "Ar cieņu,",
    "PROVIN.LV komanda",
  ].join("\n");
}
