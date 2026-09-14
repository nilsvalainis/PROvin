import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

export const B2B_CREDIT_TTL_DAYS = 90;

export type B2bCreditLot = {
  id: string;
  sku: B2bPartnerPlanId;
  remaining: number;
  purchasedAt: string;
  expiresAt: string;
  sourceSessionId?: string;
};

export type B2bCreditRemaining = Record<B2bPartnerPlanId, number>;

export type B2bCreditWallet = {
  version: 1;
  updatedAt: string;
  lots: B2bCreditLot[];
};

export type B2bCreditArchiveRow = {
  id: string;
  createdAt: string;
  vin: string;
  plan: B2bPartnerPlanId;
  status: "queued" | "ready" | "no_data" | "credit_restored";
  amountLabel: string;
  invoiceNumber: string;
  reportHref?: string | null;
};

export function emptyB2bCreditRemaining(): B2bCreditRemaining {
  return { business: 0, dealer: 0 };
}

export function emptyB2bCreditWallet(): B2bCreditWallet {
  return { version: 1, updatedAt: new Date(0).toISOString(), lots: [] };
}

export function b2bCreditExpiresAt(purchasedAt: Date, ttlDays = B2B_CREDIT_TTL_DAYS): Date {
  const expires = new Date(purchasedAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + ttlDays);
  return expires;
}

export function isLiveB2bCreditLot(lot: B2bCreditLot, now: Date): boolean {
  if (lot.remaining < 1) return false;
  const expires = Date.parse(lot.expiresAt);
  if (!Number.isFinite(expires)) return false;
  return expires > now.getTime();
}

export function remainingB2bCredits(lots: readonly B2bCreditLot[], now: Date): B2bCreditRemaining {
  const out = emptyB2bCreditRemaining();
  for (const lot of lots) {
    if (!isLiveB2bCreditLot(lot, now)) continue;
    out[lot.sku] += lot.remaining;
  }
  return out;
}

export function hasAnyB2bCredit(remaining: B2bCreditRemaining): boolean {
  return remaining.business > 0 || remaining.dealer > 0;
}

export function parseB2bCreditLot(raw: unknown): B2bCreditLot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const sku = o.sku === "dealer" || o.sku === "business" ? o.sku : null;
  const remaining =
    typeof o.remaining === "number" && Number.isFinite(o.remaining) ? Math.max(0, Math.floor(o.remaining)) : -1;
  const purchasedAt = typeof o.purchasedAt === "string" ? o.purchasedAt.trim() : "";
  const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt.trim() : "";
  if (!id || id.length > 80 || !sku || remaining < 0 || !purchasedAt || !expiresAt) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  const sourceRaw = typeof o.sourceSessionId === "string" ? o.sourceSessionId.trim() : "";
  const sourceSessionId = parseCreditSourceSessionId(sourceRaw);
  return { id, sku, remaining, purchasedAt, expiresAt, ...(sourceSessionId ? { sourceSessionId } : {}) };
}

export function parseB2bCreditWallet(raw: unknown): B2bCreditWallet {
  if (!raw || typeof raw !== "object") return emptyB2bCreditWallet();
  const o = raw as Record<string, unknown>;
  const lots: B2bCreditLot[] = [];
  if (Array.isArray(o.lots)) {
    for (const item of o.lots) {
      const lot = parseB2bCreditLot(item);
      if (lot) lots.push(lot);
    }
  }
  const updatedAt =
    typeof o.updatedAt === "string" && o.updatedAt.trim() ? o.updatedAt.trim() : new Date(0).toISOString();
  return { version: 1, updatedAt, lots };
}

function newLotId(sku: B2bPartnerPlanId, now: Date): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `lot_${sku}_${now.getTime()}_${rnd}`;
}

function parseCreditSourceSessionId(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value || value.length > 200) return undefined;
  if (!/^cs_[a-zA-Z0-9_]+$/.test(value)) return undefined;
  return value;
}

export function grantB2bCredits(
  wallet: B2bCreditWallet,
  sku: B2bPartnerPlanId,
  qty: number,
  now = new Date(),
  sourceSessionId?: string,
): B2bCreditWallet {
  const n = Math.max(0, Math.floor(qty));
  if (n < 1) return wallet;
  const source = parseCreditSourceSessionId(sourceSessionId);
  if (source && walletHasGrantedSession(wallet, source)) return wallet;
  const lot: B2bCreditLot = {
    id: newLotId(sku, now),
    sku,
    remaining: n,
    purchasedAt: now.toISOString(),
    expiresAt: b2bCreditExpiresAt(now).toISOString(),
    ...(source ? { sourceSessionId: source } : {}),
  };
  return {
    version: 1,
    updatedAt: now.toISOString(),
    lots: [...wallet.lots, lot],
  };
}

export function walletHasGrantedSession(wallet: B2bCreditWallet, sessionId: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  return wallet.lots.some((lot) => lot.sourceSessionId === id);
}

export type DebitB2bCreditResult =
  | { ok: true; wallet: B2bCreditWallet; lotId: string }
  | { ok: false; reason: "no_credits" };

/** FIFO: vispirms vecākais dzīvais lots. */
export function debitB2bCredit(
  wallet: B2bCreditWallet,
  sku: B2bPartnerPlanId,
  now = new Date(),
): DebitB2bCreditResult {
  const live = wallet.lots
    .map((lot, index) => ({ lot, index }))
    .filter(({ lot }) => lot.sku === sku && isLiveB2bCreditLot(lot, now))
    .sort((a, b) => a.lot.purchasedAt.localeCompare(b.lot.purchasedAt));
  const pick = live[0];
  if (!pick) return { ok: false, reason: "no_credits" };
  const lots = wallet.lots.map((lot, i) =>
    i === pick.index ? { ...lot, remaining: lot.remaining - 1 } : lot,
  );
  return {
    ok: true,
    lotId: pick.lot.id,
    wallet: { version: 1, updatedAt: now.toISOString(), lots },
  };
}

export function restoreB2bCredit(
  wallet: B2bCreditWallet,
  sku: B2bPartnerPlanId,
  lotId: string | null | undefined,
  now = new Date(),
): B2bCreditWallet {
  const id = (lotId ?? "").trim();
  if (id) {
    const idx = wallet.lots.findIndex((lot) => lot.id === id && lot.sku === sku);
    if (idx >= 0) {
      const lots = wallet.lots.map((lot, i) =>
        i === idx ? { ...lot, remaining: lot.remaining + 1 } : lot,
      );
      return { version: 1, updatedAt: now.toISOString(), lots };
    }
  }
  return grantB2bCredits(wallet, sku, 1, now);
}
