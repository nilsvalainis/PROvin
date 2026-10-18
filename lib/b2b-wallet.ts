import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

/**
 * Partnera priekšapmaksas maks EUR (centos).
 * Tīras funkcijas: krātuve (`b2b-wallet-store`) raksta ar Blob `ifMatch`,
 * tāpēc katra mutācija ir atomāra arī starp vairākām Vercel instancēm.
 */

export type B2bWalletProductId = "business" | "dealer_raw" | "dealer_pro";

export const B2B_WALLET_PRODUCT_IDS: readonly B2bWalletProductId[] = ["business", "dealer_raw", "dealer_pro"];

export type B2bWalletReportLang = "lv" | "ru" | "en" | "de";

export const B2B_WALLET_REPORT_LANGS: readonly B2bWalletReportLang[] = ["lv", "ru", "en", "de"];

export type B2bWalletProductSpec = {
  id: B2bWalletProductId;
  defaultCents: number;
  minCents: number;
  /** Esošā pasūtījuma līnija (admin saraksts, arhīvs, dīlera ielase). */
  plan: B2bPartnerPlanId;
  /** Ja dīlera datu nav, summu automātiski atgriež makā. */
  refundOnNoData: boolean;
};

export const B2B_WALLET_PRODUCTS: Record<B2bWalletProductId, B2bWalletProductSpec> = {
  business: { id: "business", defaultCents: 7999, minCents: 6999, plan: "business", refundOnNoData: false },
  dealer_raw: { id: "dealer_raw", defaultCents: 1999, minCents: 1199, plan: "dealer", refundOnNoData: true },
  dealer_pro: { id: "dealer_pro", defaultCents: 2499, minCents: 1499, plan: "dealer", refundOnNoData: true },
};

export function isB2bWalletProductId(value: unknown): value is B2bWalletProductId {
  return value === "business" || value === "dealer_raw" || value === "dealer_pro";
}

export function isB2bWalletReportLang(value: unknown): value is B2bWalletReportLang {
  return value === "lv" || value === "ru" || value === "en" || value === "de";
}

/** Individuālās cenas (centi). `null` = noklusējuma cena. */
export type B2bWalletPriceOverrides = Record<B2bWalletProductId, number | null>;

export function emptyB2bWalletPrices(): B2bWalletPriceOverrides {
  return { business: null, dealer_raw: null, dealer_pro: null };
}

function parseOverrideCents(raw: unknown, product: B2bWalletProductId): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < B2B_WALLET_PRODUCTS[product].minCents || n > 1_000_000) return null;
  return n;
}

export function parseB2bWalletPrices(raw: unknown): B2bWalletPriceOverrides {
  if (!raw || typeof raw !== "object") return emptyB2bWalletPrices();
  const o = raw as Record<string, unknown>;
  return {
    business: parseOverrideCents(o.business, "business"),
    dealer_raw: parseOverrideCents(o.dealer_raw, "dealer_raw"),
    dealer_pro: parseOverrideCents(o.dealer_pro, "dealer_pro"),
  };
}

export type B2bWalletResolvedPrice = {
  product: B2bWalletProductId;
  priceCents: number;
  defaultCents: number;
  /** 0, ja nav atlaides. */
  discountPct: number;
};

export function b2bWalletDiscountPct(priceCents: number, defaultCents: number): number {
  if (defaultCents <= 0 || priceCents >= defaultCents) return 0;
  return Math.max(1, Math.round(((defaultCents - priceCents) / defaultCents) * 100));
}

export function resolveB2bWalletPrice(
  product: B2bWalletProductId,
  overrides: B2bWalletPriceOverrides | null | undefined,
): B2bWalletResolvedPrice {
  const spec = B2B_WALLET_PRODUCTS[product];
  const override = overrides?.[product] ?? null;
  const priceCents = override != null && override >= spec.minCents ? override : spec.defaultCents;
  return {
    product,
    priceCents,
    defaultCents: spec.defaultCents,
    discountPct: b2bWalletDiscountPct(priceCents, spec.defaultCents),
  };
}

export function resolveB2bWalletPrices(
  overrides: B2bWalletPriceOverrides | null | undefined,
): Record<B2bWalletProductId, B2bWalletResolvedPrice> {
  return {
    business: resolveB2bWalletPrice("business", overrides),
    dealer_raw: resolveB2bWalletPrice("dealer_raw", overrides),
    dealer_pro: resolveB2bWalletPrice("dealer_pro", overrides),
  };
}

