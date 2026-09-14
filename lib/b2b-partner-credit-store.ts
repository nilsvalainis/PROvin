import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import {
  emptyB2bCreditWallet,
  parseB2bCreditWallet,
  type B2bCreditWallet,
} from "@/lib/b2b-partner-credits";

const RELATIVE_DIR = ".data/b2b-partner-credits";
const BLOB_PREFIX = "b2b-partner-credits/";

function blobToken(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  return token || null;
}

function filesystemDir(): string {
  if (process.env.VERCEL === "1") return path.join(os.tmpdir(), "provin-b2b-partner-credits");
  return path.join(process.cwd(), RELATIVE_DIR);
}

function filePath(partnerId: string): string {
  return path.join(filesystemDir(), `${partnerId}.json`);
}

function blobKey(partnerId: string): string {
  return `${BLOB_PREFIX}${partnerId}.json`;
}

async function readFromBlob(partnerId: string, token: string): Promise<B2bCreditWallet | null> {
  try {
    const res = await get(blobKey(partnerId), {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    return parseB2bCreditWallet(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

async function writeToBlob(partnerId: string, token: string, wallet: B2bCreditWallet): Promise<void> {
  await put(blobKey(partnerId), JSON.stringify(wallet), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

async function readFromFilesystem(partnerId: string): Promise<B2bCreditWallet | null> {
  try {
    const raw = await fs.readFile(filePath(partnerId), "utf8");
    return parseB2bCreditWallet(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function writeToFilesystem(partnerId: string, wallet: B2bCreditWallet): Promise<void> {
  const fp = filePath(partnerId);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(wallet), "utf8");
  await fs.rename(tmp, fp);
}

export async function readB2bCreditWallet(partnerId: string): Promise<B2bCreditWallet> {
  if (!isSafeB2bPartnerId(partnerId)) return emptyB2bCreditWallet();
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(partnerId, token);
    if (fromBlob) return fromBlob;
  }
  return (await readFromFilesystem(partnerId)) ?? emptyB2bCreditWallet();
}

export async function writeB2bCreditWallet(partnerId: string, wallet: B2bCreditWallet): Promise<boolean> {
  if (!isSafeB2bPartnerId(partnerId)) return false;
  const token = blobToken();
  if (token) {
    await writeToBlob(partnerId, token, wallet);
    try {
      await writeToFilesystem(partnerId, wallet);
    } catch {
      /* ignore */
    }
    return true;
  }
  await writeToFilesystem(partnerId, wallet);
  return true;
}

export async function deleteB2bCreditWallet(partnerId: string): Promise<void> {
  if (!isSafeB2bPartnerId(partnerId)) return;
  const token = blobToken();
  if (token) {
    try {
      await del(blobKey(partnerId), { token });
    } catch {
      /* ignore missing blob */
    }
  }
  try {
    await fs.unlink(filePath(partnerId));
  } catch {
    /* ignore missing file */
  }
}

const chains = new Map<string, Promise<unknown>>();

export function withB2bCreditLock<T>(partnerId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(partnerId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  chains.set(
    partnerId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}
