import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * DE iepirkumi (20.11): auto piesaistīts tukšai jaunai mapei ("... – 518193"), bet bildes ir IRISS mapē
 * "Volvo XC90 DE Iepirkums" (bez VIN nosaukumā, VIN tikai car-data.json).
 */
const VIN = "YV1CR714691518193";
const EMPTY = "/STOCK/Volvo XC90 D5 Executive 2009 – 518193";
const DE = "/STOCK/Volvo XC90 DE Iepirkums";

type Entry = { tag: "file" | "folder"; id: string; name: string; pathDisplay: string; pathLower: string };
const e = (tag: Entry["tag"], id: string, p: string): Entry => ({ tag, id, name: p.split("/").pop()!, pathDisplay: p, pathLower: p.toLowerCase() });

let listings: Record<string, Entry[]> = {};
let carData: Record<string, string> = {};

vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => ({
    getMetadata: async (ref: string) => {
      if (ref === "folder-empty") return e("folder", "folder-empty", EMPTY);
      if (ref in listings) return e("folder", `id:${ref}`, ref);
      return null;
    },
    listAll: async (p: string) => ({ entries: listings[p] ?? [], cursor: "c1" }),
    download: async (ref: string) => {
      if (ref in carData) return { bytes: Buffer.from(carData[ref]!), entry: null };
      if (ref.endsWith("car-data.json")) throw new Error("path/not_found");
      const sharp = (await import("sharp")).default;
      return { bytes: await sharp({ create: { width: 40, height: 30, channels: 3, background: "#222" } }).jpeg().toBuffer(), entry: null };
    },
  }),
}));

const actor = { id: "u1", name: "Nils" };
let dir = "";

async function load() {
  vi.resetModules();
  return {
    v1: await import("@/lib/iriss-autoparks-store"),
    v2: await import("@/lib/iriss-autoparks-v2-store"),
    photo: await import("@/lib/iriss-autoparks-v2-photo"),
  };
}

async function carLinkedToEmpty(v1: Awaited<ReturnType<typeof load>>["v1"], vin = VIN) {
  const car = await v1.createAutoparksCar({ make: "Volvo", model: "XC90", vin }, actor);
  await v1.mutateAutoparksState((state) => {
    const idx = state.cars.findIndex((c) => c.id === car.id);
    state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: "folder-empty" };
    return { result: null };
  });
  return car.id;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-v2-photo-de-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
  listings = {
    "/STOCK": [e("folder", "id:empty", EMPTY), e("folder", "id:de", DE), e("folder", "id:x", "/STOCK/Volvo XC60 2013 sudrabs – 439274 – A1")],
    [EMPTY]: [],
    [DE]: [e("file", "id:root1", `${DE}/Photo 09-11-2026, 10 46 12.jpg`), e("folder", "id:bi", `${DE}/bildes-izsole`)],
    [`${DE}/bildes-izsole`]: [e("file", "id:de2", `${DE}/bildes-izsole/2.jpg`), e("file", "id:de1", `${DE}/bildes-izsole/1.jpg`)],
  };
  carData = { [`${DE}/car-data.json`]: JSON.stringify({ fields: { VIN: { value: VIN } } }) };
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("Autoparks v2 titulbilde DE iepirkumiem (car-data.json VIN)", () => {
  it("tukša piesaistītā mape: kandidāti no DE mapes bildes-izsole", async () => {
    const { v1, v2, photo } = await load();
    const found = (await v2.readAutoparksV2Car(await carLinkedToEmpty(v1)))!;
    const cands = await photo.autoparksV2StockPhotoCandidates(found.car);
    expect(cands.map((c) => c.id)).toEqual(["id:de2", "id:de1"]);
  });

  it("automātiskā izvēle ņem bildes-izsole/1.jpg un saglabā mainPhoto", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carLinkedToEmpty(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    const bytes = await photo.autoparksV2MainPhoto(found.car, found.v2, { force: true });
    expect(bytes).toBeTruthy();
    expect((await v2.readAutoparksV2Car(carId))!.v2.mainPhoto?.dropboxId).toBe("id:de1");
  });

  it("ar roku izvēlēta DE bilde ir atļauta (kandidātu sarakstā)", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carLinkedToEmpty(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    expect(await photo.setAutoparksV2MainPhoto(found.car, "id:de2", actor)).toEqual({ ok: true });
  });

  it("cits VIN car-data.json - DE mapes bildes neņem", async () => {
    const { v1, v2, photo } = await load();
    const found = (await v2.readAutoparksV2Car(await carLinkedToEmpty(v1, "YV1CZ7146B1568808")))!;
    expect(await photo.autoparksV2StockPhotoCandidates(found.car)).toEqual([]);
  });

  it("VIN tikai v2 Pamatdati laukā (vinOverride) arī der", async () => {
    const { v1, v2, photo } = await load();
    const found = (await v2.readAutoparksV2Car(await carLinkedToEmpty(v1, "")))!;
    expect(await photo.autoparksV2StockPhotoCandidates(found.car)).toEqual([]);
    const cands = await photo.autoparksV2StockPhotoCandidates(found.car, VIN);
    expect(cands.map((c) => c.id)).toContain("id:de1");
  });
});
