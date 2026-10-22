import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoparksListRows, autoparksOwner, filterAutoparksByOwner, normalizeAutoparksState } from "@/lib/iriss-autoparks";
import { parseAutoparksCarInput } from "@/lib/iriss-autoparks-input";

vi.mock("@/lib/dropbox-client", async (orig) => ({ ...(await orig<typeof import("@/lib/dropbox-client")>()), getDropboxClient: () => null }));

const actor = { id: "u1", name: "Tests" };
let dir = "";

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-owner-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

async function loadStore() {
  vi.resetModules();
  return import("@/lib/iriss-autoparks-store");
}

describe("Autoparks īpašnieks (owner)", () => {
  it("vecie ieraksti = IRISS, nederīga vērtība netiek pieņemta", () => {
    const s = normalizeAutoparksState({ cars: [{ id: "a" }, { id: "b", owner: "DZA" }, { id: "c", owner: "cits" }] });
    expect(s.cars.map(autoparksOwner)).toEqual(["IRISS", "DZA", "IRISS"]);
    expect(s.cars[0]!.owner).toBeUndefined();
    expect(autoparksListRows(s).map((r) => r.owner)).toEqual(["IRISS", "DZA", "IRISS"]);
    expect(filterAutoparksByOwner(autoparksListRows(s), "DZA").map((r) => r.id)).toEqual(["b"]);
    expect(filterAutoparksByOwner(autoparksListRows(s), "x")).toHaveLength(3);
  });

  it("API ievade pieņem tikai IRISS|DZA", () => {
    expect(parseAutoparksCarInput({ owner: "DZA" }, false).owner).toBe("DZA");
    expect(parseAutoparksCarInput({ owner: "dza" }, false)).not.toHaveProperty("owner");
  });

  it("jauns auto saglabā IRISS, maiņa ar notikumu; vecs ieraksts glabātajos datos netiek papildināts", async () => {
    await fs.writeFile(path.join(dir, "autoparks.json"), JSON.stringify({ version: 1, cars: [{ id: "ap-old", make: "Audi" }] }));
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "Volvo" }, actor);
    expect(car.owner).toBe("IRISS");
    const dza = await store.createAutoparksCar({ make: "BMW", owner: "DZA" }, actor);
    expect(dza.owner).toBe("DZA");
    await store.patchAutoparksCar(car.id, { owner: "DZA" }, actor);
    const room = await store.getAutoparksRoom(car.id);
    expect(room?.car.owner).toBe("DZA");
    expect(room?.events[0]?.text).toBe("Īpašnieks: SIA ĪRISS -> SIA DZINTARZEME AUTO");
    const raw = JSON.parse(await fs.readFile(path.join(dir, "autoparks.json"), "utf8"));
    expect(raw.cars.find((c: { id: string }) => c.id === "ap-old")).not.toHaveProperty("owner");
    expect((await store.getAutoparksRoom("ap-old"))?.car.owner).toBe("IRISS");
  });
});
