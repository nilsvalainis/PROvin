import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { del } from "@vercel/blob";
import {
  addDealerCheckCost,
  commitDealerCheckLoad,
  convertDealerCheckToOrder,
  deleteDealerCheck,
  listDealerCheckEntries,
  normalizeDealerCheckRecord,
  readDealerCheck,
  readDealerCheckByVin,
  readOwnedDealerCheck,
  writeDealerCheck,
} from "@/lib/dealer-check-store";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import { DEALER_CHECK_LIST_DEFAULT_FILTER, DEALER_CHECK_OWNER_ID, filterDealerCheckList } from "@/lib/dealer-check-history";

const VIN = "WVWZZZ3CZKE012345";

function sample(id = "dc-store-test-01", patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
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
    ...patch,
  };
}

describe("dealer-check-store", () => {
  let dir = "";

  afterEach(async () => {
    delete process.env.DEALER_CHECK_DIR;
    delete process.env.DEALER_CHECK_BLOB_PREFIX;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.mocked(del).mockClear();
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

  it("veiksmīga ielāde paliek, otrs VIN ir jauns ieraksts, svešs radītājs nav sarakstā", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dealer-check-"));
    process.env.DEALER_CHECK_DIR = dir;
    const first = await commitDealerCheckLoad(sample("dc-commit-ok-001"), DEALER_CHECK_OWNER_ID);
    expect(first.stored).toBe(true);
    expect(first.durable).toBe(true);
    const second = await commitDealerCheckLoad(
      sample("dc-commit-ok-002"),
      DEALER_CHECK_OWNER_ID,
    );
    expect(second.stored).toBe(true);
    expect((await readDealerCheckByVin(VIN))?.id).toBe("dc-commit-ok-002");
    expect((await readDealerCheck("dc-commit-ok-001"))?.vin).toBe(VIN);
    await commitDealerCheckLoad({ ...sample("dc-commit-other-1"), createdBy: "google:cits" }, "google:cits");
    const mine = await listDealerCheckEntries(DEALER_CHECK_OWNER_ID);
    expect(mine.map((row) => row.id).sort()).toEqual(["dc-commit-ok-001", "dc-commit-ok-002"]);
    expect(await listDealerCheckEntries("google:cits")).toHaveLength(1);
    expect(await readOwnedDealerCheck("dc-commit-ok-001", "google:cits")).toBeNull();
  });

  it("206 un tukša ielāde netiek ierakstīta", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dealer-check-"));
    process.env.DEALER_CHECK_DIR = dir;
    const http206 = await commitDealerCheckLoad(
      sample("dc-commit-206-01", {
        selectedProducts: ["oe_service_history"],
        results: { oe_service_history: { ok: false, error: "http_206", httpStatus: 206, payload: null } },
        chargedCents: 0,
      }),
      DEALER_CHECK_OWNER_ID,
    );
    expect(http206).toMatchObject({ stored: false, durable: false });
    expect(await readDealerCheck("dc-commit-206-01")).toBeNull();
    const failed = await commitDealerCheckLoad(
      sample("dc-commit-fail-1", {
        selectedProducts: ["vin_decoder"],
        results: { vin_decoder: { ok: false, error: "upstream_error", payload: null } },
      }),
      DEALER_CHECK_OWNER_ID,
    );
    expect(failed.stored).toBe(false);
    expect(await listDealerCheckEntries(DEALER_CHECK_OWNER_ID)).toEqual([]);
  });

  it("pasūtījums izņem pārbaudi no noklusējuma saraksta, dzēšana izņem failu un blob", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dealer-check-"));
    process.env.DEALER_CHECK_DIR = dir;
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    process.env.DEALER_CHECK_BLOB_PREFIX = "dealer-checks/";
    const saved = await commitDealerCheckLoad(sample("dc-convert-del-1"), DEALER_CHECK_OWNER_ID);
    expect(saved.stored).toBe(true);
    expect(await convertDealerCheckToOrder("dc-convert-del-1", "ord_manual_1", "google:cits")).toBe(false);
    expect(await convertDealerCheckToOrder("dc-convert-del-1", "ord_manual_1", DEALER_CHECK_OWNER_ID)).toBe(true);
    const open = filterDealerCheckList(await listDealerCheckEntries(DEALER_CHECK_OWNER_ID), DEALER_CHECK_LIST_DEFAULT_FILTER);
    expect(open).toEqual([]);
    const converted = filterDealerCheckList(await listDealerCheckEntries(DEALER_CHECK_OWNER_ID), {
      ...DEALER_CHECK_LIST_DEFAULT_FILTER,
      status: "converted",
      ordered: "yes",
    });
    expect(converted[0]).toMatchObject({ id: "dc-convert-del-1", orderId: "ord_manual_1" });
    expect((await readDealerCheck("dc-convert-del-1"))?.csddSnapshot).toBeUndefined();
    expect(await deleteDealerCheck("dc-convert-del-1")).toMatchObject({ id: "dc-convert-del-1" });
    expect(await readDealerCheck("dc-convert-del-1")).toBeNull();
    await expect(readFile(path.join(dir, "dc-convert-del-1.json"), "utf8")).rejects.toThrow();
    expect(vi.mocked(del)).toHaveBeenCalled();
    expect(await listDealerCheckEntries(DEALER_CHECK_OWNER_ID)).toEqual([]);
  });

  it("vecais VIN indekss bez entries joprojām ielādē ierakstu īpašniekam", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "dealer-check-"));
    process.env.DEALER_CHECK_DIR = dir;
    const rec = sample("dc-legacy-index1");
    expect(await writeDealerCheck(rec)).toBe(true);
    await writeFile(
      path.join(dir, "_index.json"),
      JSON.stringify({ byVin: { [VIN]: rec.id }, ids: [rec.id] }),
      "utf8",
    );
    const rows = await listDealerCheckEntries(DEALER_CHECK_OWNER_ID);
    expect(rows.map((row) => row.id)).toEqual([rec.id]);
  });
});
