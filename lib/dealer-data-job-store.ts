import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";

import {
  normalizeDealerDataJob,
  type DealerDataJob,
  type DealerDataJobStatus,
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

async function readJson(key: string): Promise<unknown | null> {
  const blob = resolveBlob();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${key}.json`, {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res && res.statusCode === 200 && res.stream) {
        const text = await new Response(res.stream).text();
        return JSON.parse(text) as unknown;
      }
    } catch {
      /* krītam atpakaļ uz failsistēmu */
    }
  }

  const dir = resolveDir();
  if (!dir) return null;
  try {
    const text = await fs.readFile(path.join(dir, `${key}.json`), "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  const body = JSON.stringify(value);
  let wrote = false;

  const blob = resolveBlob();
  if (blob) {
    try {
      await put(`${blob.prefix}${key}.json`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      wrote = true;
    } catch {
      /* mēģinām failsistēmu */
    }
  }

  const dir = resolveDir();
  if (dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${key}.json`), body, "utf8");
      wrote = true;
    } catch {
      /* nerakstāma vide */
    }
  }

  return wrote;
}

export async function readDealerDataJob(sessionId: string): Promise<DealerDataJob | null> {
  if (!isSafeDealerJobSessionId(sessionId)) return null;
  const raw = await readJson(sessionId);
  return raw ? normalizeDealerDataJob(raw, sessionId) : null;
}

/** Statusi, kas cron slaucītājam vēl jāpārņem. */
const UNFINISHED: readonly DealerDataJobStatus[] = ["pending", "running", "failed"];

async function readPendingIndex(): Promise<string[]> {
  const raw = await readJson(INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isSafeDealerJobSessionId(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out.slice(-PENDING_INDEX_MAX);
}

async function updatePendingIndex(sessionId: string, unfinished: boolean): Promise<void> {
  const current = await readPendingIndex();
  const without = current.filter((id) => id !== sessionId);
  const next = unfinished ? [...without, sessionId].slice(-PENDING_INDEX_MAX) : without;
  if (next.length === current.length && next.every((id, i) => id === current[i])) return;
  await writeJson(INDEX_KEY, next);
}

export async function listUnfinishedDealerDataJobs(): Promise<DealerDataJob[]> {
  const ids = await readPendingIndex();
  const jobs: DealerDataJob[] = [];
  for (const id of ids) {
    const job = await readDealerDataJob(id);
    if (job && UNFINISHED.includes(job.status)) jobs.push(job);
  }
  return jobs;
}

export async function writeDealerDataJob(job: DealerDataJob): Promise<boolean> {
  if (!isSafeDealerJobSessionId(job.sessionId)) return false;
  const normalized = normalizeDealerDataJob(
    { ...job, updatedAt: new Date().toISOString() },
    job.sessionId,
  );
  if (!normalized) return false;
  const wrote = await writeJson(normalized.sessionId, normalized);
  if (wrote) await updatePendingIndex(normalized.sessionId, UNFINISHED.includes(normalized.status));
  return wrote;
}

/** Izveido vai atjauno darbu, saglabājot `createdAt` un mēģinājumu skaitu. */
export async function upsertDealerDataJob(
  sessionId: string,
  patch: Partial<Omit<DealerDataJob, "sessionId">> & { vin: string },
): Promise<DealerDataJob | null> {
  if (!isSafeDealerJobSessionId(sessionId)) return null;
  const now = new Date().toISOString();
  const current = await readDealerDataJob(sessionId);
  const next: DealerDataJob = {
    sessionId,
    vin: patch.vin.trim().toUpperCase(),
    status: patch.status ?? current?.status ?? "pending",
    attempts: patch.attempts ?? current?.attempts ?? 0,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    ...(patch.startedAt ?? current?.startedAt ? { startedAt: patch.startedAt ?? current?.startedAt } : {}),
    ...(patch.finishedAt ?? current?.finishedAt ? { finishedAt: patch.finishedAt ?? current?.finishedAt } : {}),
    ...(patch.serviceEventCount !== undefined
      ? { serviceEventCount: patch.serviceEventCount }
      : current?.serviceEventCount !== undefined
        ? { serviceEventCount: current.serviceEventCount }
        : {}),
    ...(patch.aiGenerated !== undefined
      ? { aiGenerated: patch.aiGenerated }
      : current?.aiGenerated !== undefined
        ? { aiGenerated: current.aiGenerated }
        : {}),
    ...(patch.error ? { error: patch.error } : {}),
    ...(patch.trigger ?? current?.trigger ? { trigger: patch.trigger ?? current?.trigger } : {}),
    // Atmaksa ir neatgriezeniska: reizi ierakstītu ierakstu patch nedrīkst nomest.
    ...(current?.refund ? { refund: current.refund } : patch.refund ? { refund: patch.refund } : {}),
  };
  const ok = await writeDealerDataJob(next);
  return ok ? next : null;
}
