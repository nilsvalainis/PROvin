import { beforeEach, describe, expect, it, vi } from "vitest";

const blobs = new Map<string, string>();
const deleted: string[] = [];

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: string) => {
    blobs.set(pathname, body);
    return { pathname, etag: '"e"' };
  }),
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([pathname, body]) => ({ pathname, size: body.length, uploadedAt: new Date() })),
    hasMore: false,
  })),
  del: vi.fn(async (paths: string[]) => {
    for (const p of paths) {
      blobs.delete(p);
      deleted.push(p);
    }
  }),
  get: vi.fn(async (pathname: string) => {
    const body = blobs.get(pathname);
    if (body === undefined) return null;
    return { statusCode: 200, stream: new Response(body).body };
  }),
}));

import {
  blobRevisionId,
  isBlobRevisionId,
  listBlobRevisions,
  MAX_BLOB_REVISIONS_PER_SESSION,
  readBlobRevisionDoc,
  resetBlobRevisionThrottleForTests,
  shouldWriteBlobRevision,
  writeBlobRevision,
} from "@/lib/admin-order-draft-revisions-blob";

const cfg = { token: "test-token", prefix: "admin-order-drafts/" };
const sid = "cs_test_abc";

beforeEach(() => {
  blobs.clear();
  deleted.length = 0;
  resetBlobRevisionThrottleForTests();
});

describe("Blob revīzijas", () => {
  it("raksta iepriekšējo versiju pareizajā ceļā un nolasa atpakaļ", async () => {
    const now = new Date("2026-11-25T10:32:00.123Z");
    const id = await writeBlobRevision(cfg, sid, { sessionId: sid, updatedAt: "x", workspace: { iriss: "A" } }, {
      revision: 3,
      reason: "patch",
      now,
    });
    expect(id).toBe("20261125T103200123Z-rev3");
    expect(isBlobRevisionId(id!)).toBe(true);
    expect([...blobs.keys()]).toEqual([`admin-order-drafts/_revisions/${sid}/20261125T103200123Z-rev3.json`]);
    const doc = (await readBlobRevisionDoc(cfg, sid, id!)) as { workspace: { iriss: string } };
    expect(doc.workspace.iriss).toBe("A");
    const listed = await listBlobRevisions(cfg, sid);
    expect(listed[0]!.revisionId).toBe(id);
    expect(listed[0]!.savedAt).toBe("2026-11-25T10:32:00.123Z");
    expect(listed[0]!.reason).toMatch(/^rev 3/);
  });

  it("throttle: parastu revīziju ne biežāk kā 1x minūtē, shrink vienmēr", async () => {
    expect(shouldWriteBlobRevision(sid, { nowMs: 1_000_000 })).toBe(true);
    await writeBlobRevision(cfg, sid, { a: 1 }, { revision: 1, reason: "patch", now: new Date(1_000_000) });
    expect(shouldWriteBlobRevision(sid, { nowMs: 1_030_000 })).toBe(false);
    expect(shouldWriteBlobRevision(sid, { nowMs: 1_030_000, force: true })).toBe(true);
    expect(shouldWriteBlobRevision(sid, { nowMs: 1_061_000 })).toBe(true);
  });

  it("patur pēdējās 40 + lielāko (bagātāko) kopiju", async () => {
    const base = Date.parse("2026-11-25T08:00:00.000Z");
    // Pati pirmā - liela (bagāta) versija.
    await writeBlobRevision(cfg, sid, { big: "x".repeat(5000) }, { revision: 0, reason: "patch", now: new Date(base) });
    for (let i = 1; i <= MAX_BLOB_REVISIONS_PER_SESSION + 5; i++) {
      await writeBlobRevision(cfg, sid, { small: i }, { revision: i, reason: "patch", now: new Date(base + i * 61_000) });
    }
    const listed = await listBlobRevisions(cfg, sid, 100);
    expect(listed.length).toBe(MAX_BLOB_REVISIONS_PER_SESSION + 1);
    expect(listed.some((r) => r.revisionId === blobRevisionId(0, new Date(base)))).toBe(true);
    expect(deleted.length).toBe(5);
  });

  it("neraksta, ja nav iepriekšējās versijas", async () => {
    expect(await writeBlobRevision(cfg, sid, null, { revision: 0, reason: "patch" })).toBeNull();
    expect(blobs.size).toBe(0);
  });

  it("noraida svešus revīzijas id", async () => {
    expect(await readBlobRevisionDoc(cfg, sid, "../cs_other")).toBeNull();
  });
});
