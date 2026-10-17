import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { rigaCalendarDayKey } from "@/lib/admin-riga-calendar";
import {
  applyAdVisitIncrement,
  emptyAdVisitDoc,
  parseAdVisitDoc,
  type AdVisitDoc,
  type AdVisitIncrement,
} from "@/lib/admin-ad-visits";

const RELATIVE_DIR = ".data/site-stats";
const FILENAME = "ad-visits.json";
const BLOB_PATHNAME = "site-stats/ad-visits.json";

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, FILENAME);
}

async function readFromBlob(token: string): Promise<AdVisitDoc | null> {
  try {
    const res = await get(BLOB_PATHNAME, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return parseAdVisitDoc(JSON.parse(await new Response(res.stream).text()));
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, doc: AdVisitDoc): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(doc), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<AdVisitDoc | null> {
  try {
    return parseAdVisitDoc(JSON.parse(await fs.readFile(filesystemPath(), "utf8")));
  } catch {
    return null;
  }
}

async function writeToFilesystem(doc: AdVisitDoc): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc), "utf8");
  await fs.rename(tmp, fp);
}

export async function readAdVisitDoc(): Promise<AdVisitDoc> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  return (await readFromFilesystem()) ?? emptyAdVisitDoc();
}

export async function incrementAdVisit(inc: AdVisitIncrement, nowMs = Date.now()): Promise<AdVisitDoc> {
  const current = await readAdVisitDoc();
  const next = applyAdVisitIncrement(current, inc, rigaCalendarDayKey(nowMs));
  const token = blobToken();
  if (token) {
    await writeToBlob(token, next);
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
