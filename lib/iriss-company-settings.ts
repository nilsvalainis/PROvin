/**
 * IRISS uzņēmuma iestatījumi (logo, rekvizīti, izmaksas, PDF teksti).
 * Noklusējumi = pašreizējās ĪRISS/Dzintarzeme vērtības, lai vizuāli nekas nemainītos.
 * Tukši identitātes/kājene/noteikumu lauki nozīmē: izmanto līdzšinējo env / iebūvēto tekstu.
 */

import { DEFAULT_LISTING_COSTS, LV_VAT_RATE, type ListingCostParts } from "@/lib/iriss-listings-cost";
import {
  DZ_PASUTIJUMS_TERMS_BLOCKS,
  type DzPasutijumsTermBlock,
} from "@/lib/dzintarzeme-pasutijums-terms-content";

export const IRISS_DEFAULT_LOGO_PATH = "/brands/dzintarzeme-iriss-offer-pdf-logo.png";
export const IRISS_DEFAULT_LOGO_ALT = "Dzintarzeme Auto";
export const IRISS_DEFAULT_LEGAL_NAME = "SIA IRISS";
export const IRISS_DEFAULT_DEPOSIT_EUR = 200;

export type IrissCompanySettings = {
  legalName: string;
  publicBrand: string;
  regNo: string;
  legalAddress: string;
  officeAddress: string;
  bank: string;
  phone: string;
  email: string;
  website: string;
  contacts: string;
  commission: number;
  transport: number;
  auctionFee: number;
  contingency: number;
  vatPercent: number;
  depositEur: number;
  logoUrl: string;
  logoAlt: string;
  footerLines: string[];
  termsText: string;
  pdfExtraFooter: string;
};

export function defaultIrissCompanySettings(): IrissCompanySettings {
  return {
    legalName: "",
    publicBrand: "",
    regNo: "",
    legalAddress: "",
    officeAddress: "",
    bank: "",
    phone: "",
    email: "",
    website: "",
    contacts: "",
    commission: DEFAULT_LISTING_COSTS.commission,
    transport: DEFAULT_LISTING_COSTS.transport,
    auctionFee: DEFAULT_LISTING_COSTS.fee,
    contingency: DEFAULT_LISTING_COSTS.unplanned,
    vatPercent: Math.round(LV_VAT_RATE * 100),
    depositEur: IRISS_DEFAULT_DEPOSIT_EUR,
    logoUrl: "",
    logoAlt: "",
    footerLines: [],
    termsText: "",
    pdfExtraFooter: "",
  };
}

function str(v: unknown, max = 4_000): string {
  if (typeof v !== "string") return "";
  return v.replace(/\u2014/g, "-").replace(/\u2013/g, "-").trim().slice(0, max);
}

function num(v: unknown, fallback: number, min = 0, max = 1_000_000): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function lines(v: unknown): string[] {
  if (typeof v === "string") {
    return v
      .split(/\r?\n/)
      .map((s) => str(s, 400))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x, 400))
    .filter(Boolean)
    .slice(0, 20);
}

export function normalizeIrissCompanySettings(raw: unknown): IrissCompanySettings {
  const base = defaultIrissCompanySettings();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    legalName: str(o.legalName, 160),
    publicBrand: str(o.publicBrand, 80),
    regNo: str(o.regNo, 80),
    legalAddress: str(o.legalAddress, 320),
    officeAddress: str(o.officeAddress, 320),
    bank: str(o.bank, 240),
    phone: str(o.phone, 120),
    email: str(o.email, 160),
    website: str(o.website, 240),
    contacts: str(o.contacts, 320),
    commission: num(o.commission, base.commission),
    transport: num(o.transport, base.transport),
    auctionFee: num(o.auctionFee, base.auctionFee),
    contingency: num(o.contingency, base.contingency),
    vatPercent: num(o.vatPercent, base.vatPercent, 0, 100),
    depositEur: num(o.depositEur, base.depositEur),
    logoUrl: str(o.logoUrl, 800),
    logoAlt: str(o.logoAlt, 120),
    footerLines: lines(o.footerLines),
    termsText: str(o.termsText, 40_000),
    pdfExtraFooter: str(o.pdfExtraFooter, 4_000),
  };
}

