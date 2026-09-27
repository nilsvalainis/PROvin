import "server-only";

import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  getOrderDraftBlobConfig,
  getOrderDraftStorageDir,
  isSafeOrderDraftSessionId,
} from "@/lib/admin-order-draft-store";
import {
  isOrderUpsellKind,
  isUpsellToken,
  UPSELL_LINK_TTL_MS,
  type OrderUpsellKind,
  type OrderUpsellStatus,
  type OrderUpsellTargetLine,
  type UpsellOfferSnapshot,
  type UpsellQuote,
} from "@/lib/order-upsell";

const OFFER_DIR = "order_upsell";
const TOKEN_DIR = "order_upsell_tokens";

export type StoredUpsellOffer = {
  token: string;
  kind: OrderUpsellKind;
  chargeCents: number;
  priorCents: number;
  targetCents: number;
  targetLine: OrderUpsellTargetLine;
  createdAt: string;
  expiresAt: string;
  status: OrderUpsellStatus;
  paidAt?: string;
  stripeSessionId?: string;
};

type SessionUpsellDoc = {
  parentSessionId: string;
  offers: Partial<Record<OrderUpsellKind, StoredUpsellOffer>>;
};

type TokenDoc = {
  parentSessionId: string;
  kind: OrderUpsellKind;
  token: string;
  replaced?: boolean;
};

function offerFsPath(dir: string, sessionId: string): string {
  return path.join(dir, OFFER_DIR, `${sessionId}.json`);
}

function tokenFsPath(dir: string, token: string): string {
  return path.join(dir, TOKEN_DIR, `${token}.json`);
}

function offerBlobPath(prefix: string, sessionId: string): string {
  return `${prefix}${OFFER_DIR}/${sessionId}.json`;
}

function tokenBlobPath(prefix: string, token: string): string {
  return `${prefix}${TOKEN_DIR}/${token}.json`;
}

