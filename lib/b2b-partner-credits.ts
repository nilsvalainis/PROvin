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
  /**
   * Jau piemērotas norakstīšanas atslēgas (idempotence).
   * Nav pasūtījuma ieraksts. Veci maki bez lauka paliek derīgi.
   */
  debitKeys?: string[];
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

/** Kredīti pagaidām bez termiņa. `expiresAt` paliek lotā nākotnei, bet atlikumā to neņem vērā. */
export function isLiveB2bCreditLot(lot: B2bCreditLot, _now?: Date): boolean {
  return lot.remaining >= 1;
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
  const debitKeys = parseDebitKeys(o.debitKeys);
  return { version: 1, updatedAt, lots, ...(debitKeys.length ? { debitKeys } : {}) };
}

/** Bulk VIN (līdz 20) + spend/reorder atslēgas; vecais 40 griests nogrieztu norakstus. */
export const B2B_DEBIT_KEYS_MAX = 160;

function parseDebitKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!key || key.length > 80 || out.includes(key)) continue;
    out.push(key);
  }
  return out.slice(-B2B_DEBIT_KEYS_MAX);
}

export function walletHasDebitKey(wallet: B2bCreditWallet, key: string | null | undefined): boolean {
  const id = (key ?? "").trim();
  if (!id) return false;
  return (wallet.debitKeys ?? []).includes(id);
}

export function rememberB2bDebitKey(wallet: B2bCreditWallet, key: string | null | undefined): B2bCreditWallet {
  const id = (key ?? "").trim();
  if (!id || walletHasDebitKey(wallet, id)) return wallet;
  const debitKeys = [...(wallet.debitKeys ?? []), id].slice(-B2B_DEBIT_KEYS_MAX);
  return { ...wallet, debitKeys };
}

export function rememberB2bDebitKeys(
  wallet: B2bCreditWallet,
  keys: readonly (string | null | undefined)[],
): B2bCreditWallet {
  let next = wallet;
  for (const key of keys) next = rememberB2bDebitKey(next, key);
  return next;
}

export function forgetB2bDebitKeys(wallet: B2bCreditWallet, keys: readonly (string | null | undefined)[]): B2bCreditWallet {
  const drop = new Set(keys.map((key) => (key ?? "").trim()).filter(Boolean));
  if (drop.size === 0 || !wallet.debitKeys?.length) return wallet;
  const debitKeys = wallet.debitKeys.filter((key) => !drop.has(key));
  if (debitKeys.length === wallet.debitKeys.length) return wallet;
  return { ...wallet, ...(debitKeys.length ? { debitKeys } : { debitKeys: undefined }) };
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
    ...wallet,
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
export function debitB2bCredits(
  wallet: B2bCreditWallet,
  sku: B2bPartnerPlanId,
  qty: number,
  now = new Date(),
): { ok: true; wallet: B2bCreditWallet; lotIds: string[] } | { ok: false; reason: "no_credits" } {
  const n = Math.max(0, Math.floor(qty));
  if (n < 1) return { ok: true, wallet, lotIds: [] };
  if (remainingB2bCredits(wallet.lots, now)[sku] < n) {
    return { ok: false, reason: "no_credits" };
  }
  let next = wallet;
  const lotIds: string[] = [];
  for (let i = 0; i < n; i++) {
    const debit = debitB2bCredit(next, sku, now);
    if (!debit.ok) return { ok: false, reason: "no_credits" };
    next = debit.wallet;
    lotIds.push(debit.lotId);
  }
  return { ok: true, wallet: next, lotIds };
}

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
    wallet: { ...wallet, version: 1, updatedAt: now.toISOString(), lots },
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
      return { ...wallet, version: 1, updatedAt: now.toISOString(), lots };
    }
  }
  return grantB2bCredits(wallet, sku, 1, now);
}
