import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const blobState = vi.hoisted(() => ({
  stored: JSON.stringify({ probe: true, pad: "H".repeat(70_000) }),
  puts: [] as Array<{ ifMatch?: string }>,
}));

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => ({
    statusCode: 200,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(blobState.stored));
        controller.close();
      },
    }),
    blob: { etag: 'W/"health-1"' },
  })),
  put: vi.fn(async (_path: string, body: string, opts: { ifMatch?: string }) => {
    blobState.puts.push({ ifMatch: opts.ifMatch });
    if (opts.ifMatch && /^W\//i.test(opts.ifMatch)) {
      const err = new Error("Precondition failed: ETag mismatch.");
      err.name = "BlobPreconditionFailedError";
      throw err;
    }
    blobState.stored = body;
    return { url: "https://blob.test/health.json" };
  }),
}));

afterEach(() => {
  blobState.stored = JSON.stringify({ probe: true, pad: "H".repeat(70_000) });
  blobState.puts = [];
  vi.unstubAllEnvs();
});

describe("persistence health payload", () => {
  it("raksta lielu objektu, ne sīku probe", async () => {
    const { PERSISTENCE_HEALTH_MIN_BYTES, buildPersistenceHealthPayload } =
      await import("@/lib/admin-order-persistence-health");
    const payload = buildPersistenceHealthPayload("2026-10-16T00:00:00.000Z");
    expect(Buffer.byteLength(payload, "utf8")).toBeGreaterThan(PERSISTENCE_HEALTH_MIN_BYTES);
    expect(payload).toContain("probe");
  });
});

describe("persistence health ifMatch roundtrip", () => {
  it("izmanto normalizētu ifMatch pret vājo ETag", async () => {
    vi.stubEnv("ADMIN_ORDER_DRAFT_BLOB_PREFIX", "admin-order-drafts/");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    vi.stubEnv("VERCEL", "1");
    const { runPersistenceHealthCheck } = await import("@/lib/admin-order-persistence-health");
    const report = await runPersistenceHealthCheck();
    expect(report.blob.canWrite).toBe(true);
    expect(report.blob.canRead).toBe(true);
    expect(report.blob.canConditionalWrite).toBe(true);
    expect(report.blob.etagWeak).toBe(true);
    expect(blobState.puts.some((p) => p.ifMatch === '"health-1"')).toBe(true);
    expect(blobState.puts.some((p) => p.ifMatch && /^W\//i.test(p.ifMatch))).toBe(false);
    expect(report.ok).toBe(true);
  });
});
