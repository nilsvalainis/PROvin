import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropboxEntry } from "@/lib/dropbox-client";

/** Atmiņas Dropbox: mapes un faili pēc ceļa (reģistrnejutīgi). */
function memoryDropbox(initialFolders: string[]) {
  const items = new Map<string, DropboxEntry & { bytes?: Buffer }>();
  let seq = 0;
  const add = (tag: "file" | "folder", p: string, bytes?: Buffer) => {
    const e = { tag, id: `id:${++seq}`, name: p.split("/").pop()!, pathLower: p.toLowerCase(), pathDisplay: p, rev: "", size: bytes?.length ?? 0, contentHash: "", serverModified: "", bytes };
    items.set(p.toLowerCase(), e);
    return e;
  };
  initialFolders.forEach((f) => add("folder", f));
  const byRef = (ref: string) => [...items.values()].find((e) => e.id === ref) ?? items.get(ref.toLowerCase()) ?? null;
  const client = {
    getMetadata: vi.fn(async (ref: string) => byRef(ref)),
    listAll: vi.fn(async (root: string) => ({
      entries: [...items.values()].filter((e) => e.pathLower.startsWith(`${root.toLowerCase()}/`) && !e.pathLower.slice(root.length + 1).includes("/")),
      cursor: "",
    })),
    ensureFolder: vi.fn(async (p: string) => byRef(p) ?? add("folder", p)),
    upload: vi.fn(async (p: string, bytes: Uint8Array) => {
      let target = p;
      for (let i = 1; items.has(target.toLowerCase()); i++) target = p.replace(/(\.[^.]+)?$/, ` (${i})$1`);
      return add("file", target, Buffer.from(bytes));
    }),
    download: vi.fn(async (ref: string) => {
      const e = byRef(ref);
      if (!e?.bytes) throw new Error("not_found");
      return { bytes: e.bytes, entry: e };
    }),
    temporaryLink: vi.fn(async () => "https://dl.example/tmp"),
  };
  return { client, items };
}

const holder: { client: unknown } = { client: null };
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => holder.client,
}));

const actor = { id: "u1", name: "Tests" };
let dir = "";

async function loadStore() {
  vi.resetModules();
  return import("@/lib/iriss-autoparks-store");
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-test-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
  holder.client = null;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("autoparks.json rakstīšana ar etag (CAS)", () => {
  it("paralēlas izmaiņas netiek pazaudētas", async () => {
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "Volvo", model: "XC60", vin: "YV1DZ8256D2439274" }, actor);
    await Promise.all([
      ...Array.from({ length: 6 }, (_, i) => store.addAutoparksNote(car.id, "service", `piezīme ${i}`, actor)),
      store.patchAutoparksCar(car.id, { location: "Hermaņi" }, actor),
    ]);
    const state = await store.readAutoparksState();
    expect(state.notes).toHaveLength(6);
    expect(state.cars[0]!.location).toBe("Hermaņi");
  });

  it("veci ieraksti bez Dropbox laukiem normalizējas un paliek nemainīti", async () => {
    await fs.writeFile(
      path.join(dir, "autoparks.json"),
      JSON.stringify({ version: 1, cars: [{ id: "ap-old", make: "Audi", vin: "X" }], files: [{ id: "af-old", carId: "ap-old", blobPath: "autoparks/ap-old/a.pdf", contentType: "application/pdf" }] }),
    );
    await fs.mkdir(path.join(dir, "autoparks/ap-old"), { recursive: true });
    await fs.writeFile(path.join(dir, "autoparks/ap-old/a.pdf"), "OLDPDF");
    const store = await loadStore();
    const state = await store.readAutoparksState();
    expect(state.cars[0]!.dropboxFolderId).toBeUndefined();
    expect(state.files[0]).toMatchObject({ blobPath: "autoparks/ap-old/a.pdf" });
    const got = await store.readAutoparksFileBytes("af-old");
    expect(got?.bytes.toString()).toBe("OLDPDF");
    // Nesaistīta izmaiņa (piezīme) vecajam ierakstam jaunus laukus nepieliek.
    await store.addAutoparksNote("ap-old", "service", "x", actor);
    const raw = JSON.parse(await fs.readFile(path.join(dir, "autoparks.json"), "utf8"));
    expect(Object.keys(raw.cars[0])).not.toContain("dropboxFolderId");
    expect(Object.keys(raw.files[0])).not.toContain("dropboxId");
  });
});