/** Adminā paslēptie maka produkti. Tukšs saraksts = visi redzami (arī veciem ierakstiem). */
export type B2bWalletHiddenProducts = readonly B2bWalletProductId[];

export function parseB2bWalletHiddenProducts(raw: unknown): B2bWalletProductId[] {
  if (!Array.isArray(raw)) return [];
  return B2B_WALLET_PRODUCT_IDS.filter((id) => raw.includes(id));
}

export function isB2bWalletProductVisible(
  product: B2bWalletProductId,
  hidden: B2bWalletHiddenProducts | null | undefined,
): boolean {
  return !(hidden ?? []).includes(product);
}

export function visibleB2bWalletProducts(hidden: B2bWalletHiddenProducts | null | undefined): B2bWalletProductId[] {
  return B2B_WALLET_PRODUCT_IDS.filter((id) => isB2bWalletProductVisible(id, hidden));
}

/** Lētākā redzamā produkta cena; 0, ja neviens produkts nav redzams. */
export function cheapestB2bWalletPriceCents(
  overrides: B2bWalletPriceOverrides | null | undefined,
  hidden?: B2bWalletHiddenProducts | null,
): number {
  const prices = resolveB2bWalletPrices(overrides);
  const visible = visibleB2bWalletProducts(hidden);
  if (visible.length === 0) return 0;
  return Math.min(...visible.map((id) => prices[id].priceCents));
}

export function canAffordCheapestB2bWalletProduct(
  balanceCents: number,
  overrides: B2bWalletPriceOverrides | null | undefined,
  hidden?: B2bWalletHiddenProducts | null,
): boolean {
  return balanceCents >= cheapestB2bWalletPriceCents(overrides, hidden);
}

