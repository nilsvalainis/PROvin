/**
 * Melnraksta krātuve (īsts failu backends pagaidu mapē): VIN SCAN rezultāts dzīvo blakus pārējam
 * melnrakstam. Operatora saglabāšana to nedrīkst nodzēst, un fona skenējums nedrīkst mainīt
 * darba lapas revīziju (citādi atvērtā forma saņem konfliktu).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-orders", () => ({
  getCheckoutSessionDetail: async (id: string) => ({ id, checkoutLine: "provin_audit", vin: "" }),
}));

const VIN = "WBA5R1C0XLFH42873";
let SESSION = "cs_test_vinscan_persist";
let seq = 0;

function record(status: "running" | "done", summary: string) {
  return {
    at: new Date().toISOString(),
    vin: VIN,
    status,
    indicators: [
      { id: "stat_vin", label: "stat.vin", country: "US", status: "found", summary, detail: "", openUrl: `https://stat.vin/cars/${VIN}` },
    ],
  };
}

/* Rezerve ir smagā moduļu grafa ielādei, kad paralēli skrien daudz testu failu; paši testi ir ~ms. */
describe("melnraksts saglabā VIN SCAN blakus pārējiem laukiem", { timeout: 30_000 }, () => {
  let tmpDir = "";

  beforeAll(async () => {
    await import("@/lib/admin-order-draft-store");
  }, 60_000);

  let spies: { mockRestore: () => void }[] = [];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "provin-vinscan-draft-"));
    /* Katram testam sava sesija: krātuves kešs atmiņā nedrīkst pāriet no iepriekšējā testa. */
    seq += 1;
    SESSION = `cs_test_vinscan_persist_${seq}`;
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("ADMIN_ORDER_DRAFT_BLOB_PREFIX", "");
    vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", tmpDir);
    spies = [
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    for (const spy of spies) spy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("operatora saglabāšana pēc skenējuma VIN SCAN nenodzēš; skenējums nemaina revīziju", async () => {
    const store = await import("@/lib/admin-order-draft-store");
    const first = await store.patchOrderDraft(SESSION, { orderEdits: { vin: VIN } });
    expect(first).toMatchObject({ ok: true });
    const rev1 = (await store.readOrderDraftUncached(SESSION))?.workspaceRevision;

    expect(await store.upsertOrderDraftVinScan(SESSION, record("done", "Copart 2021") as never)).toMatchObject({ ok: true });
    const afterScan = await store.readOrderDraftUncached(SESSION);
    expect(afterScan?.vinScan).toMatchObject({ vin: VIN, status: "done" });
    expect(afterScan?.workspaceRevision).toBe(rev1);
    expect(afterScan?.orderEdits).toMatchObject({ vin: VIN });

    const second = await store.patchOrderDraft(SESSION, { orderEdits: { vin: VIN, notes: "piezīme" } as never });
    expect(second).toMatchObject({ ok: true });
    const afterPatch = await store.readOrderDraftUncached(SESSION);
    expect(afterPatch?.vinScan).toMatchObject({ vin: VIN, status: "done" });
    expect(afterPatch?.vinScan?.indicators[0]).toMatchObject({ id: "stat_vin", summary: "Copart 2021" });
  });

  it("fona skenējuma ieraksts saglabā darba lapas revīziju un automātiski ielasītos avotus", async () => {
    const store = await import("@/lib/admin-order-draft-store");
    await store.patchOrderDraft(SESSION, { orderEdits: { vin: VIN } });
    const file = path.join(tmpDir, `${SESSION}.json`);
    const onDisk = JSON.parse(await fs.readFile(file, "utf8"));
    const autoIngest = { at: "2026-11-17T09:00:00.000Z", status: "done", sources: {} };
    await fs.writeFile(file, JSON.stringify({ ...onDisk, workspaceRevision: 7, autoIngest }));
    const before = await store.readOrderDraftUncached(SESSION);
    expect(before?.workspaceRevision).toBe(7);
    expect(before?.autoIngest).toBeTruthy();

    expect(await store.upsertOrderDraftVinScan(SESSION, record("done", "Copart 2021") as never)).toMatchObject({ ok: true });
    const after = await store.readOrderDraftUncached(SESSION);
    expect(after?.workspaceRevision).toBe(7);
    expect(after?.autoIngest).toEqual(before?.autoIngest);
    expect(after?.vinScan).toMatchObject({ vin: VIN, status: "done" });
  });

  it("vienlaicīga saglabāšana un skenējuma ieraksts nepazaudē nevienu no abiem", async () => {
    const store = await import("@/lib/admin-order-draft-store");
    await store.patchOrderDraft(SESSION, { orderEdits: { vin: VIN } });
    const results = await Promise.all([
      store.upsertOrderDraftVinScan(SESSION, record("running", "") as never),
      store.patchOrderDraft(SESSION, { orderEdits: { vin: VIN } }),
      store.upsertOrderDraftVinScan(SESSION, record("done", "IAAI 2020") as never),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: true });
    const doc = await store.readOrderDraftUncached(SESSION);
    expect(doc?.vinScan).toMatchObject({ status: "done" });
    expect(doc?.orderEdits).toMatchObject({ vin: VIN });
  });

  it("nederīgu VIN SCAN ierakstu krātuve nepieņem", async () => {
    const store = await import("@/lib/admin-order-draft-store");
    expect(await store.upsertOrderDraftVinScan(SESSION, { vin: "", status: "done" } as never)).toEqual({
      ok: false,
      error: "invalid_vin_scan",
    });
  });
});
