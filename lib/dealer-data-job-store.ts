import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { createHash } from "crypto";

import { normalizeBlobEtag } from "@/lib/blob-etag";
import { putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { isNodeNotFoundError, readPrivateBlobText } from "@/lib/blob-read";
import { compareAndSwap, ConditionalWriteConflict } from "@/lib/conditional-write";
import {
  dealerDataJobBelongsInSweepIndex,
  mergeDealerDataJobPatch,
  type DealerDataJobPatch,
} from "@/lib/dealer-data-job-merge";
import {
  dealerDataJobRetryDue,
  decideDealerDataRun,
  normalizeDealerDataJob,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";

/**
 * Dīlera datu ielases stāvoklis uz servera. Atsevišķi no pasūtījuma melnraksta:
 * statuss mainās vairākas reizes vienā ielasē un nedrīkst radīt melnraksta revīzijas.
 *
 * Blakus katram darbam glabājam mazu indeksu ar nepabeigtajiem darbiem, lai cron
 * slaucītājam nav jālasa visa vēsture.
 */

const DEFAULT_RELATIVE_DIR = ".data/dealer-data-jobs";
const DEFAULT_BLOB_SUBPREFIX = "dealer-data-jobs/";
const INDEX_KEY = "_pending-index";

/** Cik nepabeigtus darbus indekss tur; vecākos izmet, tos pārņem operators. */
const PENDING_INDEX_MAX = 200;

type BlobConfig = { token: string; prefix: string };

function resolveBlob(): BlobConfig | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (!token) return null;
  const explicit = (process.env.DEALER_DATA_JOB_BLOB_PREFIX ?? "").trim();
  if (explicit) {
    return { token, prefix: explicit.endsWith("/") ? explicit : `${explicit}/` };
  }
  const draftPrefix = (process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX ?? "").trim();
  if (!draftPrefix) return null;
  const base = draftPrefix.endsWith("/") ? draftPrefix : `${draftPrefix}/`;
  return { token, prefix: `${base}${DEFAULT_BLOB_SUBPREFIX}` };
}

function resolveDir(): string | null {
  const raw = process.env.DEALER_DATA_JOB_DIR?.trim() ?? "";
  const off = ["0", "false", "no", "off", "disabled"];
  if (off.includes(raw.toLowerCase())) return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-dealer-data-jobs");
  return path.join(process.cwd(), DEFAULT_RELATIVE_DIR);
}

export function isDealerDataJobStoreEnabled(): boolean {
  return resolveDir() !== null || resolveBlob() !== null;
}

export function isSafeDealerJobSessionId(id: string): boolean {
  if (!id || id.length > 200) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

type Snapshot = { value: unknown | null; etag: string | null };

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Nolasa ar ETag (Blob) vai satura hash (fails). Blob kļūda tiek izmesta - nekad nekļūst par «tukšu». */
async function snapshot(key: string): Promise<Snapshot> {
  const blob = resolveBlob();
  if (blob) {
    const snap = await readPrivateBlobText({ pathname: `${blob.prefix}${key}.json`, token: blob.token });
    if (snap.state === "missing") return { value: null, etag: null };
    return { value: JSON.parse(snap.text) as unknown, etag: snap.etag };
  }
  const dir = resolveDir();
  if (!dir) return { value: null, etag: null };
  try {
    const text = await fs.readFile(path.join(dir, `${key}.json`), "utf8");
    return { value: JSON.parse(text) as unknown, etag: hashBody(text) };
  } catch (err) {
    if (isNodeNotFoundError(err)) return { value: null, etag: null };
    throw err;
  }
}

async function readJson(key: string): Promise<unknown | null> {
  try {
    return (await snapshot(key)).value;
  } catch {
    return null;
  }
}

/** Nosacīta rakstīšana (Blob `ifMatch`; failam - hash pārbaude). Konflikts -> ConditionalWriteConflict. */
async function writeConditional(key: string, value: unknown, etag: string | null): Promise<void> {
  const body = JSON.stringify(value);
  const blob = resolveBlob();
  if (blob) {
    await putBlobBodyIfMatch({
      pathname: `${blob.prefix}${key}.json`,
      body,
      token: blob.token,
      etag: normalizeBlobEtag(etag),
      seen: etag != null,
    });
    return;
  }
  const dir = resolveDir();
  if (!dir) throw new Error("dealer_job_store_disabled");
  const fp = path.join(dir, `${key}.json`);
  // Lokālais fails (dev/testi): procesa slēdzene, lai pārbaude + rakstīšana būtu atomiska.
  await withFileLock(fp, async () => {
    let currentHash: string | null = null;
    try {
      currentHash = hashBody(await fs.readFile(fp, "utf8"));
    } catch (err) {
      if (!isNodeNotFoundError(err)) throw err;
    }
    if (currentHash !== etag) throw new ConditionalWriteConflict();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fp, body, "utf8");
  });
}

const fileLocks = new Map<string, Promise<unknown>>();
async function withFileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = fileLocks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  fileLocks.set(key, run);
  try {
    return await run;
  } finally {
    if (fileLocks.get(key) === run) fileLocks.delete(key);
  }
}

