import { afterEach, describe, expect, it, vi } from "vitest";
import { ConditionalWriteConflict } from "@/lib/conditional-write";

type PutCall = {
  pathname: string;
  body: string;
  ifMatch?: string;
  allowOverwrite?: boolean;
};

const blobState = vi.hoisted(() => ({
  getEtag: 'W/"abc"',
  getBody: JSON.stringify({ ok: true }),
  rejectWeakIfMatch: true,
  alwaysConflict: false,
  puts: [] as PutCall[],
}));

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => ({
    statusCode: 200,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(blobState.getBody));
        controller.close();
      },
    }),
    blob: { etag: blobState.getEtag },
  })),
  put: vi.fn(async (pathname: string, body: string, putOpts: { ifMatch?: string; allowOverwrite?: boolean }) => {
    blobState.puts.push({
      pathname,
      body,
      ifMatch: putOpts.ifMatch,
      allowOverwrite: putOpts.allowOverwrite,
    });
    if (blobState.alwaysConflict) {
      const err = new Error("Precondition failed: ETag mismatch.");
      err.name = "BlobPreconditionFailedError";
      throw err;
    }
    if (blobState.rejectWeakIfMatch && putOpts.ifMatch && /^W\//i.test(putOpts.ifMatch)) {
      const err = new Error("Precondition failed: ETag mismatch.");
      err.name = "BlobPreconditionFailedError";
      throw err;
    }
    return { url: `https://blob.test/${pathname}` };
  }),
}));

afterEach(async () => {
  blobState.getEtag = 'W/"abc"';
  blobState.getBody = JSON.stringify({ ok: true });
  blobState.rejectWeakIfMatch = true;
  blobState.alwaysConflict = false;
  blobState.puts = [];
  const { put } = await import("@vercel/blob");
  vi.mocked(put).mockClear();
});

describe("blob ifMatch save path", () => {
  it("liels (>64KB) objekts ar vājo ETag saglabājas pēc W/ noņemšanas", async () => {
    const large = JSON.stringify({ pad: "X".repeat(70_000), note: "operatora teksts" });
    expect(Buffer.byteLength(large, "utf8")).toBeGreaterThan(64 * 1024);
    blobState.getEtag = 'W/"large-1"';
    blobState.getBody = large;
    blobState.rejectWeakIfMatch = true;
    const { putBlobBodyIfMatch } = await import("@/lib/blob-if-match-put");
    await putBlobBodyIfMatch({
      pathname: "admin-order-drafts/cs_test.json",
      body: large,
      token: "tok",
      etag: 'W/"large-1"',
      seen: true,
    });
    expect(blobState.puts).toHaveLength(1);
    expect(blobState.puts[0]?.ifMatch).toBe('"large-1"');
    expect(blobState.puts[0]?.ifMatch).not.toMatch(/^W\//i);
    expect(blobState.puts[0]?.body.length).toBeGreaterThan(64 * 1024);
  });

  it("tas pats vājais ETag bez normalizācijas tiktu noraidīts", async () => {
    const { put } = await import("@vercel/blob");
    await expect(
      put("x.json", "{}", {
        access: "private",
        token: "tok",
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: 'W/"raw"',
      }),
    ).rejects.toMatchObject({ name: "BlobPreconditionFailedError" });
    expect(blobState.puts[0]?.ifMatch).toBe('W/"raw"');
  });

  it("konflikta atkārtojumu izsīkums izmet kļūdu, nevis klusē", async () => {
    blobState.getEtag = '"stale"';
    blobState.alwaysConflict = true;
    const { writeBlobBodyWithConflictRetry, BLOB_CAS_ATTEMPTS } = await import("@/lib/blob-if-match-put");
    await expect(
      writeBlobBodyWithConflictRetry({
        pathname: "admin-order-drafts/cs_test.json",
        body: JSON.stringify({ workspace: { iriss: "jauns teksts" } }),
        token: "tok",
      }),
    ).rejects.toBeInstanceOf(ConditionalWriteConflict);
    expect(blobState.puts).toHaveLength(BLOB_CAS_ATTEMPTS);
  });
});
