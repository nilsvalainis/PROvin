import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state: { draft: Record<string, unknown> | null; patches: unknown[]; scanArgs: unknown[]; pushes: unknown[] } = {
  draft: null,
  patches: [],
  scanArgs: [],
  pushes: [],
};

vi.mock("@/lib/admin-order-draft-store", () => ({
  isSafeOrderDraftSessionId: (id: string) => id.startsWith("cs_"),
  readOrderDraft: vi.fn(async () => state.draft),
  patchOrderDraft: vi.fn(async (_id: string, patch: { workspace: unknown }) => {
    state.patches.push(patch);
    state.draft = { ...(state.draft ?? {}), workspace: patch.workspace, workspaceRevision: 2 };
    return { ok: true };
  }),
}));
const locks = new Map<string, "claimed" | "done">();
vi.mock("@/lib/stripe-webhook-dedupe-store", () => ({
  tryBeginStripeEvent: vi.fn(async (key: string) => {
    if (locks.has(key)) return false;
    locks.set(key, "claimed");
    return true;
  }),
  completeStripeEvent: vi.fn(async (key: string) => void locks.set(key, "done")),
  releaseStripeEvent: vi.fn(async (key: string) => void locks.delete(key)),
}));
vi.mock("@/lib/admin-push", () => ({
  sendAdminPush: vi.fn(async (msg: unknown) => {
    state.pushes.push(msg);
    return { sent: 1, removed: 0 };
  }),
}));
vi.mock("@/lib/order-vin-scan-run", () => ({
  runOrderFreeVinScan: vi.fn(async (_id: string, opts: unknown) => {
    state.scanArgs.push(opts);
    const { buildVinScanIndicator } = await import("@/lib/vin-scan/types");
    state.draft = {
      ...(state.draft ?? {}),
      vinScan: {
        at: "2026-11-25T10:00:00.000Z",
        vin: VIN,
        status: "done",
        indicators: [
          buildVinScanIndicator("csdd", VIN, { status: "found", summary: "CSDD", vehicle: { make: "BMW", model: "320d", year: "2019" } }),
          buildVinScanIndicator("autodna_precheck", VIN, { status: "found", summary: "AutoDNA priekšskatījums: 3 foto" }),
          buildVinScanIndicator("thecarapi_eu", VIN, { status: "none", summary: "nav" }),
        ],
      },
    };
    return { ok: true, vin: VIN, found: 2 };
  }),
}));
const thecarapiMerge = vi.fn();
vi.mock("@/lib/thecarapi-cc-vin", () => ({ fetchThecarapiCcVinMerge: (...a: unknown[]) => thecarapiMerge(...a) }));
vi.mock("@/lib/order-vin-scan-photo-import", () => ({
  importVinScanAuctionPhotoGroupsToCcVin: vi.fn(async () => ({ groups: [], photoIds: [], imported: 0, skipped: 0, failed: 0, failedUrls: [] })),
  plansToImportGroups: (p: unknown[]) => p,
}));
vi.mock("@/lib/admin-cc-vin-photo-store", () => ({ collectCcVinPhotoIdsFromWorkspace: () => new Set() }));

const VIN = "WBA5R1C0XLFH42873";

