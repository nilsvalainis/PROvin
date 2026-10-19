/**
 * B2B maka papildināšanas rēķins.
 * PDF/HTML: PROVIN zīmols (bez .LV), zilā tēma, bez PVN numura un piezīmēm.
 * E-pasts: PROVIN, zils #0061D2.
 */

import { B2B_CLIENT_BRAND } from "@/lib/b2b-pdf-brand";
import { getCompanyLegal } from "@/lib/company";
import { invoiceBuyerLines, normalizeInvoiceBuyer } from "@/lib/invoice-buyer";
import { formatMoneyEur } from "@/lib/format-money";
import type { InvoiceOrderPayload } from "@/lib/generate-invoice-html";

/** E-pasta From vārds paliek atsevišķi; rēķina PDF zīmols. */
export const B2B_TOPUP_INVOICE_PDF_BRAND = B2B_CLIENT_BRAND;

export function formatIrsInvoiceNumber(year: number, seq: number): string {
  return `IRS-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseIrsInvoiceSequence(invoiceNumber: string, year: number): number | null {
  const m = /^IRS-(\d{4})-(\d{4})$/.exec(invoiceNumber.trim());
  if (!m) return null;
  if (Number.parseInt(m[1], 10) !== year) return null;
  const seq = Number.parseInt(m[2], 10);
  return Number.isFinite(seq) ? seq : null;
}

export function fallbackB2bTopupInvoiceNumber(sessionId: string, created: number): string {
  const year = new Date(created * 1000).getFullYear();
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return formatIrsInvoiceNumber(year, (h >>> 0) % 10000);
}

export const B2B_TOPUP_INVOICE = {
  serviceLine: "Konta papildināšana",
  email: {
    subject: "PROVIN: rēķins par konta papildināšanu {{summa}}",
    body: [
      "Sveiki!",
      "",
      "Konta papildināšana {{summa}} ir saņemta.",
      "Jaunais atlikums: {{atlikums}}.",
      "Rēķina Nr.: {{rekins}}.",
      "",
      "Rēķina PDF ir pievienots šim e-pastam.",
      "",
      "Ar cieņu,",
      "PROVIN",
    ].join("\n"),
  },
} as const;

export type B2bTopupInvoiceSeller = {
  legalName: string;
  regNo: string;
  address: string;
  bank?: string;
};

export function getB2bTopupInvoiceSeller(): B2bTopupInvoiceSeller {
  const legal = getCompanyLegal();
  const bank = process.env.B2B_INVOICE_SELLER_BANK?.trim() || "";
  return {
    legalName: process.env.B2B_INVOICE_SELLER_NAME?.trim() || legal.legalName,
    regNo: process.env.B2B_INVOICE_SELLER_REG?.trim() || legal.regNo,
    address: process.env.B2B_INVOICE_SELLER_ADDRESS?.trim() || legal.legalAddress,
    ...(bank ? { bank } : {}),
  };
}

/** Rēķina „Pakalpojuma sniedzējs” bloka rindas (bez zīmola, to rāda logotips). */
export function b2bTopupInvoiceSellerLines(seller = getB2bTopupInvoiceSeller()): string[] {
  return [
    seller.legalName || "-",
    seller.regNo ? `Reg.nr. ${seller.regNo}` : null,
    seller.address || null,
    seller.bank || null,
  ].filter((line): line is string => Boolean(line));
}

/** Adrese / banka zem vienas sniedzēja rindas (vārds un Reg.nr. jau ir provider line). */
export function b2bTopupInvoiceSellerExtraLines(seller = getB2bTopupInvoiceSeller()): string[] {
  return [seller.address || null, seller.bank || null].filter((line): line is string => Boolean(line));
}

/**
 * Viena rinda zem virsraksta „Pakalpojuma sniedzējs”, piem.:
 * "Nils Valainis, Reg.nr. 09118711109"
 */
export function b2bTopupInvoiceProviderLine(seller = getB2bTopupInvoiceSeller()): string {
  const parts = [seller.legalName || "-", seller.regNo ? `Reg.nr. ${seller.regNo}` : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(", ");
}

export type B2bTopupInvoiceEmailVars = {
  summa: string;
  atlikums: string;
  rekins: string;
  uznemums: string;
};

export function fillB2bTopupInvoiceEmailTemplate(template: string, vars: B2bTopupInvoiceEmailVars): string {
  return template
    .replaceAll("{{summa}}", vars.summa)
    .replaceAll("{{atlikums}}", vars.atlikums)
    .replaceAll("{{rekins}}", vars.rekins)
    .replaceAll("{{uznemums}}", vars.uznemums);
}

export function renderB2bTopupInvoiceEmail(vars: B2bTopupInvoiceEmailVars): { subject: string; text: string } {
  return {
    subject: fillB2bTopupInvoiceEmailTemplate(B2B_TOPUP_INVOICE.email.subject, vars),
    text: fillB2bTopupInvoiceEmailTemplate(B2B_TOPUP_INVOICE.email.body, vars),
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML rēķins testiem un priekšskatījumam. PDF lieto to pašu saturu. */
export function buildB2bTopupInvoiceHtml(order: InvoiceOrderPayload): string {
  const seller = getB2bTopupInvoiceSeller();
  const extraLines = b2bTopupInvoiceSellerExtraLines(seller);
  const providerLine = b2bTopupInvoiceProviderLine(seller);
  const buyer = normalizeInvoiceBuyer({
    companyName: order.companyName,
    companyReg: order.companyReg,
    companyAddress: order.companyAddress,
    contactName: order.customerName,
    email: order.customerEmail ?? order.customerDetailsEmail,
    phone: order.customerPhone,
  });
  const buyerLines = invoiceBuyerLines(buyer);
  const money = formatMoneyEur(order.amountTotal, order.currency);
  const invoiceDate = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(order.created * 1000));

  return `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="utf-8"/>
<title>Rēķins ${esc(order.invoiceNumber)} - ${esc(B2B_TOPUP_INVOICE_PDF_BRAND)}</title>
</head>
<body style="font-family:Inter,sans-serif">
<p style="font-size:24px;font-weight:800;margin:0"><span style="color:#000">PRO</span><span style="color:#0061D2">VIN</span></p>
<p>Rēķins</p>
<p>Rēķina Nr.: ${esc(order.invoiceNumber)}</p>
<p>Datums: ${esc(invoiceDate)}</p>
<h2>Pakalpojuma sniedzējs</h2>
<p>${esc(providerLine)}</p>
${extraLines.map((line) => `<p>${esc(line)}</p>`).join("")}
<h2>Klients</h2>
${buyerLines.length ? buyerLines.map((line) => `<p>${esc(line)}</p>`).join("") : "<p>-</p>"}
<table>
<tr><th>Apraksts</th><th>Daudz.</th><th>Summa</th></tr>
<tr><td>${esc(B2B_TOPUP_INVOICE.serviceLine)}</td><td>1</td><td>${esc(money)}</td></tr>
</table>
<p>Kopā ${esc(money)}</p>
</body>
</html>`;
}
