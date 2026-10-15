import { assertSameTenant } from "@/lib/b2b-demo-isolation";
import { isSafeB2bDemoTenantId } from "@/lib/b2b-demo-ids";
import { isB2bDemoVatMode, type B2bDemoSettings, type B2bDemoVatMode } from "@/lib/b2b-demo-types";

const TEXT = {
  logoUrl: 500,
  companyName: 160,
  companyReg: 80,
  vatNumber: 80,
  bank: 200,
  address: 240,
  phone: 40,
  email: 120,
  pdfFooterText: 2000,
  pdfTermsText: 8000,
  pdfDepositText: 2000,
} as const;

function clip(value: unknown, max: number): string {
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

function money(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n >= 0 && n <= 1_000_000) return Math.round(n * 100) / 100;
  }
  return 0;
}

/** Empty defaults. ĪRISS hardcoded 1190/800/600/1000 are NOT copied here. */
export function emptyB2bDemoSettings(tenantId: string, now = new Date().toISOString()): B2bDemoSettings {
  if (!isSafeB2bDemoTenantId(tenantId)) {
    throw new Error("Nederīgs tenant_id.");
  }
  return {
    tenantId,
    logoUrl: "",
    companyName: "",
    companyReg: "",
    vatNumber: "",
    bank: "",
    address: "",
    phone: "",
    email: "",
    commissionEur: 0,
    transportEur: 0,
    auctionFeeEur: 0,
    unexpectedEur: 0,
    vatMode: "none",
    pdfFooterText: "",
    pdfTermsText: "",
    pdfDepositText: "",
    updatedAt: now,
  };
}

export type B2bDemoSettingsPatch = Partial<
  Omit<B2bDemoSettings, "tenantId" | "updatedAt">
>;

export function applyB2bDemoSettingsPatch(
  current: B2bDemoSettings,
  tenantId: string,
  patch: B2bDemoSettingsPatch,
  now = new Date().toISOString(),
): B2bDemoSettings {
  assertSameTenant(current, tenantId);
  const vatMode: B2bDemoVatMode = isB2bDemoVatMode(patch.vatMode) ? patch.vatMode : current.vatMode;
  const logoUrl = clip(patch.logoUrl ?? current.logoUrl, TEXT.logoUrl);
  if (logoUrl && !/^https:\/\//i.test(logoUrl) && !logoUrl.startsWith("/")) {
    throw new Error("Logo URL jābūt https vai vietējam ceļam.");
  }
  return {
    tenantId,
    logoUrl,
    companyName: clip(patch.companyName ?? current.companyName, TEXT.companyName),
    companyReg: clip(patch.companyReg ?? current.companyReg, TEXT.companyReg),
    vatNumber: clip(patch.vatNumber ?? current.vatNumber, TEXT.vatNumber),
    bank: clip(patch.bank ?? current.bank, TEXT.bank),
    address: clip(patch.address ?? current.address, TEXT.address),
    phone: clip(patch.phone ?? current.phone, TEXT.phone),
    email: clip(patch.email ?? current.email, TEXT.email),
    commissionEur: patch.commissionEur !== undefined ? money(patch.commissionEur) : current.commissionEur,
    transportEur: patch.transportEur !== undefined ? money(patch.transportEur) : current.transportEur,
    auctionFeeEur: patch.auctionFeeEur !== undefined ? money(patch.auctionFeeEur) : current.auctionFeeEur,
    unexpectedEur: patch.unexpectedEur !== undefined ? money(patch.unexpectedEur) : current.unexpectedEur,
    vatMode,
    pdfFooterText: clip(patch.pdfFooterText ?? current.pdfFooterText, TEXT.pdfFooterText),
    pdfTermsText: clip(patch.pdfTermsText ?? current.pdfTermsText, TEXT.pdfTermsText),
    pdfDepositText: clip(patch.pdfDepositText ?? current.pdfDepositText, TEXT.pdfDepositText),
    updatedAt: now,
  };
}

export function parseB2bDemoSettings(raw: unknown, tenantId: string): B2bDemoSettings {
  const base = emptyB2bDemoSettings(tenantId);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  try {
    return applyB2bDemoSettingsPatch(base, tenantId, {
      logoUrl: typeof o.logoUrl === "string" ? o.logoUrl : "",
      companyName: typeof o.companyName === "string" ? o.companyName : "",
      companyReg: typeof o.companyReg === "string" ? o.companyReg : "",
      vatNumber: typeof o.vatNumber === "string" ? o.vatNumber : "",
      bank: typeof o.bank === "string" ? o.bank : "",
      address: typeof o.address === "string" ? o.address : "",
      phone: typeof o.phone === "string" ? o.phone : "",
      email: typeof o.email === "string" ? o.email : "",
      commissionEur: o.commissionEur as number | undefined,
      transportEur: o.transportEur as number | undefined,
      auctionFeeEur: o.auctionFeeEur as number | undefined,
      unexpectedEur: o.unexpectedEur as number | undefined,
      vatMode: isB2bDemoVatMode(o.vatMode) ? o.vatMode : "none",
      pdfFooterText: typeof o.pdfFooterText === "string" ? o.pdfFooterText : "",
      pdfTermsText: typeof o.pdfTermsText === "string" ? o.pdfTermsText : "",
      pdfDepositText: typeof o.pdfDepositText === "string" ? o.pdfDepositText : "",
    });
  } catch {
    return base;
  }
}
