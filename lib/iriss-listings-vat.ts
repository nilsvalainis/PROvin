import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";
import type { ListingTaxKind } from "@/lib/iriss-listings-cost";

export const COUNTRY_VAT: Record<string, number> = {
  DE: 19,
  BE: 21,
  NL: 21,
  FR: 20,
  IT: 22,
  AT: 20,
  ES: 21,
  PL: 23,
  CZ: 21,
  DK: 25,
  SE: 25,
  LU: 17,
  PT: 23,
  LT: 21,
  LV: 21,
  EE: 24,
};

export type ListingTax = {
  kind: ListingTaxKind;
  rate: number | null;
  raw: string;
  rateFrom: string;
};

export type ListingTaxInput = {
  platform: IrissListingPlatform;
  vatNote?: string;
  salesVatType?: number | null;
  taxDeduction?: boolean | null;
  isMargin?: boolean | null;
  countryCode?: string;
  vatRate?: number | null;
};

function countryVat(code: string | undefined): number | null {
  if (!code) return null;
  const n = COUNTRY_VAT[code.trim().toUpperCase()];
  return n ?? null;
}

function autobidFromNote(note: string): ListingTax {
  const raw = `taxInformation: „${note}”`;
  if (/tax on difference|differenzbesteuer|§\s*25a|\bmargin\b/i.test(note)) return { kind: "margin", rate: null, raw, rateFrom: "" };
  const m = note.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (m && /includ|incl|inkl|mwst|vat/i.test(note)) {
    return { kind: "gross", rate: Number(m[1].replace(",", ".")), raw, rateFrom: "taxInformation teksts" };
  }
  if (/\bnet\b|\bnetto\b|reclaimable|ausweisbar|vat excluded/i.test(note)) return { kind: "net", rate: null, raw, rateFrom: "" };
  return { kind: "unknown", rate: null, raw, rateFrom: "" };
}

export function detectListingTax(input: ListingTaxInput): ListingTax {
  const note = (input.vatNote ?? "").trim();
  if (input.platform === "auto1") {
    const raw = [
      input.salesVatType != null ? `salesVatType: ${input.salesVatType}` : "",
      input.taxDeduction != null ? `taxDeduction: ${input.taxDeduction}` : "",
      input.vatRate != null ? `vatRate: ${input.vatRate}` : "",
      input.countryCode ? `countryCode: ${input.countryCode}` : "",
      note && !/salesVatType/i.test(note) ? note : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const typeFromNote = note.match(/105[34]/);
    const sales = input.salesVatType ?? (typeFromNote ? Number(typeFromNote[0]) : null);
    if (sales === 1053 || input.taxDeduction === false) return { kind: "margin", rate: null, raw: raw || note || "salesVatType 1053", rateFrom: "" };
    if (sales === 1054 || input.taxDeduction === true) {
      const rate = input.vatRate ?? countryVat(input.countryCode);
      if (rate == null) return { kind: "unknown", rate: null, raw: raw || "salesVatType 1054, likme nav", rateFrom: "" };
      return { kind: "gross", rate, raw: raw || `salesVatType 1054`, rateFrom: input.vatRate != null ? "v2 meta.finance.vatRate" : `valsts ${input.countryCode}` };
    }
    if (note) return autobidFromNote(note);
    return { kind: "unknown", rate: null, raw: raw || "Auto1 PVN lauks nav", rateFrom: "" };
  }
  if (input.platform === "openline") {
    if (input.isMargin === true || /^margin$/i.test(note)) return { kind: "margin", rate: null, raw: input.isMargin === true ? "IsMargin: true" : note, rateFrom: "" };
    if (input.isMargin === false || /vat excluded|excl/i.test(note)) return { kind: "net", rate: null, raw: input.isMargin === false ? "IsMargin: false" : note || "VAT excluded", rateFrom: "" };
    if (note) return autobidFromNote(note);
    return { kind: "unknown", rate: null, raw: "IsMargin nav", rateFrom: "" };
  }
  return autobidFromNote(note);
}

export function taxFromVehicle(v: Pick<IrissListingVehicle, "platform" | "vatNote" | "salesVatType" | "taxDeduction" | "isMargin" | "countryCode" | "vatRate">): ListingTax {
  return detectListingTax({
    platform: v.platform,
    vatNote: v.vatNote,
    salesVatType: v.salesVatType,
    taxDeduction: v.taxDeduction,
    isMargin: v.isMargin,
    countryCode: v.countryCode,
    vatRate: v.vatRate,
  });
}

export function listingTaxLabel(t: ListingTax): string {
  if (t.kind === "gross") return `AR PVN ${t.rate} %`;
  if (t.kind === "net") return "NETO";
  if (t.kind === "margin") return "MARŽA";
  return "PVN ?";
}

export function listingTaxResolved(
  v: Pick<IrissListingVehicle, "platform" | "vatNote" | "salesVatType" | "taxDeduction" | "isMargin" | "countryCode" | "vatRate">,
  ov?: { kind: ListingTaxKind; rate?: number | null } | null,
): ListingTax {
  const detected = taxFromVehicle(v);
  if (!ov) return detected;
  return {
    ...detected,
    kind: ov.kind,
    rate: ov.kind === "gross" ? ov.rate ?? detected.rate : detected.rate,
  };
}
