import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

import { readIrissCriteria } from "@/lib/iriss-criteria-migrate";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const legacy = {
  id: ORDER_ID,
  createdAt: "2024-03-01T10:00:00.000Z",
  updatedAt: "2024-11-02T15:30:00.000Z",
  workspaceRevision: 3,
  clientFirstName: "Jānis",
  clientLastName: "Bērziņš",
  phone: "+37120000000",
  email: "janis@example.com",
  brandModel: "Volvo XC60",
  productionYears: "2018-2021",
  totalBudget: "18000",
  engineType: "dīzelis",
  transmission: "automāts",
  bodyType: "SUV",
  driveType: "AWD",
  seatCount: "5",
  maxMileage: "150000",
  preferredColors: "melna",
  nonPreferredColors: "dzeltena",
  interiorFinish: "āda",
  notes: "Klients grib pilnu servisa vēsturi",
  equipmentRequired: "navigācija",
  equipmentDesired: "webasta",
  legacyMarker: "do-not-drop",
};

describe("legacy IRISS order file", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    rmSync(path.join(process.cwd(), ".data", "iriss-pasutijumi-backups"), { recursive: true, force: true });
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load(dir: string) {
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR", "disabled");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_FULL_BUNDLE", "0");
    vi.resetModules();
    return import("@/lib/iriss-pasutijumi-store");
  }

  it("round-trips byte-identical when the user does not edit", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-legacy-"));
    dirs.push(dir);
    const file = path.join(dir, `${ORDER_ID}.json`);
    const bytes = `${JSON.stringify(legacy, null, 2)}\n`;
    writeFileSync(file, bytes, "utf8");

    const orders = await load(dir);
    const loaded = await orders.readIrissPasutijums(ORDER_ID);
    expect(loaded).not.toBeNull();
    expect(loaded?.criteria).toBeUndefined();
    expect(loaded?.brandModel).toBe("Volvo XC60");
    expect(loaded?.engineType).toBe("dīzelis");
    expect(loaded?.preferredColors).toBe("melna");
    expect(loaded?.notes).toBe(legacy.notes);
    expect(loaded?.clientFirstName).toBe("Jānis");
    const derived = readIrissCriteria(loaded ?? {});
    expect(derived.filters[0]?.fuel.value).toEqual([{ group: "diesel" }]);
    expect(readFileSync(file, "utf8")).toBe(bytes);

    const untouched = await orders.writeIrissPasutijums(
      { ...loaded!, criteria: derived },
      { expectedWorkspaceRevision: loaded!.workspaceRevision },
    );
    expect(untouched.ok).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(bytes);
  });

  it("saves an edited note without adding criteria or dropping the other filled fields", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-legacy-edit-"));
    dirs.push(dir);
    const file = path.join(dir, `${ORDER_ID}.json`);
    writeFileSync(file, JSON.stringify(legacy), "utf8");

    const orders = await load(dir);
    const loaded = await orders.readIrissPasutijums(ORDER_ID);
    expect(loaded).not.toBeNull();
    const edited = {
      ...loaded!,
      notes: "Zvani pēc 18",
      criteria: readIrissCriteria(loaded ?? {}),
    };
    const saved = await orders.writeIrissPasutijums(edited, {
      expectedWorkspaceRevision: loaded!.workspaceRevision,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    expect(raw.criteria).toBeUndefined();
    expect(raw.notes).toBe("Zvani pēc 18");
    expect(raw.brandModel).toBe("Volvo XC60");
    expect(raw.engineType).toBe("dīzelis");
    expect(raw.transmission).toBe("automāts");
    expect(raw.bodyType).toBe("SUV");
    expect(raw.preferredColors).toBe("melna");
    expect(raw.nonPreferredColors).toBe("dzeltena");
    expect(raw.clientFirstName).toBe("Jānis");
    expect(raw.clientLastName).toBe("Bērziņš");
    expect(raw.equipmentRequired).toBe("navigācija");
    expect(raw.equipmentDesired).toBe("webasta");
    expect(raw.totalBudget).toBe("18000");
    expect(saved.record.criteria).toBeUndefined();
  });

  it("keeps a soft-deleted legacy file byte-identical when it is opened again", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-legacy-del-"));
    dirs.push(dir);
    const file = path.join(dir, `${ORDER_ID}.json`);
    writeFileSync(file, JSON.stringify(legacy), "utf8");

    const orders = await load(dir);
    const removed = await orders.deleteIrissPasutijums(ORDER_ID);
    expect(removed.ok).toBe(true);
    const trashed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
    expect(typeof trashed.deletedAt).toBe("string");
    expect(String(trashed.deletedAt).length).toBeGreaterThan(0);
    expect(trashed.criteria).toBeUndefined();
    expect(trashed.brandModel).toBe("Volvo XC60");
    expect(trashed.notes).toBe(legacy.notes);
    expect(trashed.preferredColors).toBe("melna");

    const bytes = readFileSync(file, "utf8");
    const loaded = await orders.readIrissPasutijums(ORDER_ID);
    expect(loaded?.deletedAt).toBe(trashed.deletedAt);
    const untouched = await orders.writeIrissPasutijums(
      { ...loaded!, criteria: readIrissCriteria(loaded ?? {}) },
      { expectedWorkspaceRevision: loaded!.workspaceRevision },
    );
    expect(untouched.ok).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(bytes);
  });
});
