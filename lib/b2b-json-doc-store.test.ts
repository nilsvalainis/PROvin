import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const blobState = vi.hoisted(() => ({
  mode: "ok" as "ok" | "missing" | "network",
  body: JSON.stringify({ n: 1 }),
  /** Ja nav tukšs - nākamās lasīšanas atdod šos tekstus pēc kārtas. */
  bodies: [] as string[],
  reads: 0,
  etag: '"v1"',
  puts: [] as Array<{ pathname: string; body: string; ifMatch?: string }>,
}));

vi.mock("@vercel/blob", () => ({
  BlobNotFoundError: class BlobNotFoundError extends Error {
    constructor(message = "not found") {
      super(message);
      this.name = "BlobNotFoundError";
    }
  },
  get: vi.fn(async () => {
    if (blobState.mode === "network") throw new Error("connect ETIMEDOUT");
    if (blobState.mode === "missing") {
      const err = new Error("The requested blob does not exist");
      err.name = "BlobNotFoundError";
      throw err;
    }
    blobState.reads += 1;
    const body = blobState.bodies.length ? blobState.bodies.shift()! : blobState.body;
    return {
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
          controller.close();
        },
      }),
      blob: { etag: blobState.etag },
    };
  }),
  put: vi.fn(async (pathname: string, body: string, putOpts: { ifMatch?: string }) => {
    blobState.puts.push({ pathname, body, ifMatch: putOpts.ifMatch });
    return { url: `https://blob.test/${pathname}`, etag: '"v2"' };
  }),
}));

afterEach(() => {
  blobState.mode = "ok";
  blobState.body = JSON.stringify({ n: 1 });
  blobState.bodies = [];
  blobState.reads = 0;
  blobState.etag = '"v1"';
  blobState.puts = [];
  vi.unstubAllEnvs();
});

describe("createJsonDocStore blob reads", () => {
  it("does not treat a Blob read failure as an empty document", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const { BlobReadFailedError } = await import("@/lib/blob-read");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.mode = "network";
    await expect(store.read("ptr_aaaaaaaaaaaaaaaa")).rejects.toBeInstanceOf(BlobReadFailedError);
    expect(blobState.puts).toHaveLength(0);
  });

  it("does not treat a non-object JSON body as an empty document", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const { BlobReadFailedError } = await import("@/lib/blob-read");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.mode = "ok";
    blobState.body = "[]";
    await expect(store.read("ptr_aaaaaaaaaaaaaaaa")).rejects.toBeInstanceOf(BlobReadFailedError);
    expect(blobState.puts).toHaveLength(0);
  });

  it("retries once when the Blob text is truncated JSON", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.bodies = ['{"n":7,"s":"nepil'];
    blobState.body = JSON.stringify({ n: 7 });
    await expect(store.read("ptr_aaaaaaaaaaaaaaaa")).resolves.toEqual({ n: 7 });
    expect(blobState.reads).toBe(2);
  });

  it("throws (never empty) when truncated JSON repeats", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const { BlobReadFailedError } = await import("@/lib/blob-read");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.body = '{"n":7,"s":"nepil';
    await expect(store.read("ptr_aaaaaaaaaaaaaaaa")).rejects.toBeInstanceOf(BlobReadFailedError);
    expect(blobState.reads).toBe(2);
    expect(blobState.puts).toHaveLength(0);
  });

  it("returns empty only when the blob is actually missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.mode = "missing";
    await expect(store.read("ptr_aaaaaaaaaaaaaaaa")).resolves.toEqual({ n: 0 });
  });

  it("writes with ifMatch when the document already exists", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const { createJsonDocStore } = await import("@/lib/b2b-json-doc-store");
    const store = createJsonDocStore<{ n: number }>({
      blobPrefix: "b2b-partner-wallets/",
      dirName: "b2b-json-doc-store-test",
      isSafeKey: (key) => key === "ptr_aaaaaaaaaaaaaaaa",
      parse: (raw) => raw as { n: number },
      empty: () => ({ n: 0 }),
    });
    blobState.mode = "ok";
    blobState.body = JSON.stringify({ n: 4 });
    const next = await store.update("ptr_aaaaaaaaaaaaaaaa", (current) => ({
      value: current.n + 1,
      next: { n: current.n + 1 },
    }));
    expect(next).toBe(5);
    expect(blobState.puts).toHaveLength(1);
    expect(blobState.puts[0]?.ifMatch).toBe('"v1"');
    expect(blobState.puts[0]?.body).toBe(JSON.stringify({ n: 5 }));
  });
});
