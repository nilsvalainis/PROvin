import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ dir: "", draft: null as unknown }));
vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => null,
  getOrderDraftStorageDir: () => state.dir,
  readOrderDraft: async () => state.draft,
}));

import { readDealerCoverageAggregate, recordDealerCoverageForSession } from "@/lib/dealer-coverage-store";

const VIN = "WAUZZZ4G0EN000001";

describe("dealer-coverage-store (lokāli)", () => {
  beforeEach(async () => {
    state.dir = await fs.mkdtemp(path.join(os.tmpdir(), "dealer-cov-"));
    state.draft = {
      workspace: { sourceBlocks: { csdd: { makeModel: "AUDI A6", registry: { data: { make: "AUDI", year: "2014" } } } } },
    };
  });
  afterEach(async () => {
    await fs.rm(state.dir, { recursive: true, force: true });
  });

  it("ieraksta marku + gadu grupu, vienreiz uz pasūtījumu+avotu, bez VIN", async () => {
    expect(await recordDealerCoverageForSession({ sessionId: "cs_test_1", source: "oneauto", hasData: false, vin: VIN })).toBe(true);
    expect(await recordDealerCoverageForSession({ sessionId: "cs_test_1", source: "oneauto", hasData: false, vin: VIN })).toBe(false);
    expect(await recordDealerCoverageForSession({ sessionId: "cs_test_1", source: "checkthisreg", hasData: true, vin: VIN })).toBe(true);
    const agg = await readDealerCoverageAggregate();
    expect(agg.counts).toEqual({
      "Audi|all|oneauto": [0, 1],
      "Audi|2013-2016|oneauto": [0, 1],
      "Audi|all|checkthisreg": [1, 1],
      "Audi|2013-2016|checkthisreg": [1, 1],
    });
    const raw = await fs.readFile(path.join(state.dir, "dealer_coverage", "aggregate.json"), "utf8");
    expect(raw).not.toContain(VIN);
    expect(raw).not.toContain("cs_test_1");
  });

  it("bez CSDD markas - VIN WMI; MINI ieskaitās BMW grupā", async () => {
    state.draft = { workspace: { sourceBlocks: { csdd: { makeModel: "MINI COOPER", registry: { data: { year: "2018" } } } } } };
    await recordDealerCoverageForSession({ sessionId: "cs_test_2", source: "oneauto", hasData: true, vin: "WMWZZZ00000000000" });
    state.draft = null;
    await recordDealerCoverageForSession({ sessionId: "cs_test_3", source: "oneauto", hasData: true, vin: "YV1ZZZ000L0000000" });
    const agg = await readDealerCoverageAggregate();
    expect(agg.counts["BMW|2017-2019|oneauto"]).toEqual([1, 1]);
    expect(agg.counts["Volvo|all|oneauto"]).toEqual([1, 1]);
    expect(agg.counts["Volvo|2020+|oneauto"]).toEqual([1, 1]);
  });
});