/** Compare-and-swap viena darba ierakstam. */
async function casJob<R>(
  sessionId: string,
  mutate: (current: DealerDataJob | null) => { value: R; next?: DealerDataJob },
): Promise<R> {
  return compareAndSwap<unknown, R>({
    read: () => snapshot(sessionId),
    write: (next, etag) => writeConditional(sessionId, next, etag),
    update: (raw) => {
      const current = raw ? normalizeDealerDataJob(raw, sessionId) : null;
      const d = mutate(current);
      return d.next ? { next: d.next, result: d.value } : { result: d.value };
    },
    maxAttempts: 8,
  });
}

export async function readDealerDataJob(sessionId: string): Promise<DealerDataJob | null> {
  if (!isSafeDealerJobSessionId(sessionId)) return null;
  const raw = await readJson(sessionId);
  return raw ? normalizeDealerDataJob(raw, sessionId) : null;
}

export async function readDealerDataJobs(sessionIds: readonly string[]): Promise<Map<string, DealerDataJob>> {
  const unique = [...new Set(sessionIds.filter((id) => isSafeDealerJobSessionId(id)))];
  const out = new Map<string, DealerDataJob>();
  await Promise.all(
    unique.map(async (id) => {
      const job = await readDealerDataJob(id);
      if (job) out.set(id, job);
    }),
  );
  return out;
}

async function readPendingIndex(): Promise<string[]> {
  const raw = await readJson(INDEX_KEY);
  return parseIndex(raw);
}

