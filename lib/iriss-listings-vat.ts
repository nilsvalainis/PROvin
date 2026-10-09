/**
 * PVN režīma noteikšana visām LIST platformām (Auto1, Openlane, Autobid).
 *
 * Šis fails ir vienīgā vieta, kur mainīt detekciju. UI un gala cena
 * (`listingFinalPrice`) ņem `kind` + `rate`. Spec: 2026-10-09, fixtures
 * `lib/__fixtures__/iriss-vat/`.
 */
import { listingFinalPrice, listingRealCost, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import type { IrissListingPlatform, IrissListingVehicle } from "@/lib/iriss-listings-types";

/** ES-27 standarta PVN likmes. Pēdējā pārbaude: 2026-10-09 (EE 24, FI 25.5). */
export const EU_VAT: Record<string, number> = {
  AT: 20,
  BE: 21,
  BG: 20,
  HR: 25,
  CY: 19,
  CZ: 21,
  DK: 25,
  EE: 24,
  FI: 25.5,
  FR: 20,
  DE: 19,
  GR: 24,
  HU: 27,
  IE: 23,
  IT: 22,
  LV: 21,
  LT: 21,
  LU: 17,
  MT: 18,
  NL: 21,
  PL: 23,
  PT: 23,
  RO: 21,
  SK: 23,
  SI: 22,
  ES: 21,
  SE: 25,
};

export const COUNTRY_VAT = EU_VAT;

export type ListingTaxBasis = "field" | "text" | "default_silent" | "default_unrecognised" | "default_missing_fields";
export type ListingTaxFlag = "stale" | "unrecognised_text" | "missing_fields" | "rate_missing" | "conflict";

export type ListingTax = {
  kind: ListingTaxKind;
  rate: number | null;
  basis: ListingTaxBasis;
  flag: ListingTaxFlag | null;
  raw: string;
  rateFrom: string;
  manual?: boolean;
};

export type ListingTaxInput = {
  platform: IrissListingPlatform;
  vatNote?: string;
  salesVatType?: number | null;
  taxDeduction?: boolean | null;
  isMargin?: boolean | null;
  countryCode?: string;
  sourceCountry?: string;
  owningCountry?: string;
  vatRate?: number | null;
  lastSeenAt?: string;
};

export type ListingVatHealth = {
  total: number;
  net: number;
  margin: number;
  gross: number;
  defaultSilent: number;
  defaultUnrecognised: number;
  missingFields: number;
  stale: number;
  rateMissing: number;
  conflict: number;
  unrecognisedTexts: Array<{ text: string; count: number }>;
  level: "ok" | "amber" | "red";
  reason: string;
};

export type ListingVatHealthMap = Record<IrissListingPlatform, ListingVatHealth>;

function countryVat(code: string | undefined): number | null {
  if (!code) return null;
  const n = EU_VAT[code.trim().toUpperCase()];
  return n ?? null;
}

function sellerCountry(input: ListingTaxInput): string {
  return (input.sourceCountry || input.owningCountry || input.countryCode || "").trim();
}

function joinRaw(parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && String(p).trim())).join(" · ");
}

function tax(partial: Omit<ListingTax, "basis" | "flag"> & { basis?: ListingTaxBasis; flag?: ListingTaxFlag | null }): ListingTax {
  return {
    kind: partial.kind,
    rate: partial.rate,
    basis: partial.basis ?? "field",
    flag: partial.flag ?? null,
    raw: partial.raw,
    rateFrom: partial.rateFrom,
  };
}

function auto1GrossRate(input: ListingTaxInput): { rate: number | null; rateFrom: string; flag: ListingTaxFlag | null } {
  if (input.vatRate != null && Number.isFinite(input.vatRate) && input.vatRate > 0) {
    return { rate: input.vatRate, rateFrom: "meta.finance.vatRate", flag: null };
  }
  const code = sellerCountry(input);
  const cr = countryVat(code);
  if (cr != null) return { rate: cr, rateFrom: `ES tabula ${code.toUpperCase()}`, flag: null };
  return { rate: null, rateFrom: "", flag: "rate_missing" };
}

