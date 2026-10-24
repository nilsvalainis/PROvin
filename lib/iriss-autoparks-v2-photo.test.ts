import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const FOLDER = "/STOCK/Test Car";
const IZSOLE = `${FOLDER}/bildes-izsole`;
const CANON = `${FOLDER}/bildes-canon`;
let entries: Array<{ tag: "file" | "folder"; id: string; name: string }> = [];
let izsoleEntries: Array<{ tag: "file" | "folder"; id: string; name: string }> = [];
let canonEntries: Array<{ tag: "file" | "folder"; id: string; name: string }> = [];
let hasIzsole = false;
let hasCanon = false;
let downloadOk = true;

vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => ({
    getMetadata: async (ref: string) => {
      if (ref === "folder1") return { tag: "folder", pathDisplay: FOLDER };
      if (ref === IZSOLE && hasIzsole) return { tag: "folder", pathDisplay: IZSOLE };
      if (ref === CANON && hasCanon) return { tag: "folder", pathDisplay: CANON };
      return null;
    },
    listAll: async (path: string) => {
      if (path === IZSOLE) return { entries: izsoleEntries, cursor: "c1" };
      if (path === CANON) return { entries: canonEntries, cursor: "c1" };
      return { entries, cursor: "c1" };
    },
    download: async (id: string) => {
      if (!downloadOk) throw new Error("dropbox_down");
      const sharp = (await import("sharp")).default;
      const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } }).jpeg().toBuffer();
      const all = [...entries, ...izsoleEntries, ...canonEntries];
      return { bytes, entry: all.find((e) => e.id === id) ?? null };
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

async function carWithFolder(v1: Awaited<ReturnType<typeof load>>["v1"]) {
  const car = await v1.createAutoparksCar({ make: "Škoda", model: "Kodiaq" }, actor);
  await v1.mutateAutoparksState((state) => {
    const idx = state.cars.findIndex((c) => c.id === car.id);
    state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: "folder1" };
    return { result: null };
  });
  return car.id;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-v2-photo-test-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
  entries = [
    { tag: "file", id: "id:a1", name: "01.jpg" },
    { tag: "file", id: "id:a2", name: "02.jpg" },
    { tag: "file", id: "id:a3", name: "info.txt" },
  ];
  izsoleEntries = [];
  canonEntries = [];
  hasIzsole = false;
  hasCanon = false;
  downloadOk = true;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("Autoparks v2 galvenā bilde (J29 A/B)", () => {
  it("kandidātu sarakstā tikai bildes, ne info.txt", async () => {
    const { v1, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await (await import("@/lib/iriss-autoparks-v2-store")).readAutoparksV2Car(carId))!;
    const cands = await photo.autoparksV2StockPhotoCandidates(found.car);
    expect(cands.map((c) => c.id)).toEqual(["id:a1", "id:a2"]);
  });

  it("ar roku izvēlēta bilde (B): nepieņem dropboxId, kas nav kandidātu sarakstā", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    const res = await photo.setAutoparksV2MainPhoto(found.car, "id:not-here", actor);
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  it("ar roku izvēlēta bilde (B): derīgs dropboxId - saglabā mainPhoto un vēsturi", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    const res = await photo.setAutoparksV2MainPhoto(found.car, "id:a2", actor);
    expect(res).toEqual({ ok: true });
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:a2");
    const hist = await v2.listAutoparksV2History(carId);
    expect(hist[0]).toMatchObject({ field: "mainPhoto", from: "", to: "id:a2" });
  });

  it("vienreizējs atiestatīšana (A): dublē veco sīktēlu Blob, tad notīra mainPhoto/photoCheckedAt", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.setAutoparksV2MainPhoto(found.car, "id:a1", actor);

    const res = await photo.resetAutoparksV2MainPhoto(carId, actor);
    expect(res?.hadPhoto).toBe(true);
    expect(res?.backedUpTo).toBeTruthy();

    const backup = await fs.readFile(path.join(dir, res!.backedUpTo));
    expect(backup.length).toBeGreaterThan(100);

    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto).toBeNull();
    expect(after.v2.photoCheckedAt).toBe("");
  });

  it("vienreizējs pārrēķins visiem (A): skar tikai auto, kam jau bija galvenā bilde", async () => {
    const { v1, v2, photo } = await load();
    const withPhotoId = await carWithFolder(v1);
    const withoutPhotoId = (await v1.createAutoparksCar({ make: "Audi", model: "A6" }, actor)).id;
    const found = (await v2.readAutoparksV2Car(withPhotoId))!;
    await photo.setAutoparksV2MainPhoto(found.car, "id:a1", actor);

    const summary = await photo.resetAllAutoparksV2MainPhotos(actor);
    expect(summary).toEqual({ totalCars: 2, hadPhoto: 1, backedUp: 1, failed: 0 });
    expect((await v2.readAutoparksV2Car(withoutPhotoId))!.v2.mainPhoto).toBeNull();
  });
});

describe("J36: jaunā /STOCK struktūra (bildes-izsole/bildes-canon)", () => {
  it("galvenā bilde: bildes-izsole/1.jpg prioritāri pār saknes bildēm", async () => {
    hasIzsole = true;
    izsoleEntries = [
      { tag: "file", id: "id:iz2", name: "2.jpg" },
      { tag: "file", id: "id:iz1", name: "1.jpg" },
    ];
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:iz1");
  });

  it("galvenā bilde: fallback uz bildes-canon/1.jpg, ja bildes-izsole mapes nav", async () => {
    hasCanon = true;
    canonEntries = [{ tag: "file", id: "id:cn1", name: "1.jpg" }];
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:cn1");
  });

  it("galvenā bilde: fallback uz veco loģiku (saknes bildes), ja neviena apakšmape neeksistē", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:a1");
  });

  it("kandidāti: bildes-izsole + bildes-canon apvienoti, saknes bildes (vecā loģika) tad netiek rādītas", async () => {
    hasIzsole = true;
    hasCanon = true;
    izsoleEntries = [
      { tag: "file", id: "id:iz1", name: "1.jpg" },
      { tag: "file", id: "id:iz2", name: "2.jpg" },
    ];
    canonEntries = [{ tag: "file", id: "id:cn1", name: "1.jpg" }];
    const { v1, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await (await import("@/lib/iriss-autoparks-v2-store")).readAutoparksV2Car(carId))!;
    const cands = await photo.autoparksV2StockPhotoCandidates(found.car);
    expect(cands.map((c) => c.id)).toEqual(["id:iz1", "id:iz2", "id:cn1"]);
  });
});