describe("faili Dropbox", () => {
  it("jauns fails nonāk esošajā /STOCK mapē pēc VIN, Blob paliek tukšs", async () => {
    const SEP = " – ";
    const db = memoryDropbox(["/STOCK", `/STOCK/Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`]);
    holder.client = db.client;
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "Volvo", model: "XC60", vin: "YV1DZ8256D2439274" }, actor);
    const res = await store.addAutoparksFile({
      carId: car.id, stage: "service", kind: "invoice", title: "Rēķins", fileName: "r.pdf", contentType: "application/pdf",
      bytes: Buffer.from("PDF1"), scanned: false, actor,
    });
    expect(res?.file.blobPath).toBe("");
    expect(res?.file.dropboxPath).toBe(`/STOCK/Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1/Serviss - Rēķins.pdf`);
    const state = await store.readAutoparksState();
    expect(state.cars[0]!.dropboxFolderPath).toContain("439274");
    expect(db.client.ensureFolder).not.toHaveBeenCalled();
    expect((await store.readAutoparksFileBytes(res!.file.id))?.bytes.toString()).toBe("PDF1");
    await expect(fs.readdir(path.join(dir, "autoparks"))).rejects.toThrow();
  });

  it("jaunam auto mapi izveido pēc parauga; tas pats saturs otrreiz = dublikāts", async () => {
    const db = memoryDropbox(["/STOCK"]);
    holder.client = db.client;
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "Audi", model: "A4", year: "2014", color: "pelēks", vin: "WAUZZZ8K0EA036715" }, actor);
    const input = { carId: car.id, stage: "purchase" as const, kind: "invoice" as const, title: "", fileName: "a.pdf", contentType: "application/pdf", bytes: Buffer.from("X"), scanned: false, actor };
    const first = await store.addAutoparksFile(input);
    const second = await store.addAutoparksFile(input);
    expect(db.client.ensureFolder).toHaveBeenCalledWith("/STOCK/Audi A4 2014 pelēks – 036715");
    expect(second).toMatchObject({ duplicate: true, file: { id: first!.file.id } });
    expect(db.client.upload).toHaveBeenCalledTimes(1);
  });

  it("ja saknes mapes nav (App folder), mapi neveido un fails paliek Blob", async () => {
    const db = memoryDropbox([]);
    holder.client = db.client;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "BMW", vin: "WBA00000000123456" }, actor);
    const res = await store.addAutoparksFile({
      carId: car.id, stage: "sale", kind: "contract", title: "Līgums", fileName: "l.pdf", contentType: "application/pdf",
      bytes: Buffer.from("L"), scanned: false, actor,
    });
    expect(db.client.ensureFolder).not.toHaveBeenCalled();
    expect(res?.file.dropboxId).toBeUndefined();
    expect(res?.file.blobPath).toMatch(/^autoparks\//);
    expect((await store.readAutoparksFileBytes(res!.file.id))?.bytes.toString()).toBe("L");
  });

  it("AUTOPARKS_DROPBOX=off atgriežas pie Blob", async () => {
    const db = memoryDropbox(["/STOCK"]);
    holder.client = db.client;
    vi.stubEnv("AUTOPARKS_DROPBOX", "off");
    const store = await loadStore();
    const car = await store.createAutoparksCar({ make: "VW", vin: "WVW00000000654321" }, actor);
    const res = await store.addAutoparksFile({
      carId: car.id, stage: "sale", kind: "other", title: "", fileName: "x.pdf", contentType: "application/pdf", bytes: Buffer.from("Y"), scanned: false, actor,
    });
    expect(db.client.upload).not.toHaveBeenCalled();
    expect(res?.file.blobPath).not.toBe("");
  });
});