function detectAuto1Tax(input: ListingTaxInput): ListingTax {
  const note = (input.vatNote ?? "").trim();
  const raw = joinRaw([
    input.salesVatType != null ? `salesVatType: ${input.salesVatType}` : "",
    input.taxDeduction != null ? `taxDeduction: ${input.taxDeduction}` : "",
    input.vatRate != null ? `vatRate: ${input.vatRate}` : "",
    input.sourceCountry ? `sourceCountry: ${input.sourceCountry}` : "",
    input.owningCountry ? `owningCountry: ${input.owningCountry}` : "",
    input.countryCode ? `countryCode: ${input.countryCode}` : "",
    note && !/salesVatType/i.test(note) ? note : "",
  ]);
  const deduction = input.taxDeduction;
  const sales = input.salesVatType;
  const deductionPresent = typeof deduction === "boolean";
  const salesKnown = sales === 1053 || sales === 1054;
  const conflict =
    deductionPresent && salesKnown && ((sales === 1054 && deduction === false) || (sales === 1053 && deduction === true));

  let kind: ListingTaxKind | null = null;
  let basis: ListingTaxBasis = "field";
  let flag: ListingTaxFlag | null = conflict ? "conflict" : null;

  if (deductionPresent) {
    kind = deduction ? "gross" : "margin";
  } else if (sales === 1054) {
    kind = "gross";
  } else if (sales === 1053) {
    kind = "margin";
  } else if (sales != null) {
    kind = "margin";
    basis = "default_unrecognised";
    flag = "unrecognised_text";
  } else {
    kind = "margin";
    basis = "default_missing_fields";
    flag = input.lastSeenAt ? "stale" : "missing_fields";
  }

  if (kind === "gross") {
    const g = auto1GrossRate(input);
    return tax({
      kind: "gross",
      rate: g.rate,
      basis,
      flag: flag ?? g.flag,
      raw: raw || "salesVatType 1054",
      rateFrom: g.rateFrom,
    });
  }
  return tax({
    kind: "margin",
    rate: null,
    basis,
    flag,
    raw: raw || (flag === "stale" ? `PVN nav nolasīts (vecs ieraksts, meklējums nav pārlasīts kopš ${input.lastSeenAt})` : "Auto1 PVN lauks nav"),
    rateFrom: "",
  });
}

function detectOpenlaneTax(input: ListingTaxInput): ListingTax {
  const note = (input.vatNote ?? "").trim();
  const raw = joinRaw([
    input.isMargin === true ? "IsMargin: true" : input.isMargin === false ? "IsMargin: false" : "IsMargin nav",
    note,
    input.countryCode ? `countryCode: ${input.countryCode}` : "",
  ]);
  if (input.isMargin === true) {
    return tax({ kind: "margin", rate: null, basis: "field", raw: raw || "IsMargin: true", rateFrom: "" });
  }
  if (input.isMargin === false) {
    return tax({ kind: "net", rate: null, basis: "field", raw: raw || "IsMargin: false", rateFrom: "" });
  }
  return tax({
    kind: "margin",
    rate: null,
    basis: "default_missing_fields",
    flag: input.lastSeenAt ? "stale" : "missing_fields",
    raw: raw || "IsMargin nav",
    rateFrom: "",
  });
}

const AUTOBID_GROSS_RE = /(?:including|inklusive|inkl\.?|iesk\.?|ieskaitot)\s*(\d{1,2}(?:[.,]\d+)?)\s*%\s*(?:vat|mwst|ust|pvn)/iu;
const AUTOBID_MARGIN_RE = /tax on difference|differenzbesteuer|diferenc[eē]t|§\s*25a|margin|marž/iu;
const AUTOBID_NET_EXACT_RE = /^(?:net|netto|neto)$/iu;
const AUTOBID_NET_RE = /zzgl\.?\s*\d*\s*%?\s*mwst|plus\s*\d*\s*%?\s*vat|excl\w*\.?\s*vat|bez\s*pvn/iu;

