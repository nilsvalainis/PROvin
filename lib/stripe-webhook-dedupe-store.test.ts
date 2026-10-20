import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StripeDedupeRecord } from "@/lib/stripe-webhook-dedupe";

/** Kopīgā Blob krātuve, ko redz visas serverless instances. */
const blob = new Map<string, StripeDedupeRecord | null>();

vi.mock("@/lib/b2b-json-doc-store", () => ({
  createJsonDocStore: () => ({
    update: async <R>(
      key: string,
      fn: (current: StripeDedupeRecord | null) => { value: R; next?: StripeDedupeRecord | null },
    ): Promise<R> => {
      const r = fn(blob.get(key) ?? null);
      if (r.next !== undefined) blob.set(key, r.next);
      return r.value;
    },
  }),
}));

async function loadInstance() {
  vi.resetModules();
  return import("@/lib/stripe-webhook-dedupe-store");
}

describe("stripe webhook dedupe store (persistent)", () => {
  beforeEach(() => {
    blob.clear();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("instance that lost the claim does not cache it as done after the owner releases", async () => {
    const a = await loadInstance();
    const b = await loadInstance();
    expect(await a.tryBeginStripeEvent("evt_1")).toBe(true);
    // Paralēls Stripe atkārtojums trāpa citā instancē, kamēr A vēl apstrādā.
    expect(await b.tryBeginStripeEvent("evt_1")).toBe(false);
    // A apstrāde neizdodas un atbrīvo atslēgu, lai Stripe varētu atkārtot.
    await a.releaseStripeEvent("evt_1");
    // Nākamais atkārtojums trāpa B: tam jāapstrādā, nevis jāatbild "duplicate".
    expect(await b.tryBeginStripeEvent("evt_1")).toBe(true);
  });

  it("completed event stays a duplicate for other instances", async () => {
    const a = await loadInstance();
    const b = await loadInstance();
    expect(await a.tryBeginStripeEvent("evt_2")).toBe(true);
    await a.completeStripeEvent("evt_2");
    expect(await b.tryBeginStripeEvent("evt_2")).toBe(false);
    expect(await a.tryBeginStripeEvent("evt_2")).toBe(false);
  });
});