describe("runOrderAutoIntake (fona automātika pēc apmaksas)", () => {
  beforeEach(async () => {
    const { createDefaultSourceBlocks, emptyCsddFields } = await import("@/lib/admin-source-blocks");
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = { ...emptyCsddFields(), registrationNumber: "AB1234", firstRegistration: "2019-03-12" };
    state.draft = {
      workspace: {
        sourceBlocks: blocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
      },
      workspaceRevision: 1,
    };
    state.patches = [];
    state.scanArgs = [];
    state.pushes = [];
    locks.clear();
    thecarapiMerge.mockReset();
    vi.stubEnv("THECARAPI_API_KEY", "");
  });

  it("VIN SCAN ar CSDD numurzīmi un datumu, imports blokos, viena push ziņa", async () => {
    const { runOrderAutoIntake } = await import("@/lib/order-auto-intake");
    const r = await runOrderAutoIntake("cs_test_1", {
      vin: VIN,
      listingUrl: null,
      trigger: "webhook",
      deadlineAt: Date.now() + 200_000,
    });
    expect(r.ok).toBe(true);
    expect(state.scanArgs[0]).toMatchObject({ vin: VIN, firstRegDate: "12.03.2019", plates: { lv: "AB1234" } });
    expect(state.patches.length).toBe(1);
    const ws = (state.patches[0] as { workspace: { sourceBlocks: { csdd: { makeModel: string } } } }).workspace;
    expect(ws.sourceBlocks.csdd.makeModel).toBe("BMW 320d");
    expect(state.pushes).toHaveLength(1);
    expect((state.pushes[0] as { body: string }).body).toContain("AutoDNA priekšskatījums: 3 foto");
    // TheCarApi nav konfigurēts / VIN SCAN teica «nav» - nesaucam.
    expect(thecarapiMerge).not.toHaveBeenCalled();
  });

  it("dīlera produktam push nesūta; bez VIN - neko nedara", async () => {
    const { runOrderAutoIntake } = await import("@/lib/order-auto-intake");
    await runOrderAutoIntake("cs_test_2", { vin: VIN, trigger: "background", deadlineAt: Date.now() + 200_000, skipPush: true });
    expect(state.pushes).toHaveLength(0);
    const none = await runOrderAutoIntake("cs_test_3", { vin: "", trigger: "webhook", deadlineAt: Date.now() + 200_000 });
    expect(none).toEqual({ ok: false, reason: "no_vin" });
  });

  it("idempotence: atkārtots webhook / fona maršruts tam pašam pasūtījumam + VIN nepalaiž otrreiz", async () => {
    const { runOrderAutoIntake } = await import("@/lib/order-auto-intake");
    const a = runOrderAutoIntake("cs_test_5", { vin: VIN, trigger: "webhook", deadlineAt: Date.now() + 200_000 });
    const b = runOrderAutoIntake("cs_test_5", { vin: VIN, trigger: "background", deadlineAt: Date.now() + 200_000 });
    const [ra, rb] = await Promise.all([a, b]);
    expect([ra.reason, rb.reason].filter((r) => r === "already_ran")).toHaveLength(1);
    expect(state.scanArgs).toHaveLength(1);
    expect(state.pushes).toHaveLength(1);
    const again = await runOrderAutoIntake("cs_test_5", { vin: VIN, trigger: "background", deadlineAt: Date.now() + 200_000 });
    expect(again).toEqual({ ok: true, reason: "already_ran" });
    expect(state.scanArgs).toHaveLength(1);
  });

  it("kļūdas gadījumā atslēga atbrīvota - nākamais mēģinājums drīkst palaist", async () => {
    const { runOrderFreeVinScan } = await import("@/lib/order-vin-scan-run");
    vi.mocked(runOrderFreeVinScan).mockRejectedValueOnce(new Error("boom"));
    const { runOrderAutoIntake } = await import("@/lib/order-auto-intake");
    await expect(
      runOrderAutoIntake("cs_test_6", { vin: VIN, trigger: "webhook", deadlineAt: Date.now() + 200_000 }),
    ).rejects.toThrow("boom");
    const r = await runOrderAutoIntake("cs_test_6", { vin: VIN, trigger: "background", deadlineAt: Date.now() + 200_000 });
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("maz laika līdz termiņam - foto un TheCarApi nesāk", async () => {
    vi.stubEnv("THECARAPI_API_KEY", "x".repeat(20));
    vi.stubEnv("THECARAPI_ADMIN_ENABLED", "1");
    const { runOrderAutoIntake } = await import("@/lib/order-auto-intake");
    await runOrderAutoIntake("cs_test_4", { vin: VIN, trigger: "webhook", deadlineAt: Date.now() + 5_000 });
    expect(thecarapiMerge).not.toHaveBeenCalled();
  });
});
