import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { del, get } from "@vercel/blob";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import {
  emptyB2bCreditWallet,
  parseB2bCreditWallet,
  type B2bCreditWallet,
} from "@/lib/b2b-partner-credits";
import { normalizeBlobEtag } from "@/lib/blob-etag";
import { putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import {
  compareAndSwap,
  ConditionalWriteConflict,
  type ConditionalSnapshot,
} from "@/lib/conditional-write";

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

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

async function readFromBlob(
  partnerId: string,
  token: string,
): Promise<{ wallet: B2bCreditWallet; etag: string } | null> {
  try {
    const res = await get(blobKey(partnerId), {
      access: "private",
      token,
      useCache: false,
    });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const text = await new Response(res.stream).text();
    const etag = normalizeBlobEtag(res.blob?.etag);
    if (!etag) return null;
    return { wallet: parseB2bCreditWallet(JSON.parse(text) as unknown), etag };
  } catch {
    return null;
  }
}

async function writeToBlob(
  partnerId: string,
  token: string,
  wallet: B2bCreditWallet,
  etag: string | null,
): Promise<void> {
  await putBlobBodyIfMatch({
    pathname: blobKey(partnerId),
    body: JSON.stringify(wallet),
    token,
    etag: normalizeBlobEtag(etag),
    seen: etag != null,
  });
}

async function readFromFilesystem(
  partnerId: string,
): Promise<{ wallet: B2bCreditWallet; etag: string } | null> {
  try {
    const raw = await fs.readFile(filePath(partnerId), "utf8");
    return { wallet: parseB2bCreditWallet(JSON.parse(raw) as unknown), etag: hashBody(raw) };
  } catch {
    return null;
  }
}

async function writeToFilesystem(partnerId: string, wallet: B2bCreditWallet, etag: string | null): Promise<void> {
  const fp = filePath(partnerId);
  let current: string | null = null;
  try {
    current = hashBody(await fs.readFile(fp, "utf8"));
  } catch {
    current = null;
  }
  if (current !== etag) throw new ConditionalWriteConflict();
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(wallet), "utf8");
  let again: string | null = null;
  try {
    again = hashBody(await fs.readFile(fp, "utf8"));
  } catch {
    again = null;
  }
  if (again !== etag) {
    await fs.unlink(tmp).catch(() => undefined);
    throw new ConditionalWriteConflict();
  }
  await fs.rename(tmp, fp);
}

async function readCreditSnapshot(partnerId: string): Promise<ConditionalSnapshot<B2bCreditWallet>> {
  const token = blobToken();
  if (token) {
    const fromBlob = await readFromBlob(partnerId, token);
    if (fromBlob) return { value: fromBlob.wallet, etag: fromBlob.etag };
  }
  const fromFs = await readFromFilesystem(partnerId);
  if (fromFs && !token) return { value: fromFs.wallet, etag: fromFs.etag };
  if (fromFs && token) return { value: fromFs.wallet, etag: null };
  return { value: emptyB2bCreditWallet(), etag: null };
}

async function writeCreditConditional(partnerId: string, wallet: B2bCreditWallet, etag: string | null): Promise<void> {
  const token = blobToken();
  if (token) {
    await writeToBlob(partnerId, token, wallet, etag);
    try {
      const raw = JSON.stringify(wallet);
      const fp = filePath(partnerId);
      await fs.mkdir(path.dirname(fp), { recursive: true });
      await fs.writeFile(fp, raw, "utf8");
    } catch {
      /* lokālais kešs nav avots */
    }
    return;
  }
  await writeToFilesystem(partnerId, wallet, etag);
}

export async function readB2bCreditWallet(partnerId: string): Promise<B2bCreditWallet> {
  if (!isSafeB2bPartnerId(partnerId)) return emptyB2bCreditWallet();
  const snap = await readCreditSnapshot(partnerId);
  return snap.value ?? emptyB2bCreditWallet();
}

/**
 * Pilna maka aizstāšana. Norakstīšanai un atgriešanai lietot `updateB2bCreditWallet`,
 * kas raksta ar Blob `ifMatch`.
 */
export async function writeB2bCreditWallet(partnerId: string, wallet: B2bCreditWallet): Promise<boolean> {
  if (!isSafeB2bPartnerId(partnerId)) return false;
  try {
    await updateB2bCreditWallet(partnerId, (current) => ({
      wallet: { ...wallet, debitKeys: wallet.debitKeys ?? current.debitKeys },
      value: true,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function updateB2bCreditWallet<T>(
  partnerId: string,
  mutate: (
    wallet: B2bCreditWallet,
  ) => Promise<{ value: T; wallet?: B2bCreditWallet }> | { value: T; wallet?: B2bCreditWallet },
): Promise<T> {
  if (!isSafeB2bPartnerId(partnerId)) {
    const decision = await mutate(emptyB2bCreditWallet());
    return decision.value;
  }
  return compareAndSwap({
    read: () => readCreditSnapshot(partnerId),
    write: (next, etag) => writeCreditConditional(partnerId, next, etag),
    update: async (current) => {
      const decision = await mutate(current ?? emptyB2bCreditWallet());
      if (!decision.wallet) return { result: decision.value };
      return { next: decision.wallet, result: decision.value };
    },
  });
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

/**
 * Vienas instances rinda. Naudas drošība ir `updateB2bCreditWallet` (Blob `ifMatch`),
 * nevis šī atmiņa: Vercel vienlaikus darbina vairākas instances.
 */
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