async function readJson(fsPath: string | null, blobPath: string | null): Promise<unknown | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob && blobPath) {
    try {
      const res = await get(blobPath, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return JSON.parse(await new Response(res.stream).text()) as unknown;
      }
    } catch {
      /* fall through */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && fsPath && process.env.VERCEL !== "1") {
    try {
      return JSON.parse(await fs.readFile(fsPath, "utf8")) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

async function writeJson(fsPath: string | null, blobPath: string | null, doc: unknown): Promise<boolean> {
  const raw = JSON.stringify(doc);
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  if (!dir && !blob) return false;
  if (process.env.VERCEL === "1" && !blob) return false;

  let fsOk = false;
  let blobOk = false;
  if (dir && fsPath && process.env.VERCEL !== "1") {
    try {
      await fs.mkdir(path.dirname(fsPath), { recursive: true });
      const tmp = `${fsPath}.tmp`;
      await fs.writeFile(tmp, raw, "utf8");
      await fs.rename(tmp, fsPath);
      fsOk = true;
    } catch {
      fsOk = false;
    }
  }
  if (blob && blobPath) {
    try {
      await put(blobPath, raw, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      blobOk = true;
    } catch {
      blobOk = false;
    }
  }
  if (process.env.VERCEL === "1") return blobOk;
  return fsOk || blobOk;
}

function parseOffer(raw: unknown, kind: OrderUpsellKind): StoredUpsellOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== kind || !isUpsellToken(String(o.token ?? ""))) return null;
  const status = o.status === "paid" || o.status === "manual" || o.status === "open" ? o.status : null;
  const targetLine = o.targetLine === "audit" || o.targetLine === "mini" || o.targetLine === "dealer" ? o.targetLine : null;
  const chargeCents = Number(o.chargeCents);
  const priorCents = Number(o.priorCents);
  const targetCents = Number(o.targetCents);
  if (!status || !targetLine) return null;
  if (![chargeCents, priorCents, targetCents].every((n) => Number.isFinite(n) && n >= 0)) return null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt : "";
  if (!createdAt || !expiresAt) return null;
  return {
    token: String(o.token),
    kind,
    chargeCents,
    priorCents,
    targetCents,
    targetLine,
    createdAt,
    expiresAt,
    status,
    ...(typeof o.paidAt === "string" && o.paidAt ? { paidAt: o.paidAt } : {}),
    ...(typeof o.stripeSessionId === "string" && o.stripeSessionId ? { stripeSessionId: o.stripeSessionId } : {}),
  };
}

function parseDoc(raw: unknown, sessionId: string): SessionUpsellDoc {
  const empty: SessionUpsellDoc = { parentSessionId: sessionId, offers: {} };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const offersRaw = o.offers && typeof o.offers === "object" ? (o.offers as Record<string, unknown>) : {};
  const offers: SessionUpsellDoc["offers"] = {};
  for (const kind of ["dealer_to_audit", "mini_to_dealer", "mini_to_audit"] as const) {
    const parsed = parseOffer(offersRaw[kind], kind);
    if (parsed) offers[kind] = parsed;
  }
  return { parentSessionId: sessionId, offers };
}

export function toOfferSnapshot(offer: StoredUpsellOffer): UpsellOfferSnapshot {
  return {
    kind: offer.kind,
    status: offer.status,
    chargeCents: offer.chargeCents,
    priorCents: offer.priorCents,
    targetCents: offer.targetCents,
    targetLine: offer.targetLine,
    paidAt: offer.paidAt ?? null,
    expiresAt: offer.expiresAt,
    token: offer.token,
  };
}

export async function readSessionUpsellDoc(sessionId: string): Promise<SessionUpsellDoc | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const raw = await readJson(
    dir ? offerFsPath(dir, sessionId) : null,
    blob ? offerBlobPath(blob.prefix, sessionId) : null,
  );
  if (!raw) return null;
  return parseDoc(raw, sessionId);
}

async function writeSessionDoc(doc: SessionUpsellDoc): Promise<boolean> {
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  return writeJson(
    dir ? offerFsPath(dir, doc.parentSessionId) : null,
    blob ? offerBlobPath(blob.prefix, doc.parentSessionId) : null,
    doc,
  );
}

async function writeToken(doc: TokenDoc): Promise<boolean> {
  if (!isUpsellToken(doc.token) || !isSafeOrderDraftSessionId(doc.parentSessionId)) return false;
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  return writeJson(
    dir ? tokenFsPath(dir, doc.token) : null,
    blob ? tokenBlobPath(blob.prefix, doc.token) : null,
    doc,
  );
}

export async function readUpsellByToken(token: string): Promise<
  | { state: "replaced" }
  | { state: "missing" }
  | { state: "ok"; parentSessionId: string; offer: StoredUpsellOffer }
> {
  if (!isUpsellToken(token)) return { state: "missing" };
  const dir = getOrderDraftStorageDir();
  const blob = getOrderDraftBlobConfig();
  const raw = await readJson(
    dir ? tokenFsPath(dir, token) : null,
    blob ? tokenBlobPath(blob.prefix, token) : null,
  );
  if (!raw || typeof raw !== "object") return { state: "missing" };
  const t = raw as Record<string, unknown>;
  const parentSessionId = typeof t.parentSessionId === "string" ? t.parentSessionId : "";
  const kindRaw = typeof t.kind === "string" ? t.kind : "";
  if (!isSafeOrderDraftSessionId(parentSessionId) || !isOrderUpsellKind(kindRaw)) return { state: "missing" };
  if (t.replaced === true) return { state: "replaced" };
  const doc = await readSessionUpsellDoc(parentSessionId);
  const offer = doc?.offers[kindRaw];
  if (!offer || offer.token !== token) return { state: "replaced" };
  return { state: "ok", parentSessionId, offer };
}

export async function openUpsellOffer(sessionId: string, quote: UpsellQuote, nowMs = Date.now()): Promise<
  | { ok: true; offer: StoredUpsellOffer }
  | { ok: false; error: string }
> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  const existing = (await readSessionUpsellDoc(sessionId)) ?? { parentSessionId: sessionId, offers: {} };
  const prev = existing.offers[quote.kind];
  if (prev && (prev.status === "paid" || prev.status === "manual")) {
    return { ok: false, error: "already_settled" };
  }
  const nowIso = new Date(nowMs).toISOString();
  const reuse = prev && prev.status === "open" && Date.parse(prev.expiresAt) > nowMs ? prev.token : randomBytes(16).toString("hex");
  const offer: StoredUpsellOffer = {
    token: reuse,
    kind: quote.kind,
    chargeCents: quote.chargeCents,
    priorCents: quote.priorCents,
    targetCents: quote.targetCents,
    targetLine: quote.targetLine,
    createdAt: prev && reuse === prev.token ? prev.createdAt : nowIso,
    expiresAt: new Date(nowMs + UPSELL_LINK_TTL_MS).toISOString(),
    status: "open",
  };
  if (prev && prev.token !== offer.token) {
    const marked = await writeToken({
      parentSessionId: sessionId,
      kind: quote.kind,
      token: prev.token,
      replaced: true,
    });
    if (!marked) return { ok: false, error: "store_failed" };
  }
  const tokenOk = await writeToken({ parentSessionId: sessionId, kind: quote.kind, token: offer.token });
  if (!tokenOk) return { ok: false, error: "store_failed" };
  const next: SessionUpsellDoc = {
    parentSessionId: sessionId,
    offers: { ...existing.offers, [quote.kind]: offer },
  };
  const saved = await writeSessionDoc(next);
  if (!saved) return { ok: false, error: "store_failed" };
  return { ok: true, offer };
}

