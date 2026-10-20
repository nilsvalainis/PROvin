import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  isSafeStripeDedupeKey,
  newStripeDedupeClaim,
  parseStripeDedupeRecord,
  stripeDedupeBlobKey,
  stripeDedupeDecision,
  type StripeDedupeRecord,
} from "@/lib/stripe-webhook-dedupe";

const store = createJsonDocStore<StripeDedupeRecord | null>({
  blobPrefix: "stripe-webhook-dedupe/",
  dirName: "stripe-webhook-dedupe",
  isSafeKey: isSafeStripeDedupeKey,
  parse: parseStripeDedupeRecord,
  empty: () => null,
});

const memory = new Map<string, StripeDedupeRecord>();

function memoryGet(key: string): StripeDedupeRecord | null {
  return memory.get(key) ?? null;
}

function memorySet(key: string, record: StripeDedupeRecord | null): void {
  if (!record) {
    memory.delete(key);
    return;
  }
  memory.set(key, record);
}

function usesPersistentDedupe(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Ja `false` - šis event.id jau apstrādāts; atgriezt 200 bez darbībām.
 * Ar Blob tokenu stāvoklis ir nounturīgs starp serverless instancēm.
 */
export async function tryBeginStripeEvent(eventId: string, now = Date.now()): Promise<boolean> {
  const key = stripeDedupeBlobKey(eventId);
  if (!isSafeStripeDedupeKey(key)) return false;

  const memDecision = stripeDedupeDecision(memoryGet(key), now);
  if (memDecision === "duplicate") return false;

  if (!usesPersistentDedupe()) {
    memorySet(key, newStripeDedupeClaim(eventId, now, "claimed"));
    return true;
  }

  const acquired = await store.update(key, (current) => {
    const decision = stripeDedupeDecision(current, now);
    if (decision === "duplicate") return { value: false };
    return { value: true, next: newStripeDedupeClaim(eventId, now, "claimed") };
  });
  if (acquired) memorySet(key, newStripeDedupeClaim(eventId, now, "claimed"));
  else memorySet(key, currentOrDone(key, now));
  return acquired;
}

function currentOrDone(key: string, now: number): StripeDedupeRecord {
  return memoryGet(key) ?? newStripeDedupeClaim(key, now, "done");
}

/** Ja apstrāde neizdevās (pirms veiksmīgas atbildes), atļaut Stripe atkārtot mēģinājumu. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  const key = stripeDedupeBlobKey(eventId);
  if (!isSafeStripeDedupeKey(key)) return;
  memorySet(key, null);
  if (!usesPersistentDedupe()) return;
  await store.update(key, (current) => {
    if (!current || current.status === "done") return { value: undefined };
    return { value: undefined, next: null };
  });
}

/** Veiksmīga apstrāde: atkārtojumi paliek dublikāti līdz TTL. */
export async function completeStripeEvent(eventId: string, now = Date.now()): Promise<void> {
  const key = stripeDedupeBlobKey(eventId);
  if (!isSafeStripeDedupeKey(key)) return;
  const done = newStripeDedupeClaim(eventId, now, "done");
  memorySet(key, done);
  if (!usesPersistentDedupe()) return;
  await store.update(key, () => ({ value: undefined, next: done }));
}
