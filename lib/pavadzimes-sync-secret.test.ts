import { afterEach, describe, expect, it } from "vitest";
import { pavadzimesSyncSecretConfigured, verifyPavadzimesSyncSecret } from "@/lib/pavadzimes-sync-secret";

describe("pavadzimes-sync-secret", () => {
  const prev = process.env.PAVADZIMES_SYNC_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.PAVADZIMES_SYNC_SECRET;
    else process.env.PAVADZIMES_SYNC_SECRET = prev;
  });

  it("rejects short or missing secret", () => {
    process.env.PAVADZIMES_SYNC_SECRET = "short";
    expect(pavadzimesSyncSecretConfigured()).toBe(false);
    expect(verifyPavadzimesSyncSecret("short")).toBe(false);
  });

  it("accepts matching header with timing-safe compare", () => {
    process.env.PAVADZIMES_SYNC_SECRET = "test-sync-secret-16chars";
    expect(pavadzimesSyncSecretConfigured()).toBe(true);
    expect(verifyPavadzimesSyncSecret("test-sync-secret-16chars")).toBe(true);
    expect(verifyPavadzimesSyncSecret("wrong-secret-value-here")).toBe(false);
  });
});
