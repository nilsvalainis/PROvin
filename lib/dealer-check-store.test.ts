import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import {
  addDealerCheckCost,
  deleteDealerCheck,
  normalizeDealerCheckRecord,
  readDealerCheck,
  readDealerCheckByVin,
  writeDealerCheck,
} from "@/lib/dealer-check-store";
import type { DealerCheckRecord } from "@/lib/dealer-check";

const VIN = "WVWZZZ3CZKE012345";

function sample(id = "dc-store-test-01"): DealerCheckRecord {
  return {
    id,
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["vin_decoder"],
    results: { vin_decoder: { ok: true, payload: { success: true } } },
    display: { equipment: [], serviceTimeline: [], powertrain: [] },
    displayOriginal: { equipment: [], serviceTimeline: [], powertrain: [] },
    vehicle: {
      make: "VW",
      model: "Passat",
      body: "",
      engine: "",
      firstReg: "",
      color: "",
      gearbox: "",
      manufacturer: "",
      vin: VIN,
    },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "Serviss kārtībā.", oilIntervals: "30 000 km." },
    csdd: null,
    chargedCents: 18,
    quotedCents: 18,
    fetchedAt: "2026-11-01T16:41:00.000Z",
    monthKey: "2026-11",
    autoparks: { carId: "ap-1", title: "VW Passat", stockPath: "/STOCK/Passat", dropboxFolderId: "id:1" },
    saved: true,
    createdAt: "2026-11-01T16:41:00.000Z",
    updatedAt: "2026-11-01T16:41:00.000Z",
  };
}

describe("dealer-check-store", () => {
  let dir = "";

  afterEach(async () => {
    delete process.env.DEALER_CHECK_DIR;
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = "";
  });

  it("normalize noraida nedrošu id", () => {
    expect(normalizeDealerCheckRecord({ ...sample(), id: "../etc/passwd" })).toBeNull();
    expect(normalizeDealerCheckRecord(sample())?.vin).toBe(VIN);
    expect(normalizeDealerCheckRecord(sample())?.autoparks?.stockPath).toBe("/STOCK/Passat");
  });

  it("create → VIN indekss → delete (ledger paliek)", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dealer-check-"));
    process.env.DEALER_CHECK_DIR = dir;
    const rec = sample();
    expect(await writeDealerCheck(rec)).toBe(true);
    expect((await readDealerCheck(rec.id))?.vin).toBe(VIN);
    expect((await readDealerCheckByVin(VIN))?.id).toBe(rec.id);
    const month = await addDealerCheckCost("dzintarzeme", 18);
    expect(month.dzintarzeme).toEqual({ cents: 18, loads: 1 });
    expect(await deleteDealerCheck(rec.id)).toMatchObject({ id: rec.id });
    expect(await readDealerCheck(rec.id)).toBeNull();
    expect(await readDealerCheckByVin(VIN)).toBeNull();
    const after = await addDealerCheckCost("cits", 0);
    expect(after.dzintarzeme.cents).toBe(18);
  });
});
