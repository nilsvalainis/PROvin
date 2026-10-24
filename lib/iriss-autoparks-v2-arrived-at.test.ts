/**
 * J52: "Atvests" (`arrivedAt`) jaunam ierakstam vairs nav automātiski šodienas datums - paliek
 * tukšs, kamēr auto tiešām nav atvests, un to var notīrīt atpakaļ uz tukšu vērtību.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dropbox-client", async (orig) => ({ ...(await orig<typeof import("@/lib/dropbox-client")>()), getDropboxClient: () => null }));

const actor = { id: "u1", name: "Tests" };
let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-arrived-at-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

async function load() {
  vi.resetModules();
  return {
    v1: await import("@/lib/iriss-autoparks-store"),
    v2: await import("@/lib/iriss-autoparks-v2-store"),
    basics: await import("@/lib/iriss-autoparks-v2"),
  };
}

describe("Jauna ieraksta 'Atvests' lauks", () => {
  it("+ Auto: jauns ieraksts bez arrivedAt - v1 lauks paliek tukšs, ne šodienas datums", async () => {
    const { v1 } = await load();
    const car = await v1.createAutoparksCar({ make: "Volvo", model: "XC60", vin: "YV1DZ8756C2308229" }, actor);
    expect(car.arrivedAt).toBe("");
  });

  it("no Loģistikas (ensureAutoparksCarFromOrder): arī tad arrivedAt paliek tukšs", async () => {
    const { v1 } = await load();
    const order = { id: "order1", title: "Volvo XC60 2012", vin: "YV1DZ8756C2308229", make: "Volvo", model: "XC60", mileageKm: 150000 } as Parameters<
      typeof v1.ensureAutoparksCarFromOrder
    >[0];
    const { car, created } = await v1.ensureAutoparksCarFromOrder(order, actor);
    expect(created).toBe(true);
    expect(car.arrivedAt).toBe("");
  });

  it("Pamatdati 'basics' skatā tukšs v1+v2 arrivedAt nerāda šodienas datumu", async () => {
    const { v1, v2, basics } = await load();
    const car = await v1.createAutoparksCar({ make: "Volvo", model: "XC60", vin: "YV1DZ8756C2308229" }, actor);
    const found = (await v2.readAutoparksV2Car(car.id))!;
    expect(basics.autoparksV2Basics(found.car, found.v2).arrivedAt).toBe("");
  });

  it("ir notīrāms: ieliek datumu, tad notīra atpakaļ uz tukšu - saglabājas tukšs", async () => {
    const { v1, v2, basics } = await load();
    const car = await v1.createAutoparksCar({ make: "Volvo", model: "XC60", vin: "YV1DZ8756C2308229" }, actor);
    await v2.updateCarV2(
      car.id,
      (c) => {
        c.fields.arrivedAt = "2026-10-20";
        return { result: null, write: true };
      },
      { id: actor.id, name: actor.name },
    );
    const withDate = (await v2.readAutoparksV2Car(car.id))!;
    expect(basics.autoparksV2Basics(withDate.car, withDate.v2).arrivedAt).toBe("2026-10-20");

    await v2.updateCarV2(
      car.id,
      (c) => {
        c.fields.arrivedAt = "";
        return { result: null, write: true };
      },
      { id: actor.id, name: actor.name },
    );
    const cleared = (await v2.readAutoparksV2Car(car.id))!;
    expect(basics.autoparksV2Basics(cleared.car, cleared.v2).arrivedAt).toBe("");
  });

  it("vecu ierakstu dati netiek aiztikti (patchAutoparksCar ar roku uzstādīts arrivedAt paliek)", async () => {
    const { v1 } = await load();
    const car = await v1.createAutoparksCar({ make: "Audi", model: "A6" }, actor);
    const patched = await v1.patchAutoparksCar(car.id, { arrivedAt: "2020-01-01" }, actor);
    expect(patched?.arrivedAt).toBe("2020-01-01");
  });
});
