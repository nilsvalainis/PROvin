import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { normalizeBlobEtag } from "@/lib/blob-etag";
import { putBlobBodyIfMatch } from "@/lib/blob-if-match-put";
import { BlobReadFailedError, isNodeNotFoundError, readPrivateBlobText } from "@/lib/blob-read";
import {
  compareAndSwap,
  ConditionalWriteConflict,
  type ConditionalSnapshot,
} from "@/lib/conditional-write";

/**
 * Viens JSON dokuments uz atslēgu: Blob (produkcija) ar `ifMatch` vai lokālais fails.
 * `update` ir compare-and-swap, tāpēc vienlaicīgi pieprasījumi nepārraksta viens otru.
 * Lasīšanas kļūda nav „tukšs” - pretējā gadījumā nākamais raksts var izdzēst partnerus/maku.
 */
export type JsonDocStore<T> = {
  read: (key: string) => Promise<T>;
  update: <R>(
    key: string,
    mutate: (
      current: T,
    ) => { value: R; next?: T } | Promise<{ value: R; next?: T }>,
  ) => Promise<R>;
};

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

export function parseJsonDocText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new BlobReadFailedError(err instanceof Error ? err.message : "json_parse_failed");
  }
}

/** Dokumenta saknei jābūt objektam. `null` / masīvs / skalārs nav „tukšs” - citādi nākamais raksts izdzēš datus. */
export function parseJsonDocObject(text: string): Record<string, unknown> {
  const raw = parseJsonDocText(text);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BlobReadFailedError("json_not_object");
  }
  return raw as Record<string, unknown>;
}

export function createJsonDocStore<T>(opts: {
  blobPrefix: string;
  dirName: string;
  isSafeKey: (key: string) => boolean;
  parse: (raw: unknown) => T;
  empty: () => T;
}): JsonDocStore<T> {
  const dir = () =>
    process.env.VERCEL === "1"
      ? path.join(os.tmpdir(), `provin-${opts.dirName}`)
      : path.join(process.cwd(), ".data", opts.dirName);
  const filePath = (key: string) => path.join(dir(), `${key}.json`);
  const blobKey = (key: string) => `${opts.blobPrefix}${key}.json`;

  async function readBlob(key: string, token: string): Promise<{ value: T; etag: string } | null> {
    const snap = await readPrivateBlobText({ pathname: blobKey(key), token });
    if (snap.state === "missing") return null;
    return { value: opts.parse(parseJsonDocObject(snap.text)), etag: snap.etag };
  }

  async function readFile(key: string): Promise<{ value: T; etag: string } | null> {
    let raw: string;
    try {
      raw = await fs.readFile(filePath(key), "utf8");
    } catch (err) {
      if (isNodeNotFoundError(err)) return null;
      throw err;
    }
    return { value: opts.parse(parseJsonDocObject(raw)), etag: hashBody(raw) };
  }

  async function snapshot(key: string): Promise<ConditionalSnapshot<T>> {
    const token = blobToken();
    if (token) {
      const fromBlob = await readBlob(key, token);
      if (fromBlob) return { value: fromBlob.value, etag: fromBlob.etag };
      return { value: null, etag: null };
    }
    const fromFs = await readFile(key);
    if (fromFs) return { value: fromFs.value, etag: fromFs.etag };
    return { value: null, etag: null };
  }

  async function writeFileConditional(key: string, value: T, etag: string | null): Promise<void> {
    const fp = filePath(key);
    const currentHash = async () => {
      try {
        return hashBody(await fs.readFile(fp, "utf8"));
      } catch (err) {
        if (isNodeNotFoundError(err)) return null;
        throw err;
      }
    };
    if ((await currentHash()) !== etag) throw new ConditionalWriteConflict();
    await fs.mkdir(path.dirname(fp), { recursive: true });
    const tmp = `${fp}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), "utf8");
    if ((await currentHash()) !== etag) {
      await fs.unlink(tmp).catch(() => undefined);
      throw new ConditionalWriteConflict();
    }
    await fs.rename(tmp, fp);
  }

  async function write(key: string, value: T, etag: string | null): Promise<void> {
    const token = blobToken();
    if (token) {
      await putBlobBodyIfMatch({
        pathname: blobKey(key),
        body: JSON.stringify(value),
        token,
        etag: normalizeBlobEtag(etag),
        seen: etag != null,
      });
      return;
    }
    await writeFileConditional(key, value, etag);
  }

  return {
    async read(key) {
      if (!opts.isSafeKey(key)) return opts.empty();
      return (await snapshot(key)).value ?? opts.empty();
    },
    async update(key, mutate) {
      if (!opts.isSafeKey(key)) return (await mutate(opts.empty())).value;
      return compareAndSwap({
        read: () => snapshot(key),
        write: (next, etag) => write(key, next, etag),
        update: async (current) => {
          const decision = await mutate(current ?? opts.empty());
          if (decision.next === undefined) return { result: decision.value };
          return { next: decision.next, result: decision.value };
        },
        maxAttempts: 10,
      });
    },
  };
}