function parseIndex(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isSafeDealerJobSessionId(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out.slice(-PENDING_INDEX_MAX);
}

/** Indeksa atjaunošana ar CAS, lai vienlaicīgi darbi nepazaudē viens otra ierakstu. */
async function updatePendingIndex(sessionId: string, unfinished: boolean): Promise<void> {
  await compareAndSwap<unknown, void>({
    read: () => snapshot(INDEX_KEY),
    write: (next, etag) => writeConditional(INDEX_KEY, next, etag),
    update: (raw) => {
      const current = parseIndex(raw);
      const without = current.filter((id) => id !== sessionId);
      const next = unfinished ? [...without, sessionId].slice(-PENDING_INDEX_MAX) : without;
      if (next.length === current.length && next.every((id, i) => id === current[i])) return { result: undefined };
      return { next, result: undefined };
    },
    maxAttempts: 8,
  }).catch((err) => {
    console.error("[dealer-data-job-store] index update failed", { sessionId, err });
  });
}

export async function listUnfinishedDealerDataJobs(): Promise<DealerDataJob[]> {
  const ids = await readPendingIndex();
  const jobs: DealerDataJob[] = [];
  for (const id of ids) {
    const job = await readDealerDataJob(id);
    if (job && dealerDataJobBelongsInSweepIndex(job)) jobs.push(job);
    else if (job) await updatePendingIndex(id, false);
  }
  return jobs;
}

export async function writeDealerDataJob(job: DealerDataJob): Promise<boolean> {
  if (!isSafeDealerJobSessionId(job.sessionId)) return false;
  const normalized = normalizeDealerDataJob({ ...job, updatedAt: new Date().toISOString() }, job.sessionId);
  if (!normalized) return false;
  try {
    await casJob(normalized.sessionId, () => ({ value: true, next: normalized }));
  } catch (err) {
    console.error("[dealer-data-job-store] write failed", { sessionId: job.sessionId, err });
    return false;
  }
  await updatePendingIndex(normalized.sessionId, dealerDataJobBelongsInSweepIndex(normalized));
  return true;
}

/**
 * Izveido vai atjauno darbu (CAS). `expectRunId`: rakstīt tikai, ja darbam joprojām ir šī noma
 * (citādi cita palaišana jau pārņēma - nepārrakstām tās stāvokli). Atgriež null, ja neierakstīja.
 */
export async function upsertDealerDataJob(
  sessionId: string,
  patch: DealerDataJobPatch,
  opts: { expectRunId?: string } = {},
): Promise<DealerDataJob | null> {
  if (!isSafeDealerJobSessionId(sessionId)) return null;
  let next: DealerDataJob | null = null;
  try {
    next = await casJob(sessionId, (current) => {
      if (opts.expectRunId && current?.runId !== opts.expectRunId) return { value: null };
      const merged = normalizeDealerDataJob(mergeDealerDataJobPatch(sessionId, current, patch), sessionId);
      return merged ? { value: merged, next: merged } : { value: null };
    });
  } catch (err) {
    console.error("[dealer-data-job-store] upsert failed", { sessionId, err });
    return null;
  }
  if (next) await updatePendingIndex(sessionId, dealerDataJobBelongsInSweepIndex(next));
  return next;
}

export type DealerDataClaimResult =
  | { ok: true; job: DealerDataJob; previous: DealerDataJob | null }
  | { ok: false; reason: string; job: DealerDataJob | null };

/**
 * Atomiska palaišanas nomas iegūšana (CAS): svaigā ierakstā pārbauda `decideDealerDataRun`
 * un (cron) `nextRetryAt`, tad uzliek status=running ar unikālu `runId`. Divas paralēlas
 * palaišanas nevar abas iegūt nomu.
 */
export async function claimDealerDataJobRun(args: {
  sessionId: string;
  vin: string;
  runId: string;
  trigger: DealerDataJob["trigger"];
  force?: boolean;
  /** Cron: respektē nextRetryAt. */
  respectNextRetry?: boolean;
  nowMs?: number;
  patch?: Partial<DealerDataJobPatch>;
}): Promise<DealerDataClaimResult> {
  if (!isSafeDealerJobSessionId(args.sessionId)) return { ok: false, reason: "invalid_session", job: null };
  const nowMs = args.nowMs ?? Date.now();
  try {
    const result = await casJob<DealerDataClaimResult>(args.sessionId, (current) => {
      const decision = decideDealerDataRun({
        job: current,
        vin: args.vin,
        force: args.force,
        trigger: args.trigger,
        nowMs,
      });
      if (!decision.run) return { value: { ok: false, reason: decision.reason, job: current } };
      // Cron vienmēr; arī «Atkārtot», ja OneAuto vēl apstrādā (202) - lai nesūta jaunu pieprasījumu priekšlaikus.
      if (
        (args.respectNextRetry || Boolean(current?.pendingRequestId)) &&
        current &&
        current.status === "failed" &&
        !dealerDataJobRetryDue(current, nowMs)
      ) {
        return { value: { ok: false, reason: "not_due", job: current } };
      }
      const base = mergeDealerDataJobPatch(args.sessionId, current, { vin: args.vin });
      const merged = normalizeDealerDataJob(
        mergeDealerDataJobPatch(args.sessionId, base, {
          ...(args.patch ?? {}),
          vin: args.vin,
          status: "running",
          attempts: base.attempts + 1,
          startedAt: new Date(nowMs).toISOString(),
          trigger: args.trigger,
          runId: args.runId,
        }),
        args.sessionId,
      );
      if (!merged) return { value: { ok: false, reason: "invalid_job", job: current } };
      return { value: { ok: true, job: merged, previous: current }, next: merged };
    });
    if (result.ok) await updatePendingIndex(args.sessionId, true);
    return result;
  } catch (err) {
    console.error("[dealer-data-job-store] claim failed", { sessionId: args.sessionId, err });
    return { ok: false, reason: "claim_conflict", job: null };
  }
}

/** Pirms katra maksas soļa: vai šī palaišana joprojām tur nomu (svaigs nolasījums). */
export async function dealerDataRunLeaseHeld(sessionId: string, runId: string): Promise<boolean> {
  try {
    const raw = (await snapshot(sessionId)).value;
    const job = raw ? normalizeDealerDataJob(raw, sessionId) : null;
    return Boolean(job && job.runId === runId && job.status === "running");
  } catch {
    return false;
  }
}
