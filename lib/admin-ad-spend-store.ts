import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { parseAdSpendDoc, type AdSpendRow } from "@/lib/admin-ad-spend";

const RELATIVE_DIR = ".data/site-stats";
const FILENAME = "ad-spend.json";
const BLOB_PATHNAME = "site-stats/ad-spend.json";

type SpendDoc = { version: 1; updatedAt: string; rows: AdSpendRow[] };

function toDoc(rows: AdSpendRow[]): SpendDoc {
  return { version: 1, updatedAt: new Date().toISOString(), rows };
}

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemPath(): string {
  return path.join(process.cwd(), RELATIVE_DIR, FILENAME);
}

async function readFromBlob(token: string): Promise<AdSpendRow[] | null> {
  try {
    const res = await get(BLOB_PATHNAME, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return parseAdSpendDoc(JSON.parse(await new Response(res.stream).text()));
  } catch {
    return null;
  }
}

async function writeToBlob(token: string, rows: AdSpendRow[]): Promise<void> {
  await put(BLOB_PATHNAME, JSON.stringify(toDoc(rows)), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(): Promise<AdSpendRow[] | null> {
  try {
    return parseAdSpendDoc(JSON.parse(await fs.readFile(filesystemPath(), "utf8")));
  } catch {
    return null;
  }
}

async function writeToFilesystem(rows: AdSpendRow[]): Promise<void> {
  const fp = filesystemPath();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(toDoc(rows)), "utf8");
  await fs.rename(tmp, fp);
}

export async function readAdSpendRows(): Promise<AdSpendRow[]> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(token);
    if (fromBlob) return fromBlob;
  }
  return (await readFromFilesystem()) ?? [];
}

async function persist(rows: AdSpendRow[]): Promise<AdSpendRow[]> {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const token = blobToken();
  if (token) {
    await writeToBlob(token, sorted);
    try {
      await writeToFilesystem(sorted);
    } catch {
      /* ignore */
    }
    return sorted;
  }
  await writeToFilesystem(sorted);
  return sorted;
}

export async function addAdSpendRows(incoming: AdSpendRow[]): Promise<AdSpendRow[]> {
  const current = await readAdSpendRows();
  return persist([...current, ...incoming]);
}

export async function deleteAdSpendRow(id: string): Promise<AdSpendRow[]> {
  const current = await readAdSpendRows();
  return persist(current.filter((r) => r.id !== id));
}
