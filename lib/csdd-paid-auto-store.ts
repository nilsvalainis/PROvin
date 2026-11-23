import "server-only";

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

import { getOrderDraftBlobConfig, getOrderDraftStorageDir, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { isNodeNotFoundError, readPrivateBlobText } from "@/lib/blob-read";
import { compareAndSwap, ConditionalWriteConflict } from "@/lib/conditional-write";
import { csddPaidAutoJobOpen, normalizeCsddPaidAutoJob, type CsddPaidAutoJob } from "@/lib/csdd-paid-auto-logic";

/**
 * Automātiskās CSDD maksas izziņas darbi (viens JSON uz pasūtījumu, CAS ar Blob `ifMatch`), mazs indekss ar atvērtajiem
 * darbiem cron slaucītājam un dienas skaitītājs (griestiem). Ceļš: {draft blob prefix|dir}/csdd_paid_auto/
 */

const SUB = "csdd_paid_auto";
const INDEX_KEY = "_open-index";
const DAILY_KEY = "_daily";
const INDEX_MAX = 100;

type Snap = { value: unknown | null; etag: string | null };

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function blobPath(key: string): { pathname: string; token: string } | null {
  const blob = getOrderDraftBlobConfig();
  return blob ? { pathname: `${blob.prefix}${SUB}/${key}.json`, token: blob.token } : null;
}

function filePath(key: string): string | null {
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return null;
  return path.join(dir, SUB, `${key}.json`);
}

async function snapshot(key: string): Promise<Snap> {
  const b = blobPath(key);
  if (b) {
    const snap = await readPrivateBlobText(b);
    if (snap.state === "missing") return { value: null, etag: null };
    return { value: JSON.parse(snap.text) as unknown, etag: snap.etag };
  }
  const fp = filePath(key);
  if (!fp) return { value: null, etag: null };
  try {
    const text = await fs.readFile(fp, "utf8");
    return { value: JSON.parse(text) as unknown, etag: hash(text) };
  } catch (err) {
    if (isNodeNotFoundError(err)) return { value: null, etag: null };
    throw err;
  }
}

async function writeConditional(key: string, value: unknown, etag: string | null): Promise<void> {
  const body = JSON.stringify(value);
  const b = blobPath(key);
  if (b) {
    await putBlobBodyIfMatch({ ...b, body, etag, seen: etag != null });
    return;
  }
  const fp = filePath(key);
  if (!fp) throw new Error("csdd_paid_store_disabled");
  let current: string | null = null;
  try {
    current = hash(await fs.readFile(fp, "utf8"));
  } catch (err) {
    if (!isNodeNotFoundError(err)) throw err;
  }
  if (current !== etag) throw new ConditionalWriteConflict();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

export async function readCsddPaidAutoJob(sessionId: string): Promise<CsddPaidAutoJob | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  try {
    return normalizeCsddPaidAutoJob((await snapshot(sessionId)).value, sessionId);
  } catch {
    return null;
  }
}

/**
 * CAS atjaunošana. `mutate` atgriež nākamo darbu vai null (nemainīt). Atgriež jauno (vai nemainīto) darbu;
 * `changed` - vai šis izsaukums ierakstīja.
 */
export async function updateCsddPaidAutoJob(
  sessionId: string,
  mutate: (current: CsddPaidAutoJob | null) => CsddPaidAutoJob | null,
): Promise<{ job: CsddPaidAutoJob | null; changed: boolean }> {
  if (!isSafeOrderDraftSessionId(sessionId)) return { job: null, changed: false };
  const out = await compareAndSwap<unknown, { job: CsddPaidAutoJob | null; changed: boolean }>({
    read: () => snapshot(sessionId),
    write: (next, etag) => writeConditional(sessionId, next, etag),
    update: (raw) => {
      const current = normalizeCsddPaidAutoJob(raw, sessionId);
      const next = mutate(current);
      if (!next) return { result: { job: current, changed: false } };
      const stamped = { ...next, sessionId, updatedAt: new Date().toISOString() };
      return { next: stamped, result: { job: stamped, changed: true } };
    },
    maxAttempts: 8,
  });
  if (out.changed && out.job) await updateIndex(sessionId, csddPaidAutoJobOpen(out.job));
  return out;
}

function parseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === "string" && isSafeOrderDraftSessionId(x)))].slice(-INDEX_MAX);
}

async function updateIndex(sessionId: string, open: boolean): Promise<void> {
  await compareAndSwap<unknown, void>({
    read: () => snapshot(INDEX_KEY),
    write: (next, etag) => writeConditional(INDEX_KEY, next, etag),
    update: (raw) => {
      const cur = parseIds(raw);
      const without = cur.filter((id) => id !== sessionId);
      const next = open ? [...without, sessionId].slice(-INDEX_MAX) : without;
      if (next.length === cur.length && next.every((id, i) => id === cur[i])) return { result: undefined };
      return { next, result: undefined };
    },
    maxAttempts: 8,
  }).catch((err) => console.error("[csdd-paid-auto-store] index update failed", err instanceof Error ? err.message : "unknown"));
}

export async function listOpenCsddPaidAutoJobs(): Promise<CsddPaidAutoJob[]> {
  let ids: string[] = [];
  try {
    ids = parseIds((await snapshot(INDEX_KEY)).value);
  } catch {
    return [];
  }
  const jobs: CsddPaidAutoJob[] = [];
  for (const id of ids) {
    const job = await readCsddPaidAutoJob(id);
    if (job && csddPaidAutoJobOpen(job)) jobs.push(job);
    else await updateIndex(id, false);
  }
  return jobs;
}

type Daily = { day: string; sessionIds: string[] };

function parseDaily(raw: unknown): Daily | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return typeof o.day === "string" ? { day: o.day, sessionIds: parseIds(o.sessionIds) } : null;
}

export async function csddPaidAutoDailyCount(day: string): Promise<number> {
  try {
    const d = parseDaily((await snapshot(DAILY_KEY)).value);
    return d && d.day === day ? d.sessionIds.length : 0;
  } catch {
    // Ja skaitītāju nevar nolasīt, drošāk uzskatīt, ka griesti sasniegti.
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Rezervē vietu dienas griestos (idempotenti pēc pasūtījuma). false - griesti sasniegti vai krātuves kļūda. */
export async function reserveCsddPaidAutoDailySlot(day: string, sessionId: string, max: number): Promise<boolean> {
  try {
    return await compareAndSwap<unknown, boolean>({
      read: () => snapshot(DAILY_KEY),
      write: (next, etag) => writeConditional(DAILY_KEY, next, etag),
      update: (raw) => {
        const cur = parseDaily(raw);
        const ids = cur && cur.day === day ? cur.sessionIds : [];
        if (ids.includes(sessionId)) return { result: true };
        if (ids.length >= max) return { result: false };
        return { next: { day, sessionIds: [...ids, sessionId] }, result: true };
      },
      maxAttempts: 8,
    });
  } catch (err) {
    console.error("[csdd-paid-auto-store] daily reserve failed", err instanceof Error ? err.message : "unknown");
    return false;
  }
}
