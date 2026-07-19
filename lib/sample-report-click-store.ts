import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

const RELATIVE_DIR = ".data/site-stats";
const FILENAME = "sample-report-clicks.json";
const BLOB_PATHNAME = "site-stats/sample-report-clicks.json";

export type SampleReportClickStats = {
  /** Kopējais klikšķu skaits uz AUDITS atskaites piemēru. */
  total: number;
  /** ISO laiks pēdējam klikšķim (ja ir). */
  lastClickedAt: string | null;
  updatedAt: string;
};

function emptyStats(): SampleReportClickStats {
  const now = new Date().toISOString();
  return { total: 0, lastClickedAt: null, updatedAt: now };
}

function parseStats(raw: string): SampleReportClickStats {
  try {
    const p = JSON.parse(raw) as Partial<SampleReportClickStats>;
    const total = typeof p.total === "number" && Number.isFinite(p.total) && p.total >= 0 ? Math.floor(p.total) : 0;
    const lastClickedAt =
      typeof p.lastClickedAt === "string" && p.lastClickedAt.trim() ? p.lastClickedAt.trim() : null;
    const updatedAt =
      typeof p.updatedAt === "string" && p.updatedAt.trim() ? p.updatedAt.trim() : new Date().toISOString();
    return { total, lastClickedAt, updatedAt };
  } catch {
    return emptyStats();
  }
}

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, FILENAME);
}

async function readFromBlob(token: string): Promise<SampleReportClickStats | null> {
  try {
    const res = await get(BLOB_PATHNAME, {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseStats(text);
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, stats: SampleReportClickStats): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(stats), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<SampleReportClickStats | null> {
  try {
    const raw = await fs.readFile(filesystemPath(), "utf8");
    return parseStats(raw);
  } catch {
    return null;
  }
}

async function writeToFilesystem(stats: SampleReportClickStats): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(stats), "utf8");
  await fs.rename(tmp, fp);
}

export async function getSampleReportClickStats(): Promise<SampleReportClickStats> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  const fromFs = await readFromFilesystem();
  return fromFs ?? emptyStats();
}

/** Atomiski-ish +1 (read → write). Serverless konkurence var zaudēt dažus klikšķus. */
export async function incrementSampleReportClick(): Promise<SampleReportClickStats> {
  const now = new Date().toISOString();
  const current = await getSampleReportClickStats();
  const next: SampleReportClickStats = {
    total: current.total + 1,
    lastClickedAt: now,
    updatedAt: now,
  };

  const token = blobToken();
  if (token) {
    await writeToBlob(token, next);
    // Spoguļot lokāli, ja iespējams (dev / noturīgs FS).
    try {
      await writeToFilesystem(next);
    } catch {
      /* ignore */
    }
    return next;
  }

  await writeToFilesystem(next);
  return next;
}