export function formatB2bWalletEuro(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2).replace(".", ",")} €`;
}

/** „79,99” / „79.99” / „79,99 €” -> centi. Tukšs = null. */
export function parseB2bEuroInput(raw: string): number | null | "invalid" {
  const t = raw.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "invalid";
  const euros = Number(t);
  if (!Number.isFinite(euros) || euros <= 0 || euros > 1_000_000) return "invalid";
  return Math.round(euros * 100);
}

export type B2bWalletPriceValidation =
  | { ok: true; prices: B2bWalletPriceOverrides }
  | { ok: false; product: B2bWalletProductId; reason: "invalid" | "below_min"; minCents: number };

/** Admin ievade: tukšs = noklusējums; zem minimuma saglabāt nedrīkst. */
export function validateB2bWalletPriceInput(
  raw: Partial<Record<B2bWalletProductId, string | number | null | undefined>>,
): B2bWalletPriceValidation {
  const prices = emptyB2bWalletPrices();
  for (const product of B2B_WALLET_PRODUCT_IDS) {
    const spec = B2B_WALLET_PRODUCTS[product];
    const value = raw[product];
    let cents: number | null | "invalid";
    if (value == null) cents = null;
    else if (typeof value === "number") cents = Number.isFinite(value) && value > 0 ? Math.round(value) : "invalid";
    else cents = parseB2bEuroInput(value);
    if (cents === "invalid") return { ok: false, product, reason: "invalid", minCents: spec.minCents };
    if (cents != null && cents < spec.minCents) {
      return { ok: false, product, reason: "below_min", minCents: spec.minCents };
    }
    prices[product] = cents;
  }
  return { ok: true, prices };
}

export const B2B_WALLET_TOPUP_PRESETS_CENTS: readonly number[] = [1500, 3000, 6000, 10000];
export const B2B_WALLET_TOPUP_MIN_CENTS = 500;
export const B2B_WALLET_TOPUP_MAX_CENTS = 1_000_000;

export function isValidB2bWalletTopupCents(cents: unknown): cents is number {
  return (
    typeof cents === "number" &&
    Number.isInteger(cents) &&
    cents >= B2B_WALLET_TOPUP_MIN_CENTS &&
    cents <= B2B_WALLET_TOPUP_MAX_CENTS
  );
}

export type B2bWalletTxnKind = "topup" | "purchase" | "refund" | "adjust";

export type B2bWalletTxn = {
  id: string;
  kind: B2bWalletTxnKind;
  /** Ar zīmi: + papildinājums / atmaksa, - pirkums. */
  amountCents: number;
  balanceAfterCents: number;
  at: string;
  /** Idempotences atslēga (Stripe sesija, pirkuma pieprasījums, atmaksa). */
  key: string;
  product?: B2bWalletProductId;
  vin?: string;
  orderId?: string;
  sessionId?: string;
  /** Maka papildinājuma rēķina numurs (IRS-YYYY-XXXX). */
  invoiceNumber?: string;
  note?: string;
  /** Atmaksai: pirkuma darījuma id. */
  refundOf?: string;
};

export type B2bWallet = {
  version: 1;
  balanceCents: number;
  topupTotalCents: number;
  /** Pirkumi mīnus atmaksas. */
  spentTotalCents: number;
  updatedAt: string;
  txns: B2bWalletTxn[];
};

export const B2B_WALLET_TXN_MAX = 2000;

export function emptyB2bWallet(): B2bWallet {
  return {
    version: 1,
    balanceCents: 0,
    topupTotalCents: 0,
    spentTotalCents: 0,
    updatedAt: new Date(0).toISOString(),
    txns: [],
  };
}

const TXN_KINDS: readonly B2bWalletTxnKind[] = ["topup", "purchase", "refund", "adjust"];

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function int(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
}

function parseTxn(raw: unknown): B2bWalletTxn | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 80);
  const kind = TXN_KINDS.find((k) => k === o.kind);
  const amountCents = int(o.amountCents);
  const balanceAfterCents = int(o.balanceAfterCents);
  const at = str(o.at, 40);
  const key = str(o.key, 160);
  if (!id || !kind || amountCents == null || balanceAfterCents == null || !at || !key) return null;
  const product = isB2bWalletProductId(o.product) ? o.product : undefined;
  return {
    id,
    kind,
    amountCents,
    balanceAfterCents,
    at,
    key,
    ...(product ? { product } : {}),
    ...(str(o.vin, 24) ? { vin: str(o.vin, 24) } : {}),
    ...(str(o.orderId, 120) ? { orderId: str(o.orderId, 120) } : {}),
    ...(str(o.sessionId, 200) ? { sessionId: str(o.sessionId, 200) } : {}),
    ...(str(o.invoiceNumber, 40) ? { invoiceNumber: str(o.invoiceNumber, 40) } : {}),
    ...(str(o.note, 300) ? { note: str(o.note, 300) } : {}),
    ...(str(o.refundOf, 80) ? { refundOf: str(o.refundOf, 80) } : {}),
  };
}

export function parseB2bWallet(raw: unknown): B2bWallet {
  if (!raw || typeof raw !== "object") return emptyB2bWallet();
  const o = raw as Record<string, unknown>;
  const txns: B2bWalletTxn[] = [];
  if (Array.isArray(o.txns)) {
    for (const item of o.txns) {
      const txn = parseTxn(item);
      if (txn) txns.push(txn);
    }
  }
  return {
    version: 1,
    balanceCents: Math.max(0, int(o.balanceCents) ?? 0),
    topupTotalCents: Math.max(0, int(o.topupTotalCents) ?? 0),
    spentTotalCents: int(o.spentTotalCents) ?? 0,
    updatedAt: str(o.updatedAt, 40) || new Date(0).toISOString(),
    txns: txns.slice(-B2B_WALLET_TXN_MAX),
  };
}

export function findB2bWalletTxnByKey(wallet: B2bWallet, key: string): B2bWalletTxn | null {
  const k = key.trim();
  if (!k) return null;
  return wallet.txns.find((txn) => txn.key === k) ?? null;
}

export function findB2bWalletTxnById(wallet: B2bWallet, id: string): B2bWalletTxn | null {
  const k = id.trim();
  if (!k) return null;
  return wallet.txns.find((txn) => txn.id === k) ?? null;
}

let txnSeq = 0;

export function newB2bWalletTxnId(now: Date): string {
  txnSeq = (txnSeq + 1) % 1_000_000;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `wtx_${now.getTime()}_${txnSeq}_${rnd}`;
}

function pushTxn(wallet: B2bWallet, txn: B2bWalletTxn, patch: Partial<B2bWallet>, now: Date): B2bWallet {
  return {
    ...wallet,
    ...patch,
    version: 1,
    updatedAt: now.toISOString(),
    txns: [...wallet.txns, txn].slice(-B2B_WALLET_TXN_MAX),
  };
}

export function topupKey(sessionId: string): string {
  return `topup:${sessionId.trim()}`;
}

export function applyB2bWalletTopup(
  wallet: B2bWallet,
  args: { amountCents: number; sessionId: string; now?: Date },
): { applied: boolean; wallet: B2bWallet; txn: B2bWalletTxn | null } {
  const now = args.now ?? new Date();
  const key = topupKey(args.sessionId);
  const existing = findB2bWalletTxnByKey(wallet, key);
  if (existing) return { applied: false, wallet, txn: existing };
  const amount = Math.round(args.amountCents);
  if (!Number.isFinite(amount) || amount <= 0) return { applied: false, wallet, txn: null };
  const balanceCents = wallet.balanceCents + amount;
  const txn: B2bWalletTxn = {
    id: newB2bWalletTxnId(now),
    kind: "topup",
    amountCents: amount,
    balanceAfterCents: balanceCents,
    at: now.toISOString(),
    key,
    sessionId: args.sessionId.trim(),
  };
  return {
    applied: true,
    txn,
    wallet: pushTxn(wallet, txn, { balanceCents, topupTotalCents: wallet.topupTotalCents + amount }, now),
  };
}

export type B2bWalletPurchaseResult =
  | { ok: true; duplicate: boolean; wallet: B2bWallet; txn: B2bWalletTxn }
  | { ok: false; reason: "insufficient"; balanceCents: number; priceCents: number };

export function purchaseKey(idempotencyKey: string): string {
  return `purchase:${idempotencyKey.trim()}`;
}

/** Noraksta cenu tikai, ja atlikums pietiek. Atkārtots tas pats pieprasījums neiekasē otrreiz. */
export function applyB2bWalletPurchase(
  wallet: B2bWallet,
  args: { product: B2bWalletProductId; priceCents: number; idempotencyKey: string; vin: string; now?: Date },
): B2bWalletPurchaseResult {
  const now = args.now ?? new Date();
  const key = purchaseKey(args.idempotencyKey);
  const existing = findB2bWalletTxnByKey(wallet, key);
  if (existing) return { ok: true, duplicate: true, wallet, txn: existing };
  const price = Math.round(args.priceCents);
  if (!Number.isFinite(price) || price <= 0 || wallet.balanceCents < price) {
    return { ok: false, reason: "insufficient", balanceCents: wallet.balanceCents, priceCents: price };
  }
  const balanceCents = wallet.balanceCents - price;
  const txn: B2bWalletTxn = {
    id: newB2bWalletTxnId(now),
    kind: "purchase",
    amountCents: -price,
    balanceAfterCents: balanceCents,
    at: now.toISOString(),
    key,
    product: args.product,
    vin: args.vin,
  };
  return {
    ok: true,
    duplicate: false,
    txn,
    wallet: pushTxn(wallet, txn, { balanceCents, spentTotalCents: wallet.spentTotalCents + price }, now),
  };
}

/** Vairāku VIN pirkuma atslēga: katram VIN sava, lai atkārtots pieprasījums neiekasē otrreiz. */
export function bulkPurchaseItemKey(bulkKey: string, vin: string): string {
  return `${bulkKey.trim()}:${vin.trim().toUpperCase()}`;
}

export type B2bWalletBulkItem = {
  vin: string;
  /** Jau pasūtīts agrāk un partneris nav izvēlējies pasūtīt atkārtoti. */
  skip?: boolean;
};

export type B2bWalletBulkPurchaseResult =
  | {
      ok: true;
      wallet: B2bWallet;
      charged: { vin: string; txn: B2bWalletTxn }[];
      duplicates: { vin: string; txn: B2bWalletTxn }[];
      skipped: string[];
    }
  | { ok: false; reason: "insufficient"; balanceCents: number; needCents: number; count: number };

/**
 * Noraksta cenu par katru jauno VIN vienā atomārā solī: vai nu visi jaunie, vai neviens.
 * VIN, kuru atslēga jau ir makā, atgriež kā dublikātus (bez otrreizējas iekasēšanas).
 */
export function applyB2bWalletBulkPurchase(
  wallet: B2bWallet,
  args: {
    product: B2bWalletProductId;
    priceCents: number;
    bulkKey: string;
    items: readonly B2bWalletBulkItem[];
    now?: Date;
  },
): B2bWalletBulkPurchaseResult {
  const now = args.now ?? new Date();
  const price = Math.round(args.priceCents);
  const duplicates: { vin: string; txn: B2bWalletTxn }[] = [];
  const skipped: string[] = [];
  const fresh: string[] = [];
  const seen = new Set<string>();
  for (const item of args.items) {
    const vin = item.vin.trim().toUpperCase();
    if (!vin || seen.has(vin)) continue;
    seen.add(vin);
    const existing = findB2bWalletTxnByKey(wallet, purchaseKey(bulkPurchaseItemKey(args.bulkKey, vin)));
    if (existing) duplicates.push({ vin, txn: existing });
    else if (item.skip) skipped.push(vin);
    else fresh.push(vin);
  }
  const needCents = price * fresh.length;
  if (fresh.length > 0 && (!Number.isFinite(price) || price <= 0 || wallet.balanceCents < needCents)) {
    return { ok: false, reason: "insufficient", balanceCents: wallet.balanceCents, needCents, count: fresh.length };
  }
  let next = wallet;
  const charged: { vin: string; txn: B2bWalletTxn }[] = [];
  for (const vin of fresh) {
    const r = applyB2bWalletPurchase(next, {
      product: args.product,
      priceCents: price,
      idempotencyKey: bulkPurchaseItemKey(args.bulkKey, vin),
      vin,
      now,
    });
    if (!r.ok) {
      return { ok: false, reason: "insufficient", balanceCents: wallet.balanceCents, needCents, count: fresh.length };
    }
    next = r.wallet;
    charged.push({ vin, txn: r.txn });
  }
  return { ok: true, wallet: next, charged, duplicates, skipped };
}

export function attachB2bWalletTopupInvoice(
  wallet: B2bWallet,
  args: { sessionId: string; invoiceNumber: string },
): B2bWallet {
  const sessionId = args.sessionId.trim();
  const invoiceNumber = args.invoiceNumber.trim().slice(0, 40);
  if (!sessionId || !invoiceNumber) return wallet;
  let changed = false;
  const txns = wallet.txns.map((txn) => {
    if (txn.kind !== "topup" || txn.sessionId !== sessionId || txn.invoiceNumber === invoiceNumber) return txn;
    changed = true;
    return { ...txn, invoiceNumber };
  });
  return changed ? { ...wallet, txns } : wallet;
}

export function attachB2bWalletPurchaseOrder(wallet: B2bWallet, txnId: string, orderId: string): B2bWallet {
  let changed = false;
  const txns = wallet.txns.map((txn) => {
    if (txn.id !== txnId || txn.orderId === orderId) return txn;
    changed = true;
    return { ...txn, orderId };
  });
  return changed ? { ...wallet, txns } : wallet;
}

export function refundKey(purchaseTxnId: string): string {
  return `refund:${purchaseTxnId.trim()}`;
}

export function applyB2bWalletRefund(
  wallet: B2bWallet,
  args: { purchaseTxnId: string; note?: string; now?: Date },
): { applied: boolean; wallet: B2bWallet; txn: B2bWalletTxn | null } {
  const now = args.now ?? new Date();
  const key = refundKey(args.purchaseTxnId);
  const existing = findB2bWalletTxnByKey(wallet, key);
  if (existing) return { applied: false, wallet, txn: existing };
  const purchase = findB2bWalletTxnById(wallet, args.purchaseTxnId);
  if (!purchase || purchase.kind !== "purchase") return { applied: false, wallet, txn: null };
  const amount = Math.abs(purchase.amountCents);
  const balanceCents = wallet.balanceCents + amount;
  const txn: B2bWalletTxn = {
    id: newB2bWalletTxnId(now),
    kind: "refund",
    amountCents: amount,
    balanceAfterCents: balanceCents,
    at: now.toISOString(),
    key,
    refundOf: purchase.id,
    ...(purchase.product ? { product: purchase.product } : {}),
    ...(purchase.vin ? { vin: purchase.vin } : {}),
    ...(purchase.orderId ? { orderId: purchase.orderId } : {}),
    ...(args.note?.trim() ? { note: args.note.trim().slice(0, 300) } : {}),
  };
  return {
    applied: true,
    txn,
    wallet: pushTxn(wallet, txn, { balanceCents, spentTotalCents: wallet.spentTotalCents - amount }, now),
  };
}

export type B2bWalletAdjustResult =
  | { ok: true; duplicate: boolean; wallet: B2bWallet; txn: B2bWalletTxn }
  | { ok: false; reason: "zero" | "negative_balance" | "note_required" };

/** Admin korekcija ar piezīmi (piem. manuāla atmaksa). Atlikums nevar kļūt negatīvs. */
export function applyB2bWalletAdjust(
  wallet: B2bWallet,
  args: { amountCents: number; note: string; key: string; now?: Date },
): B2bWalletAdjustResult {
  const now = args.now ?? new Date();
  const key = `adjust:${args.key.trim()}`;
  const existing = findB2bWalletTxnByKey(wallet, key);
  if (existing) return { ok: true, duplicate: true, wallet, txn: existing };
  const note = args.note.trim().slice(0, 300);
  if (!note) return { ok: false, reason: "note_required" };
  const amount = Math.round(args.amountCents);
  if (!Number.isFinite(amount) || amount === 0) return { ok: false, reason: "zero" };
  const balanceCents = wallet.balanceCents + amount;
  if (balanceCents < 0) return { ok: false, reason: "negative_balance" };
  const txn: B2bWalletTxn = {
    id: newB2bWalletTxnId(now),
    kind: "adjust",
    amountCents: amount,
    balanceAfterCents: balanceCents,
    at: now.toISOString(),
    key,
    note,
  };
  return { ok: true, duplicate: false, txn, wallet: pushTxn(wallet, txn, { balanceCents }, now) };
}

export type B2bWalletSummary = {
  balanceCents: number;
  topupTotalCents: number;
  spentTotalCents: number;
};

export function summarizeB2bWallet(wallet: B2bWallet): B2bWalletSummary {
  return {
    balanceCents: wallet.balanceCents,
    topupTotalCents: wallet.topupTotalCents,
    spentTotalCents: wallet.spentTotalCents,
  };
}

/** Pasūtījuma piezīmju atzīmes maka pirkumam (partneris, darījums, produkts). */
const WALLET_TXN_RE = /wallet_txn=(wtx_[a-z0-9_]+)/i;
const WALLET_PRODUCT_RE = /wallet_product=(business|dealer_raw|dealer_pro)/i;
const WALLET_CENTS_RE = /wallet_cents=(\d{1,7})/i;
const REPORT_LANG_RE = /report_lang=(lv|ru|en|de)\b/i;

export type B2bWalletOrderMarks = {
  txnId: string;
  product: B2bWalletProductId;
  priceCents: number | null;
  reportLang: B2bWalletReportLang | null;
};

export function buildB2bWalletOrderNoteParts(args: {
  txnId: string;
  product: B2bWalletProductId;
  priceCents: number;
  reportLang?: B2bWalletReportLang | null;
}): string[] {
  const parts = [
    `wallet_txn=${args.txnId}`,
    `wallet_product=${args.product}`,
    `wallet_cents=${Math.round(args.priceCents)}`,
  ];
  if (args.reportLang) parts.push(`report_lang=${args.reportLang}`);
  return parts;
}

export function parseB2bWalletOrderMarks(notes: string | null | undefined): B2bWalletOrderMarks | null {
  const text = notes ?? "";
  const txn = text.match(WALLET_TXN_RE)?.[1];
  const product = text.match(WALLET_PRODUCT_RE)?.[1]?.toLowerCase();
  if (!txn || !isB2bWalletProductId(product)) return null;
  const cents = text.match(WALLET_CENTS_RE)?.[1];
  const lang = text.match(REPORT_LANG_RE)?.[1]?.toLowerCase();
  return {
    txnId: txn,
    product,
    priceCents: cents ? Number.parseInt(cents, 10) : null,
    reportLang: isB2bWalletReportLang(lang) ? lang : null,
  };
}

/** Vai dīlera ielases rezultāts prasa automātisku atmaksu makā. */
export function shouldAutoRefundB2bWalletOrder(args: {
  notes: string | null | undefined;
  dealerJobStatus: string | null | undefined;
}): B2bWalletOrderMarks | null {
  if (args.dealerJobStatus !== "no_data") return null;
  const marks = parseB2bWalletOrderMarks(args.notes);
  if (!marks) return null;
  return B2B_WALLET_PRODUCTS[marks.product].refundOnNoData ? marks : null;
}
