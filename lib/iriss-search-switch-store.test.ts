/**
 * Meklēšanas slēdzis (Nils 24.11): lauks izdzīvo glabātuves rakstīšanu / lasīšanu / saraksta indeksu,
 * un veca cilne ar novecojušu revīziju to nenodzēš.
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

import { applyIrissOrderStage } from "@/lib/iriss-order-stage";
import { setIrissSearchOn } from "@/lib/iriss-pasutijumi-audit-fields";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("meklēšanas slēdzis glabātuvē", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("saglabājas, redzams sarakstā, veca cilne nenodzēš, statusa maiņa notīra", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "search-switch-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-pasutijumi-store");
    const created = await store.writeIrissPasutijums({ ...emptyIrissPasutijums(ORDER_ID, "2026-11-24T08:00:00.000Z"), brandModel: "BMW 530e", clientFirstName: "Testa" });
    expect(created.ok).toBe(true);
    const v1 = (await store.readIrissPasutijums(ORDER_ID))!;
    expect(v1.searchOverride).toBeUndefined();

    const off = await store.writeIrissPasutijums(setIrissSearchOn(v1, false, { at: "2026-11-24T09:00:00.000Z" }), {
      expectedWorkspaceRevision: v1.workspaceRevision,
    });
    expect(off.ok).toBe(true);
    expect((await store.readIrissPasutijums(ORDER_ID))!.searchOverride).toBe("off");
    expect((await store.listIrissPasutijumi()).find((r) => r.id === ORDER_ID)?.searchOverride).toBe("off");

    // Veca cilne (pirms slēdža) saglabā citu lauku ar novecojušu revīziju.
    const stale = await store.writeIrissPasutijums({ ...v1, notes: "piezīme no vecās cilnes" }, { expectedWorkspaceRevision: v1.workspaceRevision });
    const afterStale = (await store.readIrissPasutijums(ORDER_ID))!;
    if (stale.ok) expect(afterStale.notes).toBe("piezīme no vecās cilnes");
    expect(afterStale.searchOverride).toBe("off");

    const staged = await store.writeIrissPasutijums(applyIrissOrderStage(afterStale, "reserved", { at: "2026-11-24T10:00:00.000Z" }), {
      expectedWorkspaceRevision: afterStale.workspaceRevision,
    });
    expect(staged.ok).toBe(true);
    const done = (await store.readIrissPasutijums(ORDER_ID))!;
    expect(done.listStatus).toBe("reserved");
    expect(done.searchOverride).toBeUndefined();
    expect((await store.listIrissPasutijumi()).find((r) => r.id === ORDER_ID)?.searchOverride).toBeUndefined();
  });
});
