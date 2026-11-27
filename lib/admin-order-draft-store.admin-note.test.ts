/**
 * Iekšējā piezīme melnrakstā: PATCH ar tikai `adminNote` sapludinās ar pārējiem laukiem; `null` dzēš.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobs = new Map<string, string>();

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: string) => {
    blobs.set(pathname, body);
    return { pathname, etag: `"${blobs.size}-${body.length}"` };
  }),
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([pathname, body]) => ({ pathname, size: body.length, uploadedAt: new Date() })),
    hasMore: false,
  })),
  del: vi.fn(async (paths: string[]) => {
    for (const p of paths) blobs.delete(p);
  }),
  get: vi.fn(async (pathname: string) => {
    const body = blobs.get(pathname);
    if (body === undefined) return null;
    return { statusCode: 200, stream: new Response(body).body, blob: { etag: `"${body.length}"` } };
  }),
}));
vi.mock("@/lib/admin-stripe-cache", () => ({
  getStripeCheckoutSessionMeta: async () => ({ checkoutLine: "provin_audit" }),
}));
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: async () => null }));
const indexUpserts: unknown[] = [];
vi.mock("@/lib/admin-dashboard-draft-index", () => ({
  dashboardDraftEntryFromOrderEdits: (oe: { adminNote?: unknown } | null) => ({ adminNote: oe?.adminNote ?? null }),
  upsertDashboardDraftIndexEntry: async (_id: string, patch: unknown) => {
    indexUpserts.push(patch);
  },
}));
vi.mock("@/lib/admin-ai-historical-context", () => ({ invalidateHistoricalReportsIndexCache: () => undefined }));
vi.mock("@/lib/admin-ai-order-context", () => ({ invalidateAiOrderContextCache: () => undefined }));
vi.mock("@/lib/admin-ai-aggregate-knowledge", () => ({
  recordAuditAggregateLearningFromDraft: async () => undefined,
  invalidateAuditLearningsCache: () => undefined,
}));

import { patchOrderDraft, readOrderDraftUncached } from "@/lib/admin-order-draft-store";
import { invalidateOrderDraftCache } from "@/lib/admin-order-draft-cache";
import { resetBlobRevisionThrottleForTests } from "@/lib/admin-order-draft-revisions-blob";

const SID = "cs_live_test_admin_note";
const NOTE = { text: "Mēģināt dabūt citur", color: "red" as const, resolved: false, updatedAt: "2026-11-27T12:32:00.000Z" };

beforeEach(() => {
  blobs.clear();
  indexUpserts.length = 0;
  resetBlobRevisionThrottleForTests();
  invalidateOrderDraftCache(SID);
  vi.stubEnv("ADMIN_ORDER_DRAFT_BLOB_PREFIX", "admin-order-drafts/");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_fake");
  vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", "off");
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function read() {
  invalidateOrderDraftCache(SID);
  return readOrderDraftUncached(SID);
}

describe("orderEdits.adminNote", () => {
  it("saglabā, sapludina ar citiem laukiem, atrisina un dzēš", async () => {
    expect((await patchOrderDraft(SID, { orderEdits: { vin: "WBA5R1C0XLFH42873", notes: "klienta" } })).ok).toBe(true);
    expect((await patchOrderDraft(SID, { orderEdits: { adminNote: NOTE } })).ok).toBe(true);
    let d = await read();
    expect(d!.orderEdits.vin).toBe("WBA5R1C0XLFH42873");
    expect(d!.orderEdits.notes).toBe("klienta");
    expect(d!.orderEdits.adminNote).toEqual(NOTE);
    expect(indexUpserts.at(-1)).toEqual({ adminNote: NOTE });

    // Parastā autosaglabāšana (bez adminNote) piezīmi neaiztiek.
    expect((await patchOrderDraft(SID, { orderEdits: { vin: "WBA5R1C0XLFH42873", customerName: "Jānis" } })).ok).toBe(true);
    d = await read();
    expect(d!.orderEdits.adminNote).toEqual(NOTE);

    const resolved = { ...NOTE, resolved: true, updatedAt: "2026-11-28T07:10:00.000Z" };
    await patchOrderDraft(SID, { orderEdits: { adminNote: resolved } });
    d = await read();
    expect(d!.orderEdits.adminNote).toEqual(resolved);

    await patchOrderDraft(SID, { orderEdits: { adminNote: null } });
    d = await read();
    expect(d!.orderEdits.adminNote).toBeUndefined();
    expect("adminNote" in d!.orderEdits).toBe(false);
    expect(d!.orderEdits.customerName).toBe("Jānis");
    expect(indexUpserts.at(-1)).toEqual({ adminNote: null });
  });
});
