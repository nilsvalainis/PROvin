import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropboxEntry } from "@/lib/dropbox-client";

const SEP = " – ";
const FOLDER = `/STOCK/Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`;

/** Atmiņas Dropbox ar izmaiņu žurnālu kursoram. */
function memoryDropbox() {
  const items = new Map<string, DropboxEntry & { bytes?: Buffer }>();
  const log: DropboxEntry[] = [];
  let seq = 0;
  const add = (tag: "file" | "folder", p: string, body?: string) => {
    const bytes = body == null ? undefined : Buffer.from(body);
    const e = { tag, id: `id:${++seq}`, name: p.split("/").pop()!, pathLower: p.toLowerCase(), pathDisplay: p, rev: "", size: bytes?.length ?? 0, contentHash: "", serverModified: "2026-10-22T10:00:00Z", bytes };
    items.set(p.toLowerCase(), e);
    log.push(e);
    return e;
  };
  const remove = (p: string) => {
    const e = items.get(p.toLowerCase())!;
    items.delete(p.toLowerCase());
    log.push({ ...e, tag: "deleted", id: "" });
  };
  const byRef = (ref: string) => [...items.values()].find((e) => e.id === ref) ?? items.get(ref.toLowerCase()) ?? null;
  const under = (root: string, recursive: boolean) =>
    [...items.values()].filter((e) => e.pathLower.startsWith(`${root.toLowerCase()}/`) && (recursive || !e.pathLower.slice(root.length + 1).includes("/")));
  const client = {
    getMetadata: vi.fn(async (ref: string) => byRef(ref)),
    listAll: vi.fn(async (root: string, o: { recursive?: boolean } = {}) => ({ entries: under(root, o.recursive === true), cursor: `c${log.length}` })),
    listFolderContinue: vi.fn(async (cursor: string) => {
      const from = Number(cursor.slice(1));
      return { entries: log.slice(from), cursor: `c${log.length}`, hasMore: false };
    }),
    ensureFolder: vi.fn(async (p: string) => byRef(p) ?? add("folder", p)),
    upload: vi.fn(async (p: string, b: Uint8Array) => add("file", p, Buffer.from(b).toString())),
    download: vi.fn(async (ref: string) => ({ bytes: byRef(ref)!.bytes!, entry: byRef(ref) })),
    temporaryLink: vi.fn(async () => "https://dl.example/x"),
  };
  return { client, add, remove };
}

const holder: { client: unknown } = { client: null };
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => holder.client,
}));

const actor = { id: "u1", name: "Tests" };
let dir = "";