function detectAutobidTax(input: ListingTaxInput): ListingTax {
  const note = (input.vatNote ?? "").trim();
  const raw = `taxInformation: „${note}”`;
  if (!note) {
    return tax({ kind: "margin", rate: null, basis: "default_silent", raw, rateFrom: "" });
  }
  const gross = note.match(AUTOBID_GROSS_RE);
  if (gross) {
    const rate = Number(gross[1]!.replace(",", "."));
    return tax({ kind: "gross", rate, basis: "text", raw, rateFrom: "taxInformation teksts" });
  }
  if (AUTOBID_MARGIN_RE.test(note)) {
    return tax({ kind: "margin", rate: null, basis: "text", raw, rateFrom: "" });
  }
  if (AUTOBID_NET_EXACT_RE.test(note) || AUTOBID_NET_RE.test(note)) {
    return tax({ kind: "net", rate: null, basis: "text", raw, rateFrom: "" });
  }
  return tax({
    kind: "margin",
    rate: null,
    basis: "default_unrecognised",
    flag: "unrecognised_text",
    raw,
    rateFrom: "",
  });
}

export function detectListingTax(input: ListingTaxInput): ListingTax {
  if (input.platform === "auto1") return detectAuto1Tax(input);
  if (input.platform === "openline") return detectOpenlaneTax(input);
  return detectAutobidTax(input);
}

export function taxFromVehicle(
  v: Pick<
    IrissListingVehicle,
    "platform" | "vatNote" | "salesVatType" | "taxDeduction" | "isMargin" | "countryCode" | "vatRate" | "lastSeenAt"
  > & {
    sourceCountry?: string | null;
    owningCountry?: string | null;
  },
): ListingTax {
  return detectListingTax({
    platform: v.platform,
    vatNote: v.vatNote,
    salesVatType: v.salesVatType,
    taxDeduction: v.taxDeduction,
    isMargin: v.isMargin,
    countryCode: v.countryCode,
    sourceCountry: v.sourceCountry ?? undefined,
    owningCountry: v.owningCountry ?? undefined,
    vatRate: v.vatRate,
    lastSeenAt: v.lastSeenAt,
  });
}

function formatRate(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "?";
  return Number.isInteger(rate) ? String(rate) : String(rate);
}

export function listingTaxLabel(t: ListingTax): string {
  if (t.kind === "gross") return `AR PVN ${formatRate(t.rate)} %`;
  if (t.kind === "net") return "NETO";
  return "Margin";
}

export function listingTaxFlagReason(t: ListingTax): string {
  if (t.flag === "stale") {
    const since = t.raw.match(/kopš\s+(.+)$/)?.[1];
    return since
      ? `PVN nav nolasīts (vecs ieraksts, meklējums nav pārlasīts kopš ${since})`
      : "PVN nav nolasīts (vecs ieraksts, meklējums nav pārlasīts). Margin pēc noklusējuma.";
  }
  if (t.flag === "unrecognised_text") {
    const quoted = t.raw.match(/„([^”]*)”/)?.[1] ?? t.raw;
    return `Autobid teksts nav atpazīts: «${quoted}» → Margin pēc noklusējuma`;
  }
  if (t.flag === "missing_fields") return "PVN lauki nav. Margin pēc noklusējuma.";
  if (t.flag === "rate_missing") return "PVN likme nav. Gala cena rēķināta ar likmi 0.";
  if (t.flag === "conflict") return "salesVatType un taxDeduction nesakrīt. Ņemts taxDeduction.";
  return "";
}

export function listingTaxTooltip(t: ListingTax): string {
  const bits = [t.raw, listingTaxFlagReason(t), t.manual ? "PVN režīms iestatīts manuāli" : ""].filter(Boolean);
  return bits.join(" · ");
}

export function listingTaxResolved(
  v: Parameters<typeof taxFromVehicle>[0],
  ov?: { kind: ListingTaxKind; rate?: number | null } | null,
): ListingTax {
  const detected = taxFromVehicle(v);
  if (!ov) return detected;
  const same = ov.kind === detected.kind && (ov.kind !== "gross" || (ov.rate ?? detected.rate) === detected.rate);
  if (same) return detected;
  return {
    ...detected,
    kind: ov.kind,
    rate: ov.kind === "gross" ? ov.rate ?? detected.rate : null,
    flag: null,
    manual: true,
  };
}

export function listingTaxCostArgs(t: ListingTax): { kind: ListingTaxKind; foreignVatPct: number } {
  return { kind: t.kind, foreignVatPct: t.kind === "gross" ? t.rate ?? 0 : 0 };
}

export function listingFinalPriceFromTax(t: ListingTax, bid: number, extras: number): number {
  return listingFinalPrice(t, bid, extras);
}

