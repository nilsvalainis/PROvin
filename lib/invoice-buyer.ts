/** Pircēja rekvizīti rēķinā (B2B uzņēmums vai B2C persona). */

export type InvoiceBuyerFields = {
  companyName: string | null;
  companyReg: string | null;
  companyAddress: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
};

const COMPANY_NAME_MAX = 200;
const COMPANY_REG_MAX = 32;
const COMPANY_ADDRESS_MAX = 300;

function clip(value: string | null | undefined, max: number): string | null {
  const t = value?.trim() ?? "";
  if (!t) return null;
  return t.slice(0, max);
}

export function normalizeInvoiceBuyer(input: {
  companyName?: string | null;
  companyReg?: string | null;
  companyAddress?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
}): InvoiceBuyerFields {
  return {
    companyName: clip(input.companyName, COMPANY_NAME_MAX),
    companyReg: clip(input.companyReg, COMPANY_REG_MAX),
    companyAddress: clip(input.companyAddress, COMPANY_ADDRESS_MAX),
    contactName: clip(input.contactName, COMPANY_NAME_MAX),
    email: clip(input.email, 254),
    phone: clip(input.phone, 40),
  };
}

/** Stripe Checkout `metadata` atslēgas pircēja rekvizītiem. */
export function invoiceBuyerMetadataFromUnknown(raw: {
  companyName?: unknown;
  companyReg?: unknown;
  companyAddress?: unknown;
}): Record<string, string> {
  return invoiceBuyerMetadata({
    companyName: typeof raw.companyName === "string" ? raw.companyName : null,
    companyReg: typeof raw.companyReg === "string" ? raw.companyReg : null,
    companyAddress: typeof raw.companyAddress === "string" ? raw.companyAddress : null,
  });
}

export function invoiceBuyerMetadata(input: {
  companyName?: string | null;
  companyReg?: string | null;
  companyAddress?: string | null;
}): Record<string, string> {
  const buyer = normalizeInvoiceBuyer(input);
  const out: Record<string, string> = {};
  if (buyer.companyName) out.company_name = buyer.companyName;
  if (buyer.companyReg) out.company_reg = buyer.companyReg;
  if (buyer.companyAddress) out.company_address = buyer.companyAddress;
  return out;
}

export function invoiceBuyerLines(buyer: InvoiceBuyerFields): string[] {
  const lines: string[] = [];
  if (buyer.companyName) lines.push(buyer.companyName);
  if (buyer.companyReg) lines.push(`Reģ. nr.: ${buyer.companyReg}`);
  if (buyer.companyAddress) lines.push(buyer.companyAddress);
  if (buyer.contactName && buyer.contactName !== buyer.companyName) {
    lines.push(buyer.contactName);
  }
  if (buyer.email) lines.push(buyer.email);
  if (buyer.phone) lines.push(buyer.phone);
  return lines;
}
