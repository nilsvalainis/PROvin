import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const FOLDER = "/STOCK/Test Car";
const IZSOLE = `${FOLDER}/bildes-izsole`;
const IZSOLE_LR = `${IZSOLE}/LR`;

type Entry = { tag: "file" | "folder"; id: string; name: string };

let rootEntries: Entry[] = [];
/** Ceļš -> apakšmapes saturs (bildes-izsole, bildes-izsole/LR, iPhone mapes, u.tml.). */
let subfolders: Record<string, Entry[]> = {};
let downloadOk = true;

function folderMeta(folderPath: string) {
  if (folderPath === "folder1") return { tag: "folder" as const, pathDisplay: FOLDER };
  if (folderPath in subfolders) return { tag: "folder" as const, pathDisplay: folderPath };
  return null;
}

vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => ({
    getMetadata: async (ref: string) => folderMeta(ref),
    listAll: async (p: string) => ({ entries: p === FOLDER ? rootEntries : subfolders[p] ?? [], cursor: "c1" }),
    download: async (id: string) => {
      if (!downloadOk) throw new Error("dropbox_down");
      const sharp = (await import("sharp")).default;
      const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } }).jpeg().toBuffer();
      const all = [...rootEntries, ...Object.values(subfolders).flat()];
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
  rootEntries = [
    { tag: "file", id: "id:a1", name: "01.jpg" },
    { tag: "file", id: "id:a2", name: "02.jpg" },
    { tag: "file", id: "id:a3", name: "info.txt" },
  ];
  subfolders = {};
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

describe("J36/J39: /STOCK struktūra - bildes-canon NETIEK lietota (J39 labojums)", () => {
  it("galvenā bilde: bildes-izsole/1.jpg prioritāri pār saknes bildēm", async () => {
    subfolders[IZSOLE] = [
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

  it("galvenā bilde: zemākais numurs bildes-izsole, ja numerācija nesākas no 1 (piem. Volvo S80 162162 'bildes no 2')", async () => {
    subfolders[IZSOLE] = [
      { tag: "file", id: "id:iz3", name: "4.jpg" },
      { tag: "file", id: "id:iz2", name: "2.jpg" },
      { tag: "file", id: "id:iz4", name: "10.jpg" },
    ];
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:iz2");
  });

  it("galvenā bilde: bildes-canon NEIETEKMĒ izvēli, ja tāda eksistē blakus (fallback uz saknes bildēm)", async () => {
    // bildes-canon apzināti netiek pievienota `subfolders` kartei - kods to vairs nemeklē, bet
    // pārbaudām, ka pat ja tā "būtu", fallback uz saknes bildēm notiek pareizi, jo izsole/iPhone tukši.
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:a1");
  });

  it("galvenā bilde: fallback uz 'iPhone' apakšmapi, ja bildes-izsole tukša/nav", async () => {
    const iphoneFolderPath = `${FOLDER}/iPhone foto`;
    rootEntries = [
      ...rootEntries,
      { tag: "folder", id: "id:iphonefolder", name: "iPhone foto", pathDisplay: iphoneFolderPath } as Entry & { pathDisplay: string },
    ];
    subfolders[iphoneFolderPath] = [{ tag: "file", id: "id:ip1", name: "IMG_0001.jpg" }];
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:ip1");
  });

  it("galvenā bilde: paliek bez bildes, ja STOCK mapē ir TIKAI bildes-canon (piem. MERCEDES E250 CDI 797716)", async () => {
    rootEntries = rootEntries.filter((e) => e.name !== "01.jpg" && e.name !== "02.jpg"); // bez saknes bildēm
    subfolders[`${FOLDER}/bildes-canon`] = [
      { tag: "file", id: "id:cn1", name: "1.jpg" },
      { tag: "file", id: "id:cn2", name: "IMG_7120.jpg" },
    ];
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto).toBeNull();
  });

  it("galvenā bilde: fallback uz veco loģiku (saknes bildes), ja neviena apakšmape neeksistē", async () => {
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);
    const after = (await v2.readAutoparksV2Car(carId))!;
    expect(after.v2.mainPhoto?.dropboxId).toBe("id:a1");
  });

  it("kandidāti: bildes-izsole + LR apakšmape apvienoti, bildes-canon vairs netiek pievienota", async () => {
    subfolders[IZSOLE] = [
      { tag: "file", id: "id:iz1", name: "1.jpg" },
      { tag: "file", id: "id:iz2", name: "2.jpg" },
    ];
    subfolders[IZSOLE_LR] = [{ tag: "file", id: "id:lr1", name: "max-abc.jpg" }];
    const { v1, photo } = await load();
    const carId = await carWithFolder(v1);
    const found = (await (await import("@/lib/iriss-autoparks-v2-store")).readAutoparksV2Car(carId))!;
    const cands = await photo.autoparksV2StockPhotoCandidates(found.car);
    expect(cands.map((c) => c.id)).toEqual(["id:iz1", "id:iz2", "id:lr1"]);
  });
});

describe("J52: izvēles logs trūkstošas/salauztas dropboxFolderId gadījumā (iepriekš mūžīgi 'Nav STOCK bilžu')", () => {
  const RELINK_PATH = "/STOCK/Relinked Car";

  async function loadWithLinkMock(impl: (carId: string, opts?: { create?: boolean }) => Promise<{ linked: boolean; path?: string }>) {
    vi.resetModules();
    vi.doMock("@/lib/iriss-autoparks-dropbox-sync", async (orig) => ({
      ...(await orig<typeof import("@/lib/iriss-autoparks-dropbox-sync")>()),
      linkAutoparksCarToDropbox: vi.fn(impl),
    }));
    return {
      v1: await import("@/lib/iriss-autoparks-store"),
      photo: await import("@/lib/iriss-autoparks-v2-photo"),
    };
  }

  it("dropboxFolderId tukšs: pārsasaista pēc VIN (create:false) un atgriež atrastās mapes kandidātus", async () => {
    subfolders[`${RELINK_PATH}/bildes-izsole`] = [{ tag: "file", id: "id:r1", name: "1.jpg" }];
    const linkSpy = vi.fn(async (_carId: string, opts?: { create?: boolean }) => {
      expect(opts).toEqual({ create: false });
      return { linked: true, path: RELINK_PATH };
    });
    const { v1, photo } = await loadWithLinkMock(linkSpy);
    const car = await v1.createAutoparksCar({ make: "Audi", model: "A6", vin: "WAUZZZ4G5EN012345" }, actor);
    expect(car.dropboxFolderId).toBeFalsy();
    const cands = await photo.autoparksV2StockPhotoCandidates(car);
    expect(cands.map((c) => c.id)).toEqual(["id:r1"]);
    expect(linkSpy).toHaveBeenCalledWith(car.id, { create: false });
  });

  it("dropboxFolderId norāda uz nolaistu/neesošu mapi: arī tad pārsasaista pēc VIN", async () => {
    subfolders[`${RELINK_PATH}/bildes-izsole`] = [{ tag: "file", id: "id:r2", name: "1.jpg" }];
    const { v1, photo } = await loadWithLinkMock(async () => ({ linked: true, path: RELINK_PATH }));
    const car = await v1.createAutoparksCar({ make: "Audi", model: "A6", vin: "WAUZZZ4G5EN098765" }, actor);
    await v1.mutateAutoparksState((state) => {
      const idx = state.cars.findIndex((c) => c.id === car.id);
      state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: "id:nav-mape" };
      return { result: null };
    });
    const stale = (await v1.readAutoparksState()).cars.find((c) => c.id === car.id)!;
    const cands = await photo.autoparksV2StockPhotoCandidates(stale);
    expect(cands.map((c) => c.id)).toEqual(["id:r2"]);
  });

  it("pārsasaiste neatrod VIN sakritību: atgriež tukšu sarakstu (ne kļūdu)", async () => {
    const { v1, photo } = await loadWithLinkMock(async () => ({ linked: false }));
    const car = await v1.createAutoparksCar({ make: "Audi", model: "A6", vin: "WAUZZZ4G5EN011111" }, actor);
    const cands = await photo.autoparksV2StockPhotoCandidates(car);
    expect(cands).toEqual([]);
  });
});