async function load() {
  vi.resetModules();
  return { store: await import("@/lib/iriss-autoparks-store"), sync: await import("@/lib/iriss-autoparks-dropbox-sync") };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-sync-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("Autoparks <-> /STOCK sinhronizācija", () => {
  it("sasaista pēc VIN, pievieno dokumentus (ne bildes), aizpilda tikai tukšos laukus", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    db.add("file", `${FOLDER}/01.jpg`, "img");
    db.add("file", `${FOLDER}/proforma_DEPR02396489.pdf`, "pdf");
    db.add("file", `${FOLDER}/info.txt`, "VIN: YV1DZ8256D2439274\nBuild year: 2013\nOdometer: 355,756 km\nColour: Silver");
    holder.client = db.client;
    const { store, sync } = await load();
    const car = await store.createAutoparksCar({ make: "Volvo", vin: "YV1DZ8256D2439274", color: "Sudraba" }, actor);
    const r = await sync.runAutoparksDropboxSync();
    expect(r).toMatchObject({ ok: true, linked: 1, filesAdded: 1 });
    const room = await store.getAutoparksRoom(car.id);
    expect(room?.car).toMatchObject({ make: "Volvo", model: "XC60", year: "2013", color: "Sudraba", mileageKm: 355756, dropboxFolderPath: FOLDER });
    expect(room?.files.map((f) => [f.fileName, f.stage, f.kind])).toEqual([["proforma_DEPR02396489.pdf", "purchase", "invoice"]]);

    // Otrā reize ar kursoru: tikai jaunais fails, bez dublikātiem.
    db.add("file", `${FOLDER}/CMR 123.pdf`, "cmr");
    const r2 = await sync.runAutoparksDropboxSync();
    expect(r2.roots[0]).toMatchObject({ full: false });
    expect(r2.filesAdded).toBe(1);
    expect((await store.getAutoparksRoom(car.id))?.files).toHaveLength(2);

    // Dzēsts Dropbox -> mīkstā dzēšana.
    db.remove(`${FOLDER}/CMR 123.pdf`);
    const r3 = await sync.runAutoparksDropboxSync();
    expect(r3.filesRemoved).toBe(1);
    expect((await store.getAutoparksRoom(car.id))?.files).toHaveLength(1);
  });

  it("jaunam auto ar VIN izveido mapi pēc parauga; bez saknes neko neveido", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    holder.client = db.client;
    const { store, sync } = await load();
    const car = await store.createAutoparksCar({ make: "Audi", model: "A4 Avant", year: "2014", color: "pelēks", vin: "WAUZZZ8K0EA036715" }, actor);
    const r = await sync.linkAutoparksCarToDropbox(car.id);
    expect(r).toMatchObject({ linked: true, path: `/STOCK/Audi A4 Avant 2014 pelēks${SEP}036715` });
    expect((await store.getAutoparksRoom(car.id))?.car.dropboxFolderId).toMatch(/^id:/);

    const noVin = await store.createAutoparksCar({ make: "BMW" }, actor);
    expect(await sync.linkAutoparksCarToDropbox(noVin.id)).toEqual({ linked: false });
  });

  it("divi auto ar to pašu VIN6 -> mapi nesasaista", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    holder.client = db.client;
    const { store, sync } = await load();
    await store.createAutoparksCar({ make: "Volvo", vin: "YV1DZ8256D2439274" }, actor);
    await store.createAutoparksCar({ make: "Volvo", vin: "YV1XXXXXXXX439274" }, actor);
    const r = await sync.runAutoparksDropboxSync();
    expect(r.linked).toBe(0);
  });

  it("bez Dropbox konfigurācijas neko nedara", async () => {
    holder.client = null;
    const { sync } = await load();
    expect(await sync.runAutoparksDropboxSync()).toMatchObject({ ok: false, error: "dropbox_not_configured" });
  });

  it("J36: jaunā struktūra - dokumenti tikai no doc/ + saknes; bildes apakšmapēs netiek pievienotas kā dokumenti", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    db.add("file", `${FOLDER}/info.txt`, "VIN: YV1DZ8256D2439274\nBuild year: 2013\nOdometer: 355,756 km\nColour: Silver");
    db.add("folder", `${FOLDER}/doc`);
    db.add("file", `${FOLDER}/doc/proforma_DEPR02396489.pdf`, "pdf");
    db.add("folder", `${FOLDER}/bildes-izsole`);
    db.add("file", `${FOLDER}/bildes-izsole/1.jpg`, "img");
    db.add("file", `${FOLDER}/bildes-izsole/note.txt`, "piezīme par bildēm - nav dokuments");
    db.add("file", `${FOLDER}/legacy_CMR.pdf`, "cmr");
    holder.client = db.client;
    const { store, sync } = await load();
    const car = await store.createAutoparksCar({ make: "Volvo", vin: "YV1DZ8256D2439274", color: "Sudraba" }, actor);
    const r = await sync.runAutoparksDropboxSync();
    expect(r).toMatchObject({ ok: true, linked: 1 });
    const room = await store.getAutoparksRoom(car.id);
    expect(room?.files.map((f) => f.fileName).sort()).toEqual(["legacy_CMR.pdf", "proforma_DEPR02396489.pdf"]);
  });
});

