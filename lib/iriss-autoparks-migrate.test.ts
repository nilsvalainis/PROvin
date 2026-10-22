import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropboxEntry } from "@/lib/dropbox-client";
import { dropboxContentHash } from "@/lib/dropbox-content-hash";

const SEP = " – ";
const FOLDER = `/STOCK/Volvo XC60 2013 sudrabs${SEP}439274${SEP}A1`;

function memoryDropbox() {
  const items = new Map<string, DropboxEntry & { bytes?: Buffer }>();
  let seq = 0;
  const add = (tag: "file" | "folder", p: string, bytes?: Buffer) => {
    let target = p;
    for (let i = 1; items.has(target.toLowerCase()); i++) target = p.replace(/(\.[^.]+)?$/, ` (${i})$1`);
    const e = { tag, id: `id:${++seq}`, name: target.split("/").pop()!, pathLower: target.toLowerCase(), pathDisplay: target, rev: "", size: bytes?.length ?? 0, contentHash: bytes ? dropboxContentHash(bytes) : "", serverModified: "", bytes };
    items.set(target.toLowerCase(), e);
    return e;
  };
  const byRef = (ref: string) => [...items.values()].find((e) => e.id === ref) ?? items.get(ref.toLowerCase()) ?? null;
  const hooks: { onUpload?: () => Promise<void> } = {};
  const client = {
    getMetadata: vi.fn(async (ref: string) => byRef(ref)),
    listAll: vi.fn(async (ref: string, o: { recursive?: boolean } = {}) => {
      const root = byRef(ref)?.pathDisplay ?? ref;
      return { entries: [...items.values()].filter((e) => e.pathLower.startsWith(`${root.toLowerCase()}/`) && (o.recursive || !e.pathLower.slice(root.length + 1).includes("/"))), cursor: "" };
    }),
    ensureFolder: vi.fn(async (p: string) => byRef(p) ?? add("folder", p)),
    upload: vi.fn(async (p: string, b: Uint8Array) => {
      await hooks.onUpload?.();
      return add("file", p, Buffer.from(b));
    }),
    download: vi.fn(async (ref: string) => ({ bytes: byRef(ref)!.bytes!, entry: byRef(ref) })),
    temporaryLink: vi.fn(async () => "https://dl.example/x"),
  };
  return { client, add, items, hooks };
}

const holder: { client: unknown } = { client: null };
vi.mock("@/lib/dropbox-client", async (orig) => ({ ...(await orig<typeof import("@/lib/dropbox-client")>()), getDropboxClient: () => holder.client }));

let dir = "";
const actor = { id: "u1", name: "IRISS aģents" };

async function seed() {
  const state = {
    version: 1,
    cars: [
      { id: "ap-1", make: "Volvo", model: "XC60", year: "2013", vin: "YV1DZ8256D2439274" },
      { id: "ap-2", make: "Audi", model: "A4", year: "2014", color: "pelēks", vin: "WAUZZZ8K0EA036715" },
    ],
    files: [
      { id: "af-1", carId: "ap-1", stage: "purchase", kind: "invoice", title: "Rēķins", fileName: "r.pdf", contentType: "application/pdf", blobPath: "autoparks/ap-1/a.pdf", sha256: "a" },
      { id: "af-2", carId: "ap-1", stage: "service", kind: "estimate", title: "Tāme", fileName: "t.pdf", contentType: "application/pdf", blobPath: "autoparks/ap-1/b.pdf", sha256: "b" },
      { id: "af-3", carId: "ap-2", stage: "sale", kind: "contract", title: "Līgums", fileName: "l.pdf", contentType: "application/pdf", blobPath: "autoparks/ap-2/c.pdf", sha256: "c" },
      { id: "af-del", carId: "ap-2", stage: "sale", kind: "other", title: "Izņemts", fileName: "x.pdf", contentType: "application/pdf", blobPath: "autoparks/ap-2/x.pdf", sha256: "x", deletedAt: "2026-10-01" },
    ],
    notes: [],
    work: [],
    events: [],
  };
  await fs.writeFile(path.join(dir, "autoparks.json"), JSON.stringify(state));
  for (const [p, body] of [["autoparks/ap-1/a.pdf", "A"], ["autoparks/ap-1/b.pdf", "B"], ["autoparks/ap-2/c.pdf", "C"], ["autoparks/ap-2/x.pdf", "X"]]) {
    await fs.mkdir(path.dirname(path.join(dir, p!)), { recursive: true });
    await fs.writeFile(path.join(dir, p!), body!);
  }
}