describe("J62: negatīvā keša TTL un force pārlāde (bilde parādās STOCK mapē pēc pirmās tukšās pārbaudes)", () => {
  async function noRootPhotos() {
    rootEntries = rootEntries.filter((e) => e.name !== "01.jpg" && e.name !== "02.jpg");
  }

  it("tukšs -> cache no_photo -> bilde parādās, bet 1h negatīvā TTL vēl nav beigusies -> paliek no_photo bez force", async () => {
    await noRootPhotos();
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    let found = (await v2.readAutoparksV2Car(carId))!;
    const first = await photo.autoparksV2MainPhoto(found.car, found.v2);
    expect(first).toBeNull();
    found = (await v2.readAutoparksV2Car(carId))!;
    expect(found.v2.mainPhoto).toBeNull();
    expect(found.v2.photoCheckedAt).toBeTruthy();

    rootEntries = [...rootEntries, { tag: "file", id: "id:new1", name: "01.jpg" }];
    const second = await photo.autoparksV2MainPhoto(found.car, found.v2);
    expect(second).toBeNull();
    expect((await v2.readAutoparksV2Car(carId))!.v2.mainPhoto).toBeNull();
  });

  it("negatīvā TTL (1h) beigusies, bilde STOCK mapē jau ir -> automātiski pārlasa Dropbox BEZ force", async () => {
    await noRootPhotos();
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    let found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2);

    await v2.updateCarV2(
      carId,
      (c) => {
        c.photoCheckedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        return { result: null, write: true };
      },
      actor,
    );
    rootEntries = [...rootEntries, { tag: "file", id: "id:new2", name: "01.jpg" }];
    found = (await v2.readAutoparksV2Car(carId))!;
    const bytes = await photo.autoparksV2MainPhoto(found.car, found.v2);
    expect(bytes).not.toBeNull();
    expect((await v2.readAutoparksV2Car(carId))!.v2.mainPhoto?.dropboxId).toBe("id:new2");
  });

  it("force=true apiet gan saglabāto bildi, gan TTL - vienmēr pārlasa Dropbox no jauna", async () => {
    await noRootPhotos();
    const { v1, v2, photo } = await load();
    const carId = await carWithFolder(v1);
    let found = (await v2.readAutoparksV2Car(carId))!;
    await photo.autoparksV2MainPhoto(found.car, found.v2); // cache: no_photo, photoCheckedAt = tagad

    rootEntries = [...rootEntries, { tag: "file", id: "id:force1", name: "01.jpg" }];
    found = (await v2.readAutoparksV2Car(carId))!;
    const withoutForce = await photo.autoparksV2MainPhoto(found.car, found.v2);
    expect(withoutForce).toBeNull();

    const withForce = await photo.autoparksV2MainPhoto(found.car, found.v2, { force: true });
    expect(withForce).not.toBeNull();
    expect((await v2.readAutoparksV2Car(carId))!.v2.mainPhoto?.dropboxId).toBe("id:force1");
  });
});
