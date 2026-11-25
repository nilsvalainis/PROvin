/**
 * 25.11 incidents: divi pārlūki vienam pasūtījumam. Serveris ar Blob (mock) - revīzijas, shrink aizsargs, atjaunošana.
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
vi.mock("@/lib/admin-dashboard-draft-index", () => ({
  dashboardDraftEntryFromOrderEdits: () => ({}),
  upsertDashboardDraftIndexEntry: async () => undefined,
}));
vi.mock("@/lib/admin-ai-historical-context", () => ({ invalidateHistoricalReportsIndexCache: () => undefined }));
vi.mock("@/lib/admin-ai-order-context", () => ({ invalidateAiOrderContextCache: () => undefined }));
vi.mock("@/lib/admin-ai-aggregate-knowledge", () => ({
  recordAuditAggregateLearningFromDraft: async () => undefined,
  invalidateAuditLearningsCache: () => undefined,
}));

import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import {
  listOrderDraftRevisions,
  patchOrderDraft,
  readOrderDraftUncached,
  restoreOrderDraftRevision,
} from "@/lib/admin-order-draft-store";
import { invalidateOrderDraftCache } from "@/lib/admin-order-draft-cache";
import { resetBlobRevisionThrottleForTests } from "@/lib/admin-order-draft-revisions-blob";
import { orderDraftWorkspaceToPersistBody } from "@/lib/admin-order-draft-workspace-merge";
import { countWorkspaceFilled, mergeStaleLocalWithServer } from "@/lib/admin-workspace-safety";
import { buildOrderDraftWorkspaceBody } from "@/lib/admin-order-workspace-persist";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

const SID = "cs_live_test_two_browsers";

function ws(fields: Partial<OrderDraftWorkspaceBody> = {}): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    pdfVisibility: mergePdfVisibility(undefined),
    pdfBannerInclude: {},
    manualBanners: [],
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
    ...fields,
  } as OrderDraftWorkspaceBody;
}

function richWs(): OrderDraftWorkspaceBody {
  const blocks = createDefaultSourceBlocks();
  blocks.autodna = { ...emptyVendorAvotuBlock(), comments: "AutoDNA: nobraukums sakrīt" };
  blocks.carvertical = { ...emptyVendorAvotuBlock(), comments: "CarVertical: bojājums 2021" };
  return ws({
    sourceBlocks: blocks,
    iriss: "<p>Nila IRISS kopsavilkums</p>",
    apskatesPlāns: "Apskatīt slieksni",
    tehniskoRiskuAnalize: "DSG risks",
    cenasAtbilstiba: "Cena atbilst tirgum",
  });
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  blobs.clear();
  resetBlobRevisionThrottleForTests();
  invalidateOrderDraftCache(SID);
  vi.stubEnv("ADMIN_ORDER_DRAFT_BLOB_PREFIX", "admin-order-drafts/");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test_fake");
  vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", "off");
  vi.stubEnv("VERCEL", "");
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("divi pārlūki vienam pasūtījumam (server)", () => {
  it("A rediģē un nesaglabā, B atver tukšu un saglabā -> A apvieno, dati serverī un revīzijā atjaunojami", async () => {
    // rev 1: gandrīz tukšs (kā incidentā).
    const r1 = await patchOrderDraft(SID, { workspace: ws({ cenasAtbilstiba: "x" }) });
    expect(r1.ok && r1.workspaceRevision).toBe(1);

    // B: atver tukšu un saglabā (rev 2).
    const rB = await patchOrderDraft(SID, { workspace: ws() }, { expectedWorkspaceRevision: 1 });
    expect(rB.ok && rB.workspaceRevision).toBe(2);

    // A: nesaglabātie dati -> PATCH ar veco revīziju = 409 stale (nekad nepārraksta aklā).
    const aLocal = richWs();
    const stale = await patchOrderDraft(SID, { workspace: aLocal }, { expectedWorkspaceRevision: 1 });
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.error).toBe("stale_revision");

    // A klients: ielādē servera versiju, apvieno (A lauki mainīti pēc... vai serverī tukši), saglabā ar svaigu revīziju.
    invalidateOrderDraftCache(SID);
    const server = await readOrderDraftUncached(SID);
    const serverBody = orderDraftWorkspaceToPersistBody(server!.workspace!);
    // Bāze = rev 1, ko A redzēja atverot. A dati (aizpildīti virs bāzes) uzvar; B tukšums tos neiztukšo.
    const { body: merged } = mergeStaleLocalWithServer(
      orderDraftWorkspaceToPersistBody(aLocal),
      serverBody,
      orderDraftWorkspaceToPersistBody(ws({ cenasAtbilstiba: "x" })),
    );
    const mergedWs = buildOrderDraftWorkspaceBody(merged, mergePdfVisibility(undefined), {}, serverBody, []);
    const rA = await patchOrderDraft(SID, { workspace: mergedWs }, { expectedWorkspaceRevision: 2 });
    expect(rA.ok && rA.workspaceRevision).toBe(3);
    const afterA = await readOrderDraftUncached(SID);
    expect(afterA!.workspace!.iriss).toContain("Nila IRISS");
    expect(countWorkspaceFilled(orderDraftWorkspaceToPersistBody(afterA!.workspace!)).total).toBe(6);

    // B vēlreiz: apzināti iztukšo (svaigi clearedFields marķieri) -> shrink: revīzija + žurnāls, bet neatraida.
    resetBlobRevisionThrottleForTests();
    const now = Date.now();
    const rB2 = await patchOrderDraft(
      SID,
      {
        workspace: ws({
          clearedFields: { iriss: now, apskatesPlāns: now, tehniskoRiskuAnalize: now, cenasAtbilstiba: now },
          sourceBlockWipes: ["autodna", "carvertical"],
        }),
      },
      { expectedWorkspaceRevision: 3 },
    );
    expect(rB2.ok).toBe(true);
    const shrinkLog = warn.mock.calls.filter((c) => c[0] === "[workspace:overwrite_shrink]").at(-1);
    expect(shrinkLog).toBeTruthy();
    const logged = shrinkLog![1] as Record<string, unknown>;
    expect(logged.sessionId).toBe(SID);
    expect(logged.prevFields).toBe(4);
    expect(logged.prevBlocks).toBe(2);
    expect(JSON.stringify(logged)).not.toContain("Nila IRISS");

    // Revīzija ar A datiem ir Blob un atjaunojama.
    const revisions = await listOrderDraftRevisions(SID, 40);
    expect(revisions.length).toBeGreaterThan(0);
    expect([...blobs.keys()].some((k) => k.startsWith(`admin-order-draft-revisions/${SID}/`))).toBe(true);
    const withA = revisions.find((r) => r.reason.startsWith("rev 3"));
    expect(withA).toBeTruthy();
    const restored = await restoreOrderDraftRevision(SID, withA!.revisionId);
    expect(restored.ok).toBe(true);
    invalidateOrderDraftCache(SID);
    const final = await readOrderDraftUncached(SID);
    expect(final!.workspace!.iriss).toContain("Nila IRISS");
    expect(orderDraftWorkspaceToPersistBody(final!.workspace!).sourceBlocks.carvertical.comments).toContain("CarVertical");
  });

  it("tukšs PATCH pār aizpildītu bez marķieriem - saturs paliek (coalesce), shrink žurnālā", async () => {
    await patchOrderDraft(SID, { workspace: richWs() });
    resetBlobRevisionThrottleForTests();
    const r = await patchOrderDraft(SID, { workspace: ws() }, { expectedWorkspaceRevision: 1 });
    // Esošais aizsargs var atraidīt (overwrite_blocked) vai apvienot - abos gadījumos dati paliek.
    invalidateOrderDraftCache(SID);
    const d = await readOrderDraftUncached(SID);
    expect(d!.workspace!.iriss).toContain("Nila IRISS");
    if (r.ok) expect(warn.mock.calls.some((c) => c[0] === "[workspace:overwrite_shrink]")).toBe(true);
  });

  it("parasts PATCH: revīzija ne biežāk kā 1x minūtē", async () => {
    await patchOrderDraft(SID, { workspace: ws({ iriss: "a" }) });
    await patchOrderDraft(SID, { workspace: ws({ iriss: "ab" }) });
    await patchOrderDraft(SID, { workspace: ws({ iriss: "abc" }) });
    const revs = [...blobs.keys()].filter((k) => k.startsWith("admin-order-draft-revisions/"));
    expect(revs.length).toBe(1);
  });

  it("revīzijas nav pasūtījumu prefiksā; atjaunošana patur pašreizējos orderEdits", async () => {
    await patchOrderDraft(SID, { workspace: richWs(), orderEdits: { vin: "WVWZZZ3CZNE000001" } });
    resetBlobRevisionThrottleForTests();
    await patchOrderDraft(SID, { workspace: ws({ iriss: "cits" }), orderEdits: { vin: "WVWZZZ3CZNE054721" } }, { expectedWorkspaceRevision: 1 });
    expect([...blobs.keys()].filter((k) => k.startsWith("admin-order-drafts/"))).toEqual([`admin-order-drafts/${SID}.json`]);
    const revs = await listOrderDraftRevisions(SID, 40);
    const r = await restoreOrderDraftRevision(SID, revs[revs.length - 1]!.revisionId);
    expect(r.ok).toBe(true);
    invalidateOrderDraftCache(SID);
    const d = await readOrderDraftUncached(SID);
    expect(d!.orderEdits.vin).toBe("WVWZZZ3CZNE054721");
  });
});
