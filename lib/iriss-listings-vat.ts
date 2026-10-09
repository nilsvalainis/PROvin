/**
 * PVN režīma noteikšana visām LIST platformām (Auto1, Openlane, Autobid).
 * Gala cena rēķinās no `kind` + `rate`. Detekcijas izmaiņas paliek šajā failā.
 */
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

function noteSuggestsMargin(note: string): boolean {
  return /tax on difference|differenzbesteuer|§\s*25a|\bmargin\b|марж/i.test(note);
}

/** EN VAT excluded / DE zzgl. MwSt / RU Без НДС. Pārbaudīt pirms included, jo "без НДС" nav "с НДС". */
function noteSuggestsExcluded(note: string): boolean {
  return /vat excluded|excl(?:uded|\.|\s)|zzgl\.?\s*mwst|ohne\s*(?:mwst|ust)|без\s*ндс|\bnet\b|\bnetto\b|reclaimable|ausweisbar/i.test(note);
}

function noteSuggestsIncluded(note: string): boolean {
  if (noteSuggestsExcluded(note)) return false;
  return /vat included|including\s+\d|incl(?:uded|\.|\s)|inkl\.?\s*mwst|mit\s*mwst|с\s*ндс/i.test(note);
}

function rateFromNoteOrCountry(note: string, country?: string, vatRate?: number | null): { rate: number | null; rateFrom: string } {
  if (vatRate != null && Number.isFinite(vatRate) && vatRate > 0) return { rate: vatRate, rateFrom: "vatRate" };
  const m = note.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (m) return { rate: Number(m[1].replace(",", ".")), rateFrom: "teksts" };
  const cr = countryVat(country);
  if (cr != null) return { rate: cr, rateFrom: country ? `valsts ${country}` : "" };
  return { rate: null, rateFrom: "" };
}

function autobidFromNote(note: string): ListingTax {
  const raw = `taxInformation: „${note}”`;
  if (noteSuggestsMargin(note)) return { kind: "margin", rate: null, raw, rateFrom: "" };
  const m = note.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (m && (noteSuggestsIncluded(note) || /includ|incl|inkl|mwst|vat/i.test(note))) {
    return { kind: "gross", rate: Number(m[1].replace(",", ".")), raw, rateFrom: "taxInformation teksts" };
  }
  if (noteSuggestsExcluded(note)) return { kind: "net", rate: null, raw, rateFrom: "" };
  if (noteSuggestsIncluded(note)) {
    const pct = m ? Number(m[1].replace(",", ".")) : null;
    if (pct != null) return { kind: "gross", rate: pct, raw, rateFrom: "taxInformation teksts" };
  }
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
    const raw = [
      input.isMargin === true ? "IsMargin: true" : input.isMargin === false ? "IsMargin: false" : "",
      note,
      input.countryCode ? `countryCode: ${input.countryCode}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (input.isMargin === true || noteSuggestsMargin(note)) {
      return { kind: "margin", rate: null, raw: raw || "IsMargin: true", rateFrom: "" };
    }
    if (noteSuggestsIncluded(note)) {
      const { rate, rateFrom } = rateFromNoteOrCountry(note, input.countryCode, input.vatRate);
      if (rate == null) {
        if (input.isMargin === false) return { kind: "gross", rate: null, raw: raw || note, rateFrom: "" };
        return { kind: "unknown", rate: null, raw: raw || note, rateFrom: "" };
      }
      return { kind: "gross", rate, raw: raw || note, rateFrom };
    }
    if (noteSuggestsExcluded(note) || input.isMargin === false) {
      return { kind: "net", rate: null, raw: raw || note || "VAT excluded", rateFrom: "" };
    }
    if (note) return autobidFromNote(note);
    return { kind: "unknown", rate: null, raw: raw || "IsMargin nav", rateFrom: "" };
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
  if (t.kind === "margin") return "Margin";
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
