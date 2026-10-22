import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";

/**
 * Cron paziņojumu dedupe (lai push nespamo): viens JSON uz jomu
 * `{blobPrefix|dir}/cron_notify/<scope>.json` ar `{ entries: { key: sentAtIso } }`.
 * Tas pats Blob/FS, kas order-draft. Nav jaunu atslēgu.
 */

export type { CronNotifyEntries } from "@/lib/cron-notify-entries";
export { pruneCronNotifyEntries } from "@/lib/cron-notify-entries";
import type { CronNotifyEntries } from "@/lib/cron-notify-entries";

const SAFE_SCOPE = /^[a-z0-9-]{1,64}$/;

function relPath(scope: string): string {
  if (!SAFE_SCOPE.test(scope)) throw new Error("invalid_scope");
  return `cron_notify/${scope}.json`;
}

export function isCronNotifyStoreDurable(): boolean {
  if (getOrderDraftBlobConfig()) return true;
  return Boolean(getOrderDraftStorageDir()) && process.env.VERCEL !== "1";
}

function parseEntries(raw: unknown): CronNotifyEntries | null {
  if (!raw || typeof raw !== "object") return null;
  const entries = (raw as { entries?: unknown }).entries;
  if (!entries || typeof entries !== "object") return null;
  const out: CronNotifyEntries = {};
  for (const [k, v] of Object.entries(entries as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export async function readCronNotifyEntries(scope: string): Promise<CronNotifyEntries> {
  const rel = relPath(scope);
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        const parsed = parseEntries(JSON.parse(await new Response(res.stream).text()));
        if (parsed) return parsed;
      }
    } catch {
      /* nav vēl */
    }
    if (process.env.VERCEL === "1") return {};
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      const parsed = parseEntries(JSON.parse(await fs.readFile(path.join(dir, rel), "utf8")));
      if (parsed) return parsed;
    } catch {
      /* nav vēl */
    }
  }
  return {};
}

export async function writeCronNotifyEntries(scope: string, entries: CronNotifyEntries): Promise<boolean> {
  const rel = relPath(scope);
  const payload = JSON.stringify({ entries });
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${rel}`, payload, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      if (process.env.VERCEL === "1") return false;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      const fp = path.join(dir, rel);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(`${fp}.tmp`, payload, "utf8");
      await fs.rename(`${fp}.tmp`, fp);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