describe("J36: /STOCK bilžu apakšmapes (bildes-izsole/bildes-canon)", () => {
  it("izsole + canon apvienotas grupās, saknes fallback, ja neviena apakšmape neeksistē", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    db.add("file", `${FOLDER}/02.jpg`, "img");
    db.add("file", `${FOLDER}/01.jpg`, "img");
    holder.client = db.client;
    const { sync } = await load();
    const client = db.client as unknown as Parameters<typeof sync.listAutoparksStockPhotoGroups>[0];
    const rootGroups = await sync.listAutoparksStockPhotoGroups(client, FOLDER);
    expect(rootGroups.flat().map((e) => e.name).sort()).toEqual(["01.jpg", "02.jpg"]);

    db.add("folder", `${FOLDER}/bildes-izsole`);
    db.add("file", `${FOLDER}/bildes-izsole/1.jpg`, "img");
    db.add("folder", `${FOLDER}/bildes-canon`);
    db.add("file", `${FOLDER}/bildes-canon/1.jpg`, "img");
    const groups = await sync.listAutoparksStockPhotoGroups(client, FOLDER);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.map((e) => e.pathDisplay)).toEqual([`${FOLDER}/bildes-izsole/1.jpg`]);
    expect(groups[1]!.map((e) => e.pathDisplay)).toEqual([`${FOLDER}/bildes-canon/1.jpg`]);
  });
});

describe("J36: Autoparka ierakstu pārpiesaiste zināmajām /STOCK mapēm", () => {
  const NEW_FOLDER = "/STOCK/Mercedes Viano 2012 brūns – N1 – A1";
  const OLD_FOLDER = "/STOCK/Mercedes-Benz Viano 2012 brūns – 773018";
  const VIN = "WDF63981313773018";

  it("pārpiesaista, ja auto piesaistīts tukšai vecajai mapei; otrā palaišana ir no-op (already_linked)", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    const oldFolder = db.add("folder", OLD_FOLDER);
    const newFolder = db.add("folder", NEW_FOLDER);
    db.add("folder", `${NEW_FOLDER}/doc`);
    db.add("file", `${NEW_FOLDER}/doc/invoice.pdf`, "pdf");
    holder.client = db.client;
    const { store, sync } = await load();
    const car = await store.createAutoparksCar({ make: "Mercedes-Benz", model: "Viano", vin: VIN }, actor);
    await store.mutateAutoparksState((state) => {
      const idx = state.cars.findIndex((c) => c.id === car.id);
      state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: oldFolder.id, dropboxFolderPath: OLD_FOLDER };
      return { result: null };
    });

    const results = await sync.relinkKnownAutoparksV2Folders("Tests");
    const own = results.find((r) => r.vin === VIN)!;
    expect(own).toMatchObject({ carId: car.id, applied: true, to: NEW_FOLDER });
    const after = await store.getAutoparksRoom(car.id);
    expect(after?.car.dropboxFolderId).toBe(newFolder.id);
    expect(after?.car.dropboxFolderPath).toBe(NEW_FOLDER);

    const again = await sync.relinkKnownAutoparksV2Folders("Tests");
    expect(again.find((r) => r.vin === VIN)).toMatchObject({ applied: false, reason: "already_linked" });
  });

  it("neko nemaina, ja vecā mape nav tukša (nenoteiktība - ziņo, nemaina)", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    const oldFolder = db.add("folder", OLD_FOLDER);
    db.add("file", `${OLD_FOLDER}/kaut-kas.jpg`, "img");
    db.add("folder", NEW_FOLDER);
    holder.client = db.client;
    const { store, sync } = await load();
    const car = await store.createAutoparksCar({ make: "Mercedes-Benz", model: "Viano", vin: VIN }, actor);
    await store.mutateAutoparksState((state) => {
      const idx = state.cars.findIndex((c) => c.id === car.id);
      state.cars[idx] = { ...state.cars[idx]!, dropboxFolderId: oldFolder.id, dropboxFolderPath: OLD_FOLDER };
      return { result: null };
    });

    const results = await sync.relinkKnownAutoparksV2Folders("Tests");
    expect(results.find((r) => r.vin === VIN)).toMatchObject({ applied: false, reason: "old_folder_not_empty" });
    const after = await store.getAutoparksRoom(car.id);
    expect(after?.car.dropboxFolderId).toBe(oldFolder.id);
  });

  it("ziņo car_not_found, ja neviens auto ieraksts neatbilst zināmajam VIN", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    holder.client = db.client;
    const { sync } = await load();
    const results = await sync.relinkKnownAutoparksV2Folders("Tests");
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.reason === "car_not_found")).toBe(true);
  });
});
