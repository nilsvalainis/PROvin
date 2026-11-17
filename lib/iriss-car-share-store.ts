import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mutateLogisticsJsonFile, readLogisticsJsonFile } from "@/lib/iriss-logistics-store";
import { isSafeIrissCarShareToken, type IrissCarShareChannel, type IrissCarShareStatus } from "@/lib/iriss-car-share";

export const IRISS_CAR_SHARE_FILE = "car-share-links.json";

export type IrissCarShareRecord = {
  tokenHash: string;
  token: string;
  autoparksCarId: string;
  logisticsOrderId: string;
  vin: string;
  createdAt: string;
  sentAt: string;
  sentByName: string;
  sentChannel: IrissCarShareChannel | "";
  clientName: string;
};

type Store = { version: 1; links: IrissCarShareRecord[] };

const HASH_RE = /^[a-f0-9]{64}$/;

function emptyStore(): Store {
  return { version: 1, links: [] };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function newIrissCarShareToken(): string {
  return randomBytes(8).toString("base64url");
}

function isIso(value: string): boolean {
  return Boolean(value.trim()) && Number.isFinite(Date.parse(value));
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parseRecord(raw: unknown): IrissCarShareRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const token = str(o.token, 64);
  const tokenHash = str(o.tokenHash, 64).toLowerCase();
  if (!isSafeIrissCarShareToken(token) || !HASH_RE.test(tokenHash)) return null;
  const createdAt = str(o.createdAt, 40);
  if (!isIso(createdAt)) return null;
  const sentAt = str(o.sentAt, 40);
  if (sentAt && !isIso(sentAt)) return null;
  return {
    tokenHash,
    token,
    autoparksCarId: str(o.autoparksCarId, 80),
    logisticsOrderId: str(o.logisticsOrderId, 80),
    vin: str(o.vin, 32).toUpperCase(),
    createdAt,
    sentAt,
    sentByName: str(o.sentByName, 80),
    sentChannel: o.sentChannel === "whatsapp" ? "whatsapp" : "",
    clientName: str(o.clientName, 80),
  };
}

function parseStore(raw: unknown): Store {
  if (!raw || typeof raw !== "object") return emptyStore();
  const o = raw as Record<string, unknown>;
  const links = Array.isArray(o.links) ? o.links.map(parseRecord).filter((x): x is IrissCarShareRecord => Boolean(x)) : [];
  return { version: 1, links };
}

export function irissCarShareStatusOf(rec: IrissCarShareRecord): IrissCarShareStatus {
  return rec.sentAt.trim() ? "sent" : "created";
}

function matchRecord(
  rec: IrissCarShareRecord,
  keys: { autoparksCarId?: string; logisticsOrderId?: string; vin?: string },
): boolean {
  if (keys.autoparksCarId && rec.autoparksCarId === keys.autoparksCarId) return true;
  if (keys.logisticsOrderId && rec.logisticsOrderId === keys.logisticsOrderId) return true;
  const vin = (keys.vin ?? "").trim().toUpperCase();
  return Boolean(vin && vin.length >= 11 && rec.vin === vin);
}

export async function readIrissCarShareByToken(token: string): Promise<IrissCarShareRecord | null> {
  if (!isSafeIrissCarShareToken(token)) return null;
  const store = parseStore(await readLogisticsJsonFile(IRISS_CAR_SHARE_FILE));
  const hash = hashToken(token);
  return store.links.find((r) => r.tokenHash === hash) ?? null;
}

export async function readIrissCarShareByKeys(keys: {
  autoparksCarId?: string;
  logisticsOrderId?: string;
  vin?: string;
}): Promise<IrissCarShareRecord | null> {
  const store = parseStore(await readLogisticsJsonFile(IRISS_CAR_SHARE_FILE));
  return store.links.find((r) => matchRecord(r, keys)) ?? null;
}

export async function ensureIrissCarShare(input: {
  autoparksCarId?: string;
  logisticsOrderId?: string;
  vin?: string;
  clientName?: string;
}): Promise<IrissCarShareRecord> {
  return mutateLogisticsJsonFile(IRISS_CAR_SHARE_FILE, (raw) => {
    const store = parseStore(raw);
    const existing = store.links.find((r) =>
      matchRecord(r, {
        autoparksCarId: input.autoparksCarId,
        logisticsOrderId: input.logisticsOrderId,
        vin: input.vin,
      }),
    );
    if (existing) {
      let changed = false;
      if (input.autoparksCarId && !existing.autoparksCarId) {
        existing.autoparksCarId = input.autoparksCarId;
        changed = true;
      }
      if (input.logisticsOrderId && !existing.logisticsOrderId) {
        existing.logisticsOrderId = input.logisticsOrderId;
        changed = true;
      }
      if (input.vin && !existing.vin) {
        existing.vin = input.vin.trim().toUpperCase().slice(0, 32);
        changed = true;
      }
      if (input.clientName && !existing.clientName) {
        existing.clientName = input.clientName.trim().slice(0, 80);
        changed = true;
      }
      return { next: changed ? store : undefined, result: existing };
    }
    const token = newIrissCarShareToken();
    const record: IrissCarShareRecord = {
      tokenHash: hashToken(token),
      token,
      autoparksCarId: (input.autoparksCarId ?? "").trim().slice(0, 80),
      logisticsOrderId: (input.logisticsOrderId ?? "").trim().slice(0, 80),
      vin: (input.vin ?? "").trim().toUpperCase().slice(0, 32),
      createdAt: new Date().toISOString(),
      sentAt: "",
      sentByName: "",
      sentChannel: "",
      clientName: (input.clientName ?? "").trim().slice(0, 80),
    };
    store.links.push(record);
    return { next: store, result: record };
  });
}

export async function markIrissCarShareSent(input: {
  token: string;
  actorName: string;
  clientName?: string;
  channel?: IrissCarShareChannel;
}): Promise<IrissCarShareRecord | null> {
  if (!isSafeIrissCarShareToken(input.token)) return null;
  const hash = hashToken(input.token);
  return mutateLogisticsJsonFile(IRISS_CAR_SHARE_FILE, (raw) => {
    const store = parseStore(raw);
    const rec = store.links.find((r) => r.tokenHash === hash);
    if (!rec) return { result: null };
    rec.sentAt = rec.sentAt || new Date().toISOString();
    rec.sentChannel = input.channel ?? "whatsapp";
    rec.sentByName = input.actorName.trim().slice(0, 80);
    if (input.clientName?.trim()) rec.clientName = input.clientName.trim().slice(0, 80);
    return { next: store, result: rec };
  });
}
