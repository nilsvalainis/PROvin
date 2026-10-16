import { describe, expect, it } from "vitest";
import {
  blobPutOverwriteOptions,
  casRetryDelayMs,
  compareAndSwap,
  ConditionalWriteConflict,
  createMemoryConditionalStore,
  isConditionalWriteConflict,
} from "@/lib/conditional-write";

describe("compareAndSwap", () => {
  it("divi paralēli norakstījumi atstāj pareizu atlikumu un neiet negatīvā", async () => {
    const store = createMemoryConditionalStore<{ credits: number; keys: string[] }>();
    await store.write("p1", { credits: 1, keys: [] }, null);

    async function debit(idempotencyKey: string) {
      return compareAndSwap({
        read: () => store.read("p1"),
        write: (next, etag) => store.write("p1", next, etag),
        update: (current) => {
          const wallet = current ?? { credits: 0, keys: [] };
          if (wallet.keys.includes(idempotencyKey)) {
            return { result: { ok: true as const, duplicate: true, credits: wallet.credits } };
          }
          if (wallet.credits < 1) {
            return { result: { ok: false as const, duplicate: false, credits: wallet.credits } };
          }
          const next = { credits: wallet.credits - 1, keys: [...wallet.keys, idempotencyKey] };
          return { next, result: { ok: true as const, duplicate: false, credits: next.credits } };
        },
      });
    }

    const [a, b] = await Promise.all([debit("order-a"), debit("order-b")]);
    const oks = [a, b].filter((row) => row.ok && !row.duplicate);
    expect(oks).toHaveLength(1);
    expect(store.peek("p1")?.credits).toBe(0);

    const again = await debit("order-a");
    expect(again.duplicate).toBe(true);
    expect(store.peek("p1")?.credits).toBe(0);
  });

  it("zaudēts atjauninājums ar to pašu etag tiek noraidīts un otrais mēģinājums redz jauno revīziju", async () => {
    const store = createMemoryConditionalStore<{ revision: number; note: string }>();
    await store.write("s1", { revision: 3, note: "a" }, null);

    const first = await compareAndSwap({
      read: () => store.read("s1"),
      write: (next, etag) => store.write("s1", next, etag),
      update: (current) => {
        if (!current || current.revision !== 3) {
          return { result: { ok: false as const, reason: "stale_revision" as const, revision: current?.revision ?? 0 } };
        }
        return {
          next: { revision: 4, note: "no telefona" },
          result: { ok: true as const, revision: 4 },
        };
      },
    });
    expect(first.ok).toBe(true);

    const second = await compareAndSwap({
      read: () => store.read("s1"),
      write: (next, etag) => store.write("s1", next, etag),
      update: (current) => {
        if (!current || current.revision !== 3) {
          return { result: { ok: false as const, reason: "stale_revision" as const, revision: current?.revision ?? 0 } };
        }
        return {
          next: { revision: 4, note: "no datora" },
          result: { ok: true as const, revision: 4 },
        };
      },
    });
    expect(second).toEqual({ ok: false, reason: "stale_revision", revision: 4 });
    expect(store.peek("s1")).toEqual({ revision: 4, note: "no telefona" });
  });

  it("ifMatch tikai ar etag, bez etag ļauj overwrite (nekad allowOverwrite:false)", () => {
    expect(blobPutOverwriteOptions("W/\"abc\"")).toEqual({ allowOverwrite: true, ifMatch: "W/\"abc\"" });
    expect(blobPutOverwriteOptions("  etag1  ")).toEqual({ allowOverwrite: true, ifMatch: "etag1" });
    expect(blobPutOverwriteOptions(null)).toEqual({ allowOverwrite: true });
    expect(blobPutOverwriteOptions("")).toEqual({ allowOverwrite: true });
    expect(blobPutOverwriteOptions(undefined)).toEqual({ allowOverwrite: true });
  });

  it("CAS atkārtots mēģinājums gaida arvien ilgāk, bet ne ilgāk par 400ms", () => {
    expect(casRetryDelayMs(0)).toBe(40);
    expect(casRetryDelayMs(2)).toBe(120);
    expect(casRetryDelayMs(20)).toBe(400);
  });

  it("atpazīst Blob nosacījuma kļūdu", () => {
    const err = new Error("Precondition failed: ETag mismatch.");
    err.name = "BlobPreconditionFailedError";
    expect(isConditionalWriteConflict(err)).toBe(true);
    expect(isConditionalWriteConflict(new ConditionalWriteConflict())).toBe(true);
    expect(isConditionalWriteConflict(new Error("network"))).toBe(false);
  });
});