export function listingTaxChip(kind: ListingTaxKind, rate: number | null = null): ListingTax {
  return { kind, rate, basis: "field", flag: null, raw: listingTaxLabel({ kind, rate, basis: "field", flag: null, raw: "", rateFrom: "" }), rateFrom: "" };
}

function emptyHealth(): ListingVatHealth {
  return {
    total: 0,
    net: 0,
    margin: 0,
    gross: 0,
    defaultSilent: 0,
    defaultUnrecognised: 0,
    missingFields: 0,
    stale: 0,
    rateMissing: 0,
    conflict: 0,
    unrecognisedTexts: [],
    level: "ok",
    reason: "",
  };
}

function scoreHealth(h: ListingVatHealth): ListingVatHealth {
  const warn = h.defaultUnrecognised + h.missingFields + h.stale + h.rateMissing + h.conflict;
  if (warn > 0) {
    const reasons: string[] = [];
    if (h.stale) reasons.push(`stale ${h.stale}`);
    if (h.missingFields) reasons.push(`missing ${h.missingFields}`);
    if (h.rateMissing) reasons.push(`rate_missing ${h.rateMissing}`);
    if (h.conflict) reasons.push(`conflict ${h.conflict}`);
    if (h.defaultUnrecognised) reasons.push(`unrecognised ${h.defaultUnrecognised}`);
    return { ...h, level: "red", reason: reasons.join(", ") };
  }
  if (h.total >= 15) {
    const oneRegime = h.margin === h.total || h.net === h.total || h.gross === h.total;
    if (oneRegime) return { ...h, level: "amber", reason: "100 % viens režīms" };
  }
  if (h.total > 0 && h.defaultSilent / h.total > 0.1) {
    return { ...h, level: "amber", reason: `klusais noklusējums ${Math.round((100 * h.defaultSilent) / h.total)} %` };
  }
  return { ...h, level: "ok", reason: "" };
}

export function computeListingVatHealth(vehicles: readonly IrissListingVehicle[]): ListingVatHealthMap {
  const out: ListingVatHealthMap = {
    auto1: emptyHealth(),
    openline: emptyHealth(),
    autobid: emptyHealth(),
  };
  const texts: Record<IrissListingPlatform, Map<string, number>> = {
    auto1: new Map(),
    openline: new Map(),
    autobid: new Map(),
  };
  for (const v of vehicles) {
    if (v.change === "gone") continue;
    const t = taxFromVehicle(v);
    const h = out[v.platform];
    h.total += 1;
    h[t.kind] += 1;
    if (t.basis === "default_silent") h.defaultSilent += 1;
    if (t.basis === "default_unrecognised") h.defaultUnrecognised += 1;
    if (t.flag === "missing_fields") h.missingFields += 1;
    if (t.flag === "stale") h.stale += 1;
    if (t.flag === "rate_missing") h.rateMissing += 1;
    if (t.flag === "conflict") h.conflict += 1;
    if (t.flag === "unrecognised_text") {
      const key = (v.vatNote || t.raw).slice(0, 160);
      texts[v.platform].set(key, (texts[v.platform].get(key) ?? 0) + 1);
    }
  }
  for (const p of ["auto1", "openline", "autobid"] as const) {
    out[p].unrecognisedTexts = [...texts[p].entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    out[p] = scoreHealth(out[p]);
  }
  return out;
}

export function formatListingVatHealthLine(health: ListingVatHealthMap): string {
  const warn = (h: ListingVatHealth) => h.stale + h.missingFields + h.rateMissing + h.conflict + h.defaultUnrecognised;
  const a = health.auto1;
  const o = health.openline;
  const b = health.autobid;
  return `PVN: Auto1 ${a.margin} Margin · ${a.gross} ar PVN · ${warn(a)} ⚠ | Openlane ${o.margin} · ${o.net} NETO · ${warn(o)} ⚠ | Autobid ${b.margin} · ${b.gross} · ${warn(b)} ⚠`;
}

export function logListingVatHealth(health: ListingVatHealthMap): void {
  console.info("[iriss-listings-vat]", formatListingVatHealthLine(health), {
    auto1: health.auto1,
    openlane: health.openline,
    autobid: health.autobid,
  });
}

/** Tests / rinda: gala cena no detektētā režīma. Re-export, lai spec fixtures lietotu vienu funkciju. */
export { listingFinalPrice, listingRealCost };
