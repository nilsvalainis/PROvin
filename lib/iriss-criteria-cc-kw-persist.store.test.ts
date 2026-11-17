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

import { applyIrissOrderRangeEdit, irissOrderRangeView } from "@/lib/iriss-order-range-fields";
import { irissSaveWirePayload } from "@/lib/iriss-pasutijumi-autosave-wire";
import { parseIrissPasutijumsPatchBody } from "@/lib/iriss-pasutijumi-body";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { emptyIrissPasutijums, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-10-26T15:00:00.000Z";

/** Kā pārlūks: PATCH ķermenis iet caur JSON un maršruta parsētāju. */
function wireBody(rec: IrissPasutijumsRecord): IrissPasutijumsRecord {
  const body = JSON.parse(
    JSON.stringify({ ...irissSaveWirePayload(rec), expectedWorkspaceRevision: irissWorkspaceRevision(rec) }),
  ) as unknown;
  const parsed = parseIrissPasutijumsPatchBody(ORDER_ID, body);
  if (!parsed) throw new Error("invalid body");
  return parsed;
}

describe("IRISS Kritēriji: Tilpums un Jauda pēc Saglabāt + reload (FS store)", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    rmSync(path.join(process.cwd(), ".data", "iriss-pasutijumi-backups"), { recursive: true, force: true });
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-cckw-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR", "disabled");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_FULL_BUNDLE", "0");
    vi.resetModules();
    return import("@/lib/iriss-pasutijumi-store");
  }

  async function seed(store: Awaited<ReturnType<typeof load>>): Promise<IrissPasutijumsRecord> {
    const base: IrissPasutijumsRecord = {
      ...emptyIrissPasutijums(ORDER_ID, NOW),
      clientFirstName: "Lauris",
      phone: "+37120000000",
      brandModel: "Škoda Kodiaq",
      totalBudget: "23000",
      productionYears: "2019-2020",
      maxMileage: "150000",
    };
    const w = await store.writeIrissPasutijums(base);
    if (!w.ok) throw new Error(w.error);
    return w.record;
  }

  it("keeps cc/kw ranges after save and reload; Cena/Gadi/Nobraukums stay", async () => {
    const store = await load();
    let rec = await seed(store);
    rec = applyIrissOrderRangeEdit(rec, "ccFrom", "1968", 1);
    rec = applyIrissOrderRangeEdit(rec, "ccTo", "2000", 2);
    rec = applyIrissOrderRangeEdit(rec, "kwFrom", "110", 3);
    rec = applyIrissOrderRangeEdit(rec, "kwTo", "140", 4);

    const body = wireBody(rec);
    const w = await store.writeIrissPasutijums(body, { expectedWorkspaceRevision: irissWorkspaceRevision(body) });
    expect(w.ok).toBe(true);

    const reloaded = await store.readIrissPasutijums(ORDER_ID);
    expect(reloaded).not.toBeNull();
    const view = irissOrderRangeView(reloaded!);
    expect(view).toMatchObject({
      ccFrom: "1968",
      ccTo: "2000",
      kwFrom: "110",
      kwTo: "140",
      budgetTo: "23000",
      yearFrom: "2019",
      yearTo: "2020",
      mileageTo: "150000",
    });
    expect(reloaded!.powerKw).toBe("110-140");
  });

  it("a later save of another field keeps cc/kw", async () => {
    const store = await load();
    let rec = await seed(store);
    rec = applyIrissOrderRangeEdit(rec, "ccTo", "2000", 1);
    rec = applyIrissOrderRangeEdit(rec, "kwFrom", "100", 2);
    const first = await store.writeIrissPasutijums(wireBody(rec), { expectedWorkspaceRevision: irissWorkspaceRevision(rec) });
    if (!first.ok) throw new Error(first.error);

    const notes = wireBody({ ...first.record, notes: "zvanīt rīt" });
    const second = await store.writeIrissPasutijums(notes, { expectedWorkspaceRevision: irissWorkspaceRevision(notes) });
    expect(second.ok).toBe(true);

    const view = irissOrderRangeView((await store.readIrissPasutijums(ORDER_ID))!);
    expect(view.ccTo).toBe("2000");
    expect(view.kwFrom).toBe("100");
    expect(view.budgetTo).toBe("23000");
  });

  it("body without criteria (old tab) does not wipe stored cc/kw", async () => {
    const store = await load();
    let rec = await seed(store);
    rec = applyIrissOrderRangeEdit(rec, "ccFrom", "1600", 1);
    rec = applyIrissOrderRangeEdit(rec, "kwTo", "150", 2);
    const first = await store.writeIrissPasutijums(wireBody(rec), { expectedWorkspaceRevision: irissWorkspaceRevision(rec) });
    if (!first.ok) throw new Error(first.error);

    const old = { ...first.record, notes: "vecā cilne" };
    delete old.criteria;
    const body = wireBody(old);
    expect(body.criteria).toBeUndefined();
    const second = await store.writeIrissPasutijums(body, { expectedWorkspaceRevision: irissWorkspaceRevision(body) });
    expect(second.ok).toBe(true);

    const view = irissOrderRangeView((await store.readIrissPasutijums(ORDER_ID))!);
    expect(view.ccFrom).toBe("1600");
    expect(view.kwTo).toBe("150");
  });
});

describe("parseIrissPasutijumsPatchBody", () => {
  it("keeps a valid criteria object and ignores junk", () => {
    let rec = emptyIrissPasutijums(ORDER_ID, NOW);
    rec = applyIrissOrderRangeEdit(rec, "ccFrom", "1968", 1);
    expect(wireBody(rec).criteria?.filters[0]?.ccFrom.value).toBe(1968);
    const junk = parseIrissPasutijumsPatchBody(ORDER_ID, { criteria: { version: 99, filters: "x" } });
    expect(junk?.criteria).toBeUndefined();
  });
});
