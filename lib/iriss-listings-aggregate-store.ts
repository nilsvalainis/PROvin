import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type IrissListingAggregateItem,
  type IrissListingSyncRunSummary,
  type IrissListingsLatestView,
  type IrissListingsSnapshot,
  type IrissListingsStorageState,
} from "@/lib/iriss-listings-types";

const DEFAULT_RELATIVE_DIR = ".data/iriss-sludinajumi";
const DEFAULT_BLOB_PREFIX = "iriss-sludinajumi/";
const LATEST_FILENAME = "latest.json";
const SNAPSHOTS_DIRNAME = "snapshots";

type ResolvedStorage =
  | { kind: "disabled"; reason: "explicit_off" | "vercel_without_blob_token" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

let resolvedMemo: ResolvedStorage | null = null;

function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function computeResolvedStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_LISTINGS_DIR?.trim() ?? "";
  const off = new Set(["0", "false", "no", "off", "disabled"]);
  if (off.has(raw.toLowerCase())) {
    return { kind: "disabled", reason: "explicit_off" };
  }
  if (raw) {
    return { kind: "fs", dir: path.resolve(raw) };
  }

  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) return { kind: "disabled", reason: "vercel_without_blob_token" };
    return {
      kind: "blob",
      token,
      prefix: process.env.ADMIN_IRISS_LISTINGS_BLOB_PREFIX?.trim() || DEFAULT_BLOB_PREFIX,
    };
  }

  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-sludinajumi") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

function resolveStorage(): ResolvedStorage {
  if (!resolvedMemo) resolvedMemo = computeResolvedStorage();
  return resolvedMemo;
}

function fsLatestPath(dir: string): string {
  return path.join(dir, LATEST_FILENAME);
}

function fsSnapshotPath(dir: string, runId: string): string {
  return path.join(dir, SNAPSHOTS_DIRNAME, `${runId}.json`);
}

function blobLatestPath(prefix: string): string {
  return `${prefix}${LATEST_FILENAME}`;
}

function blobSnapshotPath(prefix: string, runId: string): string {
  return `${prefix}${SNAPSHOTS_DIRNAME}/${runId}.json`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizePrice(v: unknown): { value: string; currency: string } | null {
  if (!isObj(v)) return null;
  const value = str(v.value);
  const currency = str(v.currency);
  if (!value || !currency) return null;
  return { value, currency };
}

function normalizeItem(v: unknown): IrissListingAggregateItem | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const aggregatedAt = str(v.aggregatedAt);
  const sourcePlatform = str(v.sourcePlatform);
  const sourceUrl = str(v.sourceUrl);
  const sourceDomain = str(v.sourceDomain);
  const orderId = str(v.orderId);
  const orderBrandModel = str(v.orderBrandModel);
  const title = str(v.title);
  const year = str(v.year);
  const imageUrl = str(v.imageUrl);
  const rawSnapshotRef = str(v.rawSnapshotRef);
  const status = str(v.status);
  const statusNote = str(v.statusNote);
  if (
    !id ||
    !aggregatedAt ||
    !sourceUrl ||
    !orderId ||
    !sourceDomain ||
    !rawSnapshotRef ||
    !["mobile", "autobid", "openline", "auto1", "other"].includes(sourcePlatform) ||
    !["ok", "login_required", "parse_failed", "fetch_failed"].includes(status)
  ) {
    return null;
  }

  return {
    id,
    aggregatedAt,
    sourcePlatform: sourcePlatform as IrissListingAggregateItem["sourcePlatform"],
    sourceUrl,
    sourceDomain,
    orderId,
    orderBrandModel,
    title,
    year,
    imageUrl,
    pricePrimary: normalizePrice(v.pricePrimary),
    priceSecondary: normalizePrice(v.priceSecondary),
    rawSnapshotRef,
    status: status as IrissListingAggregateItem["status"],
    statusNote,
  };
}