export function irissCompanyListingCosts(s: IrissCompanySettings): ListingCostParts {
  return {
    fee: s.auctionFee,
    transport: s.transport,
    commission: s.commission,
    unplanned: s.contingency,
  };
}

export function irissCompanyVatRate(s: IrissCompanySettings): number {
  return s.vatPercent / 100;
}

export function irissCompanyLogoSrc(s: IrissCompanySettings): string {
  return s.logoUrl.trim() || IRISS_DEFAULT_LOGO_PATH;
}

export function irissCompanyLogoAlt(s: IrissCompanySettings): string {
  return s.logoAlt.trim() || IRISS_DEFAULT_LOGO_ALT;
}

export function buildIrissFooterLinesFromSettings(s: IrissCompanySettings): string[] {
  if (s.footerLines.length > 0) return [...s.footerLines];
  const out: string[] = [];
  const brand = s.legalName.trim() || s.publicBrand.trim();
  if (brand) out.push(brand);
  if (s.regNo.trim()) out.push(`Reģ. nr.: ${s.regNo.trim()}`);
  if (s.legalAddress.trim()) out.push(s.legalAddress.trim());
  if (s.officeAddress.trim() && s.officeAddress.trim() !== s.legalAddress.trim()) out.push(s.officeAddress.trim());
  if (s.bank.trim()) out.push(s.bank.trim());
  if (s.contacts.trim()) out.push(s.contacts.trim());
  if (s.phone.trim()) out.push(s.phone.trim());
  if (s.email.trim()) out.push(s.email.trim());
  if (s.website.trim()) out.push(s.website.trim());
  if (s.pdfExtraFooter.trim()) {
    for (const ln of s.pdfExtraFooter.split(/\r?\n/)) {
      const t = ln.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

export function defaultIrissTermsText(): string {
  const parts: string[] = [];
  for (const b of DZ_PASUTIJUMS_TERMS_BLOCKS) {
    if (b.kind === "h") parts.push(b.text);
    else if (b.kind === "p") parts.push(b.text);
    else {
      for (const it of b.items) parts.push(`- ${it}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim().replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

export function parseIrissTermsBlocks(text: string): DzPasutijumsTermBlock[] {
  const src = text.replace(/\u2014/g, "-").replace(/\u2013/g, "-").trim();
  if (!src) return [...DZ_PASUTIJUMS_TERMS_BLOCKS];
  const linesIn = src.split(/\r?\n/);
  const out: DzPasutijumsTermBlock[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    out.push({ kind: "b", items: bullets });
    bullets = [];
  };
  for (const raw of linesIn) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•*]\s+/, "").trim());
      continue;
    }
    flushBullets();
    const isHead =
      line === line.toUpperCase() && line.length <= 80 && /[A-ZĀČĒĢĪĶĻŅŠŪŽ]/.test(line) && !line.endsWith(".");
    const numberedHead = /^\d+\.\s+\S/.test(line) && line.length <= 80;
    if (isHead || numberedHead) out.push({ kind: "h", text: line });
    else out.push({ kind: "p", text: line });
  }
  flushBullets();
  return out.length ? out : [...DZ_PASUTIJUMS_TERMS_BLOCKS];
}

function termsDumpKey(text: string): string {
  return text.replace(/\u2014/g, "-").replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();
}

export function irissTermsBlocksForPdf(s: IrissCompanySettings): readonly DzPasutijumsTermBlock[] {
  const t = s.termsText.trim();
  if (!t || termsDumpKey(t) === termsDumpKey(defaultIrissTermsText())) return DZ_PASUTIJUMS_TERMS_BLOCKS;
  return parseIrissTermsBlocks(s.termsText);
}

export function settingsFormDefaults(s: IrissCompanySettings): IrissCompanySettings {
  return {
    ...s,
    termsText: s.termsText.trim() || defaultIrissTermsText(),
    logoAlt: s.logoAlt.trim() || IRISS_DEFAULT_LOGO_ALT,
  };
}
