import { randomBytes } from "node:crypto";
import {
  emptyB2bPartnerPrices,
  euroTextToCents,
  parseB2bPartnerPrices,
  type B2bPartnerPriceOverrides,
} from "@/lib/b2b-partner-account";
import { B2B_BUSINESS_PACKS, B2B_DEALER_PACKS } from "@/lib/b2b-partner-copy";
import {
  B2B_WALLET_PRODUCTS,
  emptyB2bWalletPrices,
  formatB2bWalletEuro,
  parseB2bWalletPrices,
  validateB2bWalletPriceInput,
  type B2bWalletPriceOverrides,
  type B2bWalletProductId,
} from "@/lib/b2b-wallet";

export const B2B_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type B2bPartnerInviteRecord = {
  token: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedPartnerId: string | null;
  /** Individuālās maka cenas. null lauks = kataloga noklusējums. Veciem ielūgumiem: visi null. */
  walletPrices: B2bWalletPriceOverrides;
  /** Mantoto paku cenas. null lauks = kataloga noklusējums. Veciem ielūgumiem: visi null. */
  prices: B2bPartnerPriceOverrides;
};

export type B2bInvitePricing = {
  walletPrices: B2bWalletPriceOverrides;
  prices: B2bPartnerPriceOverrides;
};

export const B2B_INVITE_WALLET_LABELS: Record<B2bWalletProductId, string> = {
  business: "PROVIN Business",
  dealer_raw: "Dīlera dati (RAW)",
  dealer_pro: "Dīlera dati (PRO)",
};

export const B2B_INVITE_LEGACY_LABELS: Record<keyof B2bPartnerPriceOverrides, string> = {
  business1: "Audits · 1 gab.",
  business10: "Audits · 10 gab.",
  dealer1: "Dīlera · 1 gab.",
  dealer10: "Dīlera · 10 gab.",
};

const LEGACY_PRICE_KEYS: readonly (keyof B2bPartnerPriceOverrides)[] = [
  "business1",
  "business10",
  "dealer1",
  "dealer10",
];

export function emptyB2bInvitePricing(): B2bInvitePricing {
  return { walletPrices: emptyB2bWalletPrices(), prices: emptyB2bPartnerPrices() };
}

export function isSafeB2bInviteToken(token: string): boolean {
  return /^inv_[a-f0-9]{32}$/.test(token.trim());
}

export function newB2bInviteToken(): string {
  return `inv_${randomBytes(16).toString("hex")}`;
}

export function parseB2bInviteRecord(raw: unknown): B2bPartnerInviteRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const token = typeof o.token === "string" ? o.token.trim() : "";
  if (!isSafeB2bInviteToken(token)) return null;
  const createdAt = typeof o.createdAt === "string" && o.createdAt.trim() ? o.createdAt.trim() : "";
  const expiresAt = typeof o.expiresAt === "string" && o.expiresAt.trim() ? o.expiresAt.trim() : "";
  if (!createdAt || !expiresAt) return null;
  return {
    token,
    createdAt,
    expiresAt,
    usedAt: typeof o.usedAt === "string" && o.usedAt.trim() ? o.usedAt.trim() : null,
    usedPartnerId: typeof o.usedPartnerId === "string" && o.usedPartnerId.trim() ? o.usedPartnerId.trim() : null,
    walletPrices: parseB2bWalletPrices(o.walletPrices),
    prices: parseB2bPartnerPrices(o.prices),
  };
}

export function isB2bInviteOpen(invite: B2bPartnerInviteRecord, nowMs = Date.now()): boolean {
  if (invite.usedAt) return false;
  const exp = Date.parse(invite.expiresAt);
  return Number.isFinite(exp) && exp > nowMs;
}

export function b2bInviteRegisterPath(token: string): string {
  return `/partneriem/registracija?token=${encodeURIComponent(token.trim())}`;
}

export type B2bInvitePricingValidation =
  | { ok: true; pricing: B2bInvitePricing }
  | {
      ok: false;
      error: "invalid_prices";
      field: string;
      reason: "invalid" | "below_min";
      minCents?: number;
    };

function parseLegacyPriceField(raw: unknown): number | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return "invalid";
    const n = Math.round(raw);
    if (n < 1 || n > 1_000_000_00) return "invalid";
    return n;
  }
  if (typeof raw === "string") return euroTextToCents(raw);
  return "invalid";
}

function pickWalletInput(
  raw: Record<string, unknown> | null,
): Partial<Record<B2bWalletProductId, string | number | null | undefined>> {
  if (!raw) return {};
  const pick = (key: B2bWalletProductId) => {
    const v = raw[key];
    return typeof v === "string" || typeof v === "number" || v == null ? v : undefined;
  };
  return {
    business: pick("business"),
    dealer_raw: pick("dealer_raw"),
    dealer_pro: pick("dealer_pro"),
  };
}

/**
 * Admina POST ievade. Tukšs / izlaists lauks = kataloga noklusējums.
 * 0 nav derīgs (tāpat kā partnera cenu formās). Nederīgas vērtības atsakām, neklusām.
 */
