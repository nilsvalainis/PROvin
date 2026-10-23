import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => null,
}));
vi.mock("@/lib/csdd-tech-data", () => ({
  fetchCsddTechData: vi.fn(async () => ({
    found: true,
    message: "",
    data: { firstRegistrationIso: "2019-03-14", displacementCm3: "1968", powerKw: "110", electricPowerKw: "" },
  })),
}));

const actor = { id: "u1", name: "Nils" };
let dir = "";

async function load() {
  vi.resetModules();
  return {
    v1: await import("@/lib/iriss-autoparks-store"),
    v2: await import("@/lib/iriss-autoparks-v2-store"),
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-v2-test-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

function withoutStatus(raw: string) {
  const s = JSON.parse(raw) as { cars: Array<Record<string, unknown>>; events: unknown[] };
  return { ...s, events: [], cars: s.cars.map(({ status: _s, statusChangedAt: _a, updatedAt: _u, ...rest }) => rest) };
}

describe("autoparks-v2.json krātuve", () => {
  it("v2 lauki iet tikai v2 failā; autoparks.json mainās tikai statuss", async () => {
    const { v1, v2 } = await load();
    const car = await v1.createAutoparksCar({ make: "VW", model: "Passat", vin: "WVWZZZ3CZKE012345", plate: "" , location: "Tukums" }, actor);
    const before = await fs.readFile(path.join(dir, "autoparks.json"), "utf8");

    await v2.updateCarV2(car.id, (c) => {
      c.fields.plate = "AB1234";
      c.tech.tyreSize = "225/45 R17";
      return { result: null, history: [{ field: "plate", from: "", to: "AB1234" }] };
    }, actor);
    expect(await fs.readFile(path.join(dir, "autoparks.json"), "utf8")).toBe(before);

    const changed = await v2.changeAutoparksStatusV2(car.id, "for_sale", actor);
    expect(changed.ok).toBe(true);
    const after = await fs.readFile(path.join(dir, "autoparks.json"), "utf8");
    expect(withoutStatus(after)).toEqual(withoutStatus(before));
    expect(JSON.parse(after).cars[0].status).toBe("for_sale");

    const found = await v2.readAutoparksV2Car(car.id);
    expect(found?.v2.fields.plate).toBe("AB1234");
    expect(found?.car.plate).toBe("");
  });

  it("atsaukšana atgriež statusu; otrreiz vai pēc citas maiņas - kļūda, nekas netiek pārrakstīts", async () => {
    const { v1, v2 } = await load();
    const car = await v1.createAutoparksCar({ make: "Audi", model: "A6", status: "in_service" }, actor);
    const res = await v2.changeAutoparksStatusV2(car.id, "for_sale", actor);
    if (!res.ok) throw new Error("status");
    expect(await v2.undoAutoparksStatusV2(car.id, res.historyId, { id: "u2", name: "Cits" })).toEqual({ ok: false, reason: "not_owner" });
    expect(await v2.undoAutoparksStatusV2(car.id, res.historyId, actor)).toEqual({ ok: true, status: "in_service" });
    expect((await v1.readAutoparksState()).cars[0]!.status).toBe("in_service");
    expect((await v2.undoAutoparksStatusV2(car.id, res.historyId, actor)).ok).toBe(false);

    const second = await v2.changeAutoparksStatusV2(car.id, "reserved", actor);
    if (!second.ok) throw new Error("status");
    await v1.patchAutoparksCar(car.id, { status: "sold" }, { id: "u3", name: "Kolēģis" });
    expect(await v2.undoAutoparksStatusV2(car.id, second.historyId, actor)).toEqual({ ok: false, reason: "changed" });
    expect((await v1.readAutoparksState()).cars[0]!.status).toBe("sold");

    const hist = await v2.listAutoparksV2History(car.id);
    expect(hist.map((h) => [h.field, h.from, h.to, Boolean(h.undoOf)])).toEqual([
      ["status", "in_service", "reserved", false],
      ["status", "for_sale", "in_service", true],
      ["status", "in_service", "for_sale", false],
    ]);
  });

  it("CSDD tehniskie dati aizpilda tikai tukšos laukus ar avotu csdd", async () => {
    const { v1, v2 } = await load();
    const car = await v1.createAutoparksCar({ make: "VW", model: "Passat", vin: "WVWZZZ3CZKE012345" }, actor);
    await v2.updateCarV2(car.id, (c) => {
      c.tech.powerKw = 120;
      c.sources["tech.powerKw"] = "manual";
      return { result: null, write: true };
    }, actor);
    const found = (await v2.readAutoparksV2Car(car.id))!;
    const out = await v2.refreshAutoparksV2Tech(found.car, found.v2, actor);
    expect(out.tech).toMatchObject({ firstRegDate: "2019-03-14", displacementCm3: 1968, powerKw: 120 });
    expect(out.sources).toMatchObject({ "tech.firstRegDate": "csdd", "tech.displacementCm3": "csdd", "tech.powerKw": "manual" });
  });
});