export async function settleUpsellOffer(args: {
  sessionId: string;
  kind: OrderUpsellKind;
  status: "paid" | "manual";
  stripeSessionId?: string;
  paidAt?: string;
}): Promise<{ ok: true; offer: StoredUpsellOffer } | { ok: false; error: string }> {
  if (!isSafeOrderDraftSessionId(args.sessionId)) return { ok: false, error: "invalid_session" };
  const doc = await readSessionUpsellDoc(args.sessionId);
  const prev = doc?.offers[args.kind];
  if (!prev) return { ok: false, error: "missing_offer" };
  if ((prev.status === "paid" || prev.status === "manual") && prev.stripeSessionId && args.stripeSessionId === prev.stripeSessionId) {
    return { ok: true, offer: prev };
  }
  if (prev.status === "paid" || prev.status === "manual") {
    return { ok: false, error: "already_settled" };
  }
  const offer: StoredUpsellOffer = {
    ...prev,
    status: args.status,
    paidAt: args.paidAt ?? new Date().toISOString(),
    ...(args.stripeSessionId ? { stripeSessionId: args.stripeSessionId } : {}),
  };
  const saved = await writeSessionDoc({
    parentSessionId: args.sessionId,
    offers: { ...doc!.offers, [args.kind]: offer },
  });
  if (!saved) return { ok: false, error: "store_failed" };
  return { ok: true, offer };
}

export async function readUpsellDisplayOffers(sessionIds: string[]): Promise<Map<string, UpsellOfferSnapshot[]>> {
  const out = new Map<string, UpsellOfferSnapshot[]>();
  const ids = sessionIds.filter(isSafeOrderDraftSessionId);
  await Promise.all(
    ids.map(async (id) => {
      const doc = await readSessionUpsellDoc(id);
      const offers = doc ? Object.values(doc.offers).filter((o): o is StoredUpsellOffer => Boolean(o)).map(toOfferSnapshot) : [];
      out.set(id, offers);
    }),
  );
  return out;
}