export function validateB2bInvitePricingInput(raw: unknown): B2bInvitePricingValidation {
  if (raw == null) return { ok: true, pricing: emptyB2bInvitePricing() };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_prices", field: "pricing", reason: "invalid" };
  }
  const o = raw as Record<string, unknown>;

  const walletSource =
    o.walletPrices != null && typeof o.walletPrices === "object" && !Array.isArray(o.walletPrices)
      ? (o.walletPrices as Record<string, unknown>)
      : null;
  const walletValidation = validateB2bWalletPriceInput(pickWalletInput(walletSource));
  if (!walletValidation.ok) {
    return {
      ok: false,
      error: "invalid_prices",
      field: walletValidation.product,
      reason: walletValidation.reason,
      minCents: walletValidation.minCents,
    };
  }

  const prices = emptyB2bPartnerPrices();
  if (o.prices != null) {
    if (typeof o.prices !== "object" || Array.isArray(o.prices)) {
      return { ok: false, error: "invalid_prices", field: "prices", reason: "invalid" };
    }
    const pack = o.prices as Record<string, unknown>;
    for (const key of LEGACY_PRICE_KEYS) {
      const parsed = parseLegacyPriceField(pack[key]);
      if (parsed === "invalid") {
        return { ok: false, error: "invalid_prices", field: key, reason: "invalid" };
      }
      prices[key] = parsed;
    }
  }

  return { ok: true, pricing: { walletPrices: walletValidation.prices, prices } };
}

export function adminB2bInvitePriceError(validation: Extract<B2bInvitePricingValidation, { ok: false }>): string {
  if (validation.field === "business" || validation.field === "dealer_raw" || validation.field === "dealer_pro") {
    const label = B2B_INVITE_WALLET_LABELS[validation.field];
    if (validation.reason === "below_min" && validation.minCents != null) {
      return `${label}: cena nevar būt zemāka par ${formatB2bWalletEuro(validation.minCents)}.`;
    }
    return `${label}: nederīga summa.`;
  }
  if (validation.field in B2B_INVITE_LEGACY_LABELS) {
    const label = B2B_INVITE_LEGACY_LABELS[validation.field as keyof B2bPartnerPriceOverrides];
    return `${label}: nederīga summa. Tukšs = kataloga noklusējums.`;
  }
  return "Cenas formāts: piem. 79,99 (tukšs = kataloga noklusējums).";
}

/** Cenas ņem tikai no ielūguma. Publiskā reģistrācijas ķermenī tās ignorējam. */
export function partnerPricingFromInvite(
  invite: Pick<B2bPartnerInviteRecord, "walletPrices" | "prices">,
  _registerBody?: Record<string, unknown>,
): B2bInvitePricing {
  return {
    walletPrices: parseB2bWalletPrices(invite.walletPrices),
    prices: parseB2bPartnerPrices(invite.prices),
  };
}

export function toAdminB2bInviteJson(invite: B2bPartnerInviteRecord) {
  return {
    token: invite.token,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    path: b2bInviteRegisterPath(invite.token),
    walletPrices: invite.walletPrices,
    prices: invite.prices,
  };
}

export type B2bInvitePriceSummaryLine = {
  id: string;
  label: string;
  cents: number | null;
  defaultCents: number;
  display: string;
};

export function b2bInviteWalletDefaultCents(id: B2bWalletProductId): number {
  return B2B_WALLET_PRODUCTS[id].defaultCents;
}

export function b2bInviteLegacyDefaultCents(id: keyof B2bPartnerPriceOverrides): number {
  if (id === "business1") return B2B_BUSINESS_PACKS[0]!.unitCents;
  if (id === "business10") return B2B_BUSINESS_PACKS[1]!.unitCents;
  if (id === "dealer1") return B2B_DEALER_PACKS[0]!.unitCents;
  return B2B_DEALER_PACKS[1]!.unitCents;
}

function summaryDisplay(cents: number | null, defaultCents: number): string {
  if (cents == null) return `noklusējums (${formatB2bWalletEuro(defaultCents)})`;
  return formatB2bWalletEuro(cents);
}

export function b2bInvitePriceSummary(
  pricing: Pick<B2bInvitePricing, "walletPrices" | "prices">,
): B2bInvitePriceSummaryLine[] {
  const wallet: B2bInvitePriceSummaryLine[] = (["business", "dealer_raw", "dealer_pro"] as const).map((id) => {
    const defaultCents = b2bInviteWalletDefaultCents(id);
    const cents = pricing.walletPrices[id];
    return {
      id,
      label: B2B_INVITE_WALLET_LABELS[id],
      cents,
      defaultCents,
      display: summaryDisplay(cents, defaultCents),
    };
  });
  const legacy: B2bInvitePriceSummaryLine[] = LEGACY_PRICE_KEYS.map((id) => {
    const defaultCents = b2bInviteLegacyDefaultCents(id);
    const cents = pricing.prices[id];
    return {
      id,
      label: B2B_INVITE_LEGACY_LABELS[id],
      cents,
      defaultCents,
      display: summaryDisplay(cents, defaultCents),
    };
  });
  return [...wallet, ...legacy];
}

export function b2bInviteHasCustomPricing(pricing: Pick<B2bInvitePricing, "walletPrices" | "prices">): boolean {
  return b2bInvitePriceSummary(pricing).some((line) => line.cents != null);
}
