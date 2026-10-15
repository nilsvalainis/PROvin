import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { vinAnchorsFromRecord, type IrissVinAnchor } from "@/lib/iriss-vin-duplicates";
import {
  getIrissPasutijumiBlobConfig,
  getIrissPasutijumiStorageDir,
  isIrissPasutijumiStoreEnabled,
  listIrissPasutijumi,
  readIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const FILENAME = "_vin-anchors.json";
const MAX_ANCHORS = 20_000;

type AnchorFile = { version: 1; updatedAt: string; anchors: IrissVinAnchor[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseAnchors(raw: unknown): IrissVinAnchor[] | null {
  if (!isObj(raw) || !Array.isArray(raw.anchors)) return null;
  const out: IrissVinAnchor[] = [];
  for (const item of raw.anchors) {
    if (!isObj(item)) continue;
    const vin = typeof item.vin === "string" ? item.vin.trim() : "";
    const orderId = typeof item.orderId === "string" ? item.orderId.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const href = typeof item.href === "string" ? item.href.trim() : "";
    const kind = item.kind === "offer" || item.kind === "order" ? item.kind : null;
    if (!vin || !orderId || !label || !kind) continue;
    const offerId = typeof item.offerId === "string" ? item.offerId.trim() : "";
    out.push({ vin, kind, orderId, label, href, ...(offerId ? { offerId } : {}) });
    if (out.length >= MAX_ANCHORS) break;
  }
  return out;
}

async function readFileAnchors(): Promise<IrissVinAnchor[] | null> {
  if (!isIrissPasutijumiStoreEnabled()) return [];
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    const got = await get(`${blob.prefix}${FILENAME}`, { access: "private", token: blob.token, useCache: false });
    if (!got || got.statusCode !== 200 || !got.stream) return null;
    try {
      return parseAnchors(JSON.parse(await new Response(got.stream).text()) as unknown);
    } catch {
      return null;
    }
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return [];
  try {
    const txt = await fs.readFile(path.join(dir, FILENAME), "utf8");
    return parseAnchors(JSON.parse(txt) as unknown);
  } catch {
    return null;
  }
}

async function writeFileAnchors(anchors: IrissVinAnchor[]): Promise<void> {
  const body: AnchorFile = { version: 1, updatedAt: new Date().toISOString(), anchors: anchors.slice(0, MAX_ANCHORS) };
  const json = JSON.stringify(body);
  const blob = getIrissPasutijumiBlobConfig();
  if (blob) {
    await put(`${blob.prefix}${FILENAME}`, json, {
      access: "private",
      token: blob.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const dir = getIrissPasutijumiStorageDir();
  if (!dir) return;
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, FILENAME);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, fp);
}

async function rebuildAnchors(): Promise<IrissVinAnchor[]> {
  const rows = await listIrissPasutijumi({ includeDeleted: true }).catch(() => []);
  const anchors: IrissVinAnchor[] = [];
  for (const row of rows) {
    const rec = await readIrissPasutijums(row.id).catch(() => null);
    if (!rec) continue;
    anchors.push(...vinAnchorsFromRecord(rec));
    if (anchors.length >= MAX_ANCHORS) break;
  }
  await writeFileAnchors(anchors);
  return anchors;
}

/** Pasūtījumu un piedāvājumu VIN. Pirmā reize nolasa ierakstus, pēc tam tikai mazo indeksu. */
export async function listIrissVinAnchors(): Promise<IrissVinAnchor[]> {
  if (!isIrissPasutijumiStoreEnabled()) return [];
  const cached = await readFileAnchors();
  if (cached) return cached;
  try {
    return await rebuildAnchors();
  } catch {
    return [];
  }
}

export async function upsertIrissVinAnchorsForRecord(rec: IrissPasutijumsRecord): Promise<void> {
  const cached = await readFileAnchors();
  if (!cached) return;
  const next = cached.filter((a) => a.orderId !== rec.id).concat(vinAnchorsFromRecord(rec));
  await writeFileAnchors(next);
}
