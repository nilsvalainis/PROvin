import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { marketplaceMonthlyUsdCap } from "@/lib/marketplace/cost-caps";
import { buildMarketplaceUsageSummary } from "@/lib/marketplace/auto-load";
import type { IrissLimitsRowId } from "@/lib/iriss-limits-view";

export type IrissLimitsSnapshotRow = {
  id: IrissLimitsRowId;
  usedUsd: number;
  capUsd: number;
};

export type IrissLimitsSnapshot = {
  updatedAt: string;
  rows: IrissLimitsSnapshotRow[];
};

const FILENAME = "limits.json";
const DEFAULT_DIR = ".data/iriss-limits";

type Storage =
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string }
  | { kind: "disabled" };

function resolveStorage(): Storage {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (process.env.VERCEL && token) {
    return { kind: "blob", token, prefix: process.env.ADMIN_IRISS_LIMITS_BLOB_PREFIX?.trim() || "iriss-limits/" };
  }
  return { kind: "fs", dir: process.env.ADMIN_IRISS_LIMITS_DIR?.trim() || path.join(process.cwd(), DEFAULT_DIR) };
}

async function readRaw(): Promise<IrissLimitsSnapshot | null> {
  const r = resolveStorage();
  if (r.kind === "disabled") return null;
  try {
    if (r.kind === "blob") {
      const got = await get(`${r.prefix}${FILENAME}`, { access: "private", token: r.token, useCache: false });
      if (!got?.stream || got.statusCode !== 200) return null;
      return JSON.parse(await new Response(got.stream).text()) as IrissLimitsSnapshot;
    }
    return JSON.parse(await fs.readFile(path.join(r.dir, FILENAME), "utf8")) as IrissLimitsSnapshot;
  } catch {
    return null;
  }
}

export async function writeIrissLimitsSnapshot(snapshot: IrissLimitsSnapshot): Promise<void> {
  const r = resolveStorage();
  const body = JSON.stringify(snapshot);
  if (r.kind === "blob") {
    await put(`${r.prefix}${FILENAME}`, body, {
      access: "private",
      token: r.token,
      contentType: "application/json; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  if (r.kind === "fs") {
    await fs.mkdir(r.dir, { recursive: true });
    await fs.writeFile(path.join(r.dir, FILENAME), body, "utf8");
  }
}

export async function loadIrissLimitsSnapshot(): Promise<IrissLimitsSnapshot> {
  const stored = await readRaw();
  const usage = await buildMarketplaceUsageSummary().catch(() => null);
  const apify: IrissLimitsSnapshotRow = {
    id: "apify",
    usedUsd: usage?.spentUsd ?? 0,
    capUsd: usage?.monthlyCapUsd ?? marketplaceMonthlyUsdCap(),
  };
  const byId = new Map<IrissLimitsRowId, IrissLimitsSnapshotRow>();
  for (const row of stored?.rows ?? []) {
    if (row?.id === "gemini" || row?.id === "apify" || row?.id === "vercel") {
      byId.set(row.id, {
        id: row.id,
        usedUsd: Number.isFinite(row.usedUsd) ? row.usedUsd : 0,
        capUsd: Number.isFinite(row.capUsd) ? row.capUsd : 0,
      });
    }
  }
  byId.set("apify", apify);
  if (!byId.has("gemini")) byId.set("gemini", { id: "gemini", usedUsd: 0, capUsd: 0 });
  if (!byId.has("vercel")) byId.set("vercel", { id: "vercel", usedUsd: 0, capUsd: 0 });
  return {
    updatedAt: stored?.updatedAt || new Date().toISOString(),
    rows: ["gemini", "apify", "vercel"].map((id) => byId.get(id as IrissLimitsRowId)!),
  };
}
