export class ConditionalWriteConflict extends Error {
  constructor() {
    super("conditional_write_conflict");
    this.name = "ConditionalWriteConflict";
  }
}

export type ConditionalSnapshot<T> = {
  value: T | null;
  /** `null`, ja ieraksta vēl nav. */
  etag: string | null;
};

export function isConditionalWriteConflict(err: unknown): boolean {
  if (err instanceof ConditionalWriteConflict) return true;
  if (!err || typeof err !== "object") return false;
  const name = "name" in err && typeof err.name === "string" ? err.name : "";
  if (name === "BlobPreconditionFailedError" || name === "ConditionalWriteConflict") return true;
  const msg = err instanceof Error ? err.message : "";
  return /precondition failed|etag mismatch|already exists/i.test(msg);
}

export type BlobPutOverwriteOptions = {
  allowOverwrite: boolean;
  ifMatch?: string;
};

/**
 * Blob `put` opcijas. `ifMatch` tikai tad, ja etag tiešām ir.
 * Bez etag `allowOverwrite: false` uz jau esoša faila dod „already exists”
 * un pēc 6 mēģinājumiem PATCH kļūst par 500 (klients to var neredzēt).
 */
export function blobPutOverwriteOptions(etag: string | null | undefined): BlobPutOverwriteOptions {
  const tag = typeof etag === "string" ? etag.trim() : "";
  if (tag) return { allowOverwrite: true, ifMatch: tag };
  return { allowOverwrite: true };
}

export function casRetryDelayMs(attempt: number): number {
  return Math.min(400, 40 * (attempt + 1));
}

/**
 * Optimistiska rakstīšana: nolasa etag, aprēķina nākamo vērtību, raksta ar `ifMatch`.
 * Konflikta gadījumā nolasa vēlreiz. Vienas instances atmiņas slēdzene nav vajadzīga.
 */
export async function compareAndSwap<T, R>(opts: {
  read: () => Promise<ConditionalSnapshot<T>>;
  write: (next: T, etag: string | null) => Promise<void>;
  update: (current: T | null) => Promise<{ next: T; result: R } | { result: R }> | { next: T; result: R } | { result: R };
  maxAttempts?: number;
}): Promise<R> {
  const max = opts.maxAttempts ?? 6;
  let last: unknown = null;
  for (let attempt = 0; attempt < max; attempt++) {
    const snap = await opts.read();
    const decision = await opts.update(snap.value);
    if (!("next" in decision)) return decision.result;
    try {
      await opts.write(decision.next, snap.etag);
      return decision.result;
    } catch (err) {
      if (!isConditionalWriteConflict(err)) throw err;
      last = err;
    }
  }
  if (last instanceof Error) throw last;
  throw new ConditionalWriteConflict();
}

/** Atmiņas krātuve testiem un vietējai simulācijai. Etag mainās katrā veiksmīgā rakstā. */
export function createMemoryConditionalStore<T>() {
  const rows = new Map<string, { value: T; etag: string }>();
  let seq = 0;
  return {
    async read(key: string): Promise<ConditionalSnapshot<T>> {
      const row = rows.get(key);
      if (!row) return { value: null, etag: null };
      return { value: structuredClone(row.value), etag: row.etag };
    },
    async write(key: string, next: T, etag: string | null): Promise<void> {
      const row = rows.get(key);
      const current = row?.etag ?? null;
      if (current !== etag) throw new ConditionalWriteConflict();
      seq += 1;
      rows.set(key, { value: structuredClone(next), etag: `e${seq}` });
    },
    peek(key: string): T | null {
      return rows.get(key)?.value ?? null;
    },
  };
}