async function load() {
  vi.resetModules();
  return { mig: await import("@/lib/iriss-autoparks-migrate"), store: await import("@/lib/iriss-autoparks-store") };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-mig-"));
  vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
  vi.stubEnv("VERCEL", "");
  await seed();
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("Autoparks Blob -> Dropbox migrācija", () => {
  it("dry-run neko nemaina un neko neaugšupielādē", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    holder.client = db.client;
    const before = await fs.readFile(path.join(dir, "autoparks.json"), "utf8");
    const { mig } = await load();
    const r = await mig.runAutoparksBlobMigration({ dryRun: true });
    expect(r).toMatchObject({ dryRun: true, totalLive: 3, blobOnlyBefore: 3, processed: 0, remaining: 3 });
    expect(r.items[0]!.target).toBe(`${FOLDER}/Iegāde - Rēķins.pdf`);
    expect(db.client.upload).not.toHaveBeenCalled();
    expect(db.client.ensureFolder).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(dir, "autoparks.json"), "utf8")).toBe(before);
  });

  it("pārceļ, saglabā blobPath, Blob failus nedzēš, atkārtojums ir idempotents un skaits sakrīt caur API", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    db.add("folder", FOLDER);
    db.add("file", `${FOLDER}/jau ir.pdf`, Buffer.from("B")); // tāds pats saturs kā af-2
    holder.client = db.client;
    const { mig, store } = await load();
    const r = await mig.runAutoparksBlobMigration({ dryRun: false, verify: true });
    expect(r).toMatchObject({ processed: 3, copied: 2, reused: 1, failed: 0, remaining: 0 });
    expect(r.verify).toEqual({ recordsWithDropbox: 3, foundInDropbox: 3, missing: [], blobPathsKept: 3 });
    const state = await store.readAutoparksState();
    expect(state.files.find((f) => f.id === "af-2")!.dropboxPath).toBe(`${FOLDER}/jau ir.pdf`);
    expect(state.files.find((f) => f.id === "af-del")!.dropboxId).toBeUndefined();
    for (const p of ["autoparks/ap-1/a.pdf", "autoparks/ap-1/b.pdf", "autoparks/ap-2/c.pdf", "autoparks/ap-2/x.pdf"]) {
      await expect(fs.stat(path.join(dir, p))).resolves.toBeTruthy();
    }
    expect((await store.readAutoparksFileBytes("af-3"))?.bytes.toString()).toBe("C");

    const again = await mig.runAutoparksBlobMigration({ dryRun: false });
    expect(again).toMatchObject({ blobOnlyBefore: 0, processed: 0 });
    expect(db.client.upload).toHaveBeenCalledTimes(2);
  });

  it("paralēli ievadītie dati migrācijas laikā netiek pazaudēti", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    holder.client = db.client;
    const { mig, store } = await load();
    let n = 0;
    db.hooks.onUpload = async () => {
      n += 1;
      await store.addAutoparksNote("ap-1", "service", `aģenta piezīme ${n}`, actor);
      await store.patchAutoparksCar("ap-2", { location: `Hermaņi ${n}` }, actor);
    };
    const r = await mig.runAutoparksBlobMigration({ dryRun: false, limit: 2 });
    expect(r).toMatchObject({ processed: 2, remaining: 1 });
    const state = await store.readAutoparksState();
    expect(state.notes.map((x) => x.text)).toEqual(["aģenta piezīme 1", "aģenta piezīme 2"]);
    expect(state.cars.find((c) => c.id === "ap-2")!.location).toBe("Hermaņi 2");
    expect(state.files.filter((f) => f.dropboxId)).toHaveLength(2);
  });

  it("izņemts fails paralēli -> migrācija to neatjauno", async () => {
    const db = memoryDropbox();
    db.add("folder", "/STOCK");
    holder.client = db.client;
    const { mig, store } = await load();
    db.hooks.onUpload = async () => {
      await store.softDeleteAutoparksFile("af-1", actor);
    };
    await mig.runAutoparksBlobMigration({ dryRun: false, limit: 1 });
    const f = (await store.readAutoparksState()).files.find((x) => x.id === "af-1")!;
    expect(f.deletedAt).not.toBe("");
    expect(f.dropboxId).toBeUndefined();
  });
});