function normalizeSummary(v: unknown): IrissListingSyncRunSummary | null {
  if (!isObj(v)) return null;
  const startedAt = str(v.startedAt);
  const finishedAt = str(v.finishedAt);
  const runId = str(v.runId);
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.trunc(x)) : 0);
  if (!startedAt || !finishedAt || !runId) return null;
  return {
    startedAt,
    finishedAt,
    runId,
    totalSources: n(v.totalSources),
    okCount: n(v.okCount),
    loginRequiredCount: n(v.loginRequiredCount),
    parseFailedCount: n(v.parseFailedCount),
    fetchFailedCount: n(v.fetchFailedCount),
  };
}

function normalizeLatest(raw: unknown): IrissListingsLatestView | null {
  if (!isObj(raw)) return null;
  const version = raw.version === 1 ? 1 : null;
  const generatedAt = str(raw.generatedAt);
  const summary = normalizeSummary(raw.summary);
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter((x): x is IrissListingAggregateItem => x !== null) : [];
  if (!version || !generatedAt || !summary) return null;
  items.sort((a, b) => (a.aggregatedAt < b.aggregatedAt ? 1 : a.aggregatedAt > b.aggregatedAt ? -1 : 0));
  return { version, generatedAt, summary, items };
}

async function readBlobJson(pathname: string, token: string): Promise<unknown | null> {
  const got = await get(pathname, { access: "private", token, useCache: false });
  if (!got?.stream || got.statusCode !== 200) return null;
  try {
    return JSON.parse(await new Response(got.stream).text()) as unknown;
  } catch {
    return null;
  }
}

export function getIrissListingsStorageState(): IrissListingsStorageState {
  const r = resolveStorage();
  if (r.kind === "disabled") {
    return {
      enabled: false,
      reason: r.reason === "vercel_without_blob_token" ? "vercel_blob_token_missing" : "explicit_off",
    };
  }
  if (r.kind === "blob") return { enabled: true, persistence: "vercel_blob" };
  return { enabled: true, persistence: "filesystem", path: r.dir };
}

export async function readIrissListingsLatestView(): Promise<IrissListingsLatestView | null> {
  const r = resolveStorage();
  if (r.kind === "disabled") return null;
  if (r.kind === "blob") {
    return normalizeLatest(await readBlobJson(blobLatestPath(r.prefix), r.token));
  }
  try {
    const txt = await fs.readFile(fsLatestPath(r.dir), "utf8");
    return normalizeLatest(JSON.parse(txt) as unknown);
  } catch {
    return null;
  }
}

export async function writeIrissListingsRun(payload: {
  generatedAt: string;
  runId: string;
  summary: IrissListingSyncRunSummary;
  items: IrissListingAggregateItem[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = resolveStorage();
    if (r.kind === "disabled") return { ok: false, error: "store_disabled" };

    const items = [...payload.items].sort((a, b) => (a.aggregatedAt < b.aggregatedAt ? 1 : a.aggregatedAt > b.aggregatedAt ? -1 : 0));
    const latest: IrissListingsLatestView = {
      version: 1,
      generatedAt: payload.generatedAt,
      summary: payload.summary,
      items,
    };
    const snapshot: IrissListingsSnapshot = {
      version: 1,
      generatedAt: payload.generatedAt,
      summary: payload.summary,
      items,
    };
    const latestBody = JSON.stringify(latest, null, 2);
    const snapshotBody = JSON.stringify(snapshot, null, 2);

    if (r.kind === "blob") {
      await put(blobLatestPath(r.prefix), latestBody, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      await put(blobSnapshotPath(r.prefix, payload.runId), snapshotBody, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true };
    }

    await fs.mkdir(path.join(r.dir, SNAPSHOTS_DIRNAME), { recursive: true });
    await fs.writeFile(fsLatestPath(r.dir), latestBody, "utf8");
    await fs.writeFile(fsSnapshotPath(r.dir, payload.runId), snapshotBody, "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
