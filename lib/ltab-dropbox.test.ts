import { describe, expect, it } from "vitest";

import type { DropboxClient, DropboxEntry } from "@/lib/dropbox-client";
import { ltabPdfFileName, provOrderFolderName, saveLtabPdfToOrderFolder } from "@/lib/ltab-dropbox";

const VIN = "WBALW3C59CC891863";

function entry(tag: DropboxEntry["tag"], pathDisplay: string, size = 0): DropboxEntry {
  const name = pathDisplay.split("/").pop()!;
  return { tag, id: `id:${name}`, name, pathLower: pathDisplay.toLowerCase(), pathDisplay, rev: "1", size, contentHash: "", serverModified: "" };
}

/** Atmiņas Dropbox: tikai metodes, ko lieto saglabāšana. */
function fakeDropbox(existing: string[]) {
  const files = new Map<string, DropboxEntry>();
  const folders = new Set(existing);
  const client = {
    async listAll(root: string) {
      return {
        entries: [...folders].filter((f) => f.startsWith(`${root}/`) && !f.slice(root.length + 1).includes("/")).map((f) => entry("folder", f)),
        cursor: "",
      };
    },
    async ensureFolder(p: string) {
      folders.add(p);
      return entry("folder", p);
    },
    async upload(p: string, bytes: Uint8Array) {
      let target = p;
      for (let i = 1; files.has(target.toLowerCase()); i++) target = p.replace(/\.pdf$/, ` (${i}).pdf`);
      const e = entry("file", target, bytes.byteLength);
      files.set(target.toLowerCase(), e);
      return e;
    },
    async getMetadata(idOrPath: string) {
      return [...files.values()].find((f) => f.id === idOrPath || f.pathDisplay === idOrPath) ?? null;
    },
  };
  return { client: client as unknown as DropboxClient, files, folders };
}

const car = { vin: VIN, make: "BMW", model: "640I", year: "2012", plate: "AB1234" };
const pdf = new TextEncoder().encode("%PDF-1.4 ltab");
const NO_ENV = {} as unknown as NodeJS.ProcessEnv;

describe("LTAB PDF -> pasūtījuma Dropbox mape", () => {
  it("saves next to AutoDNA in the existing order folder found by VIN", async () => {
    const db = fakeDropbox(["/_PROv/BMW 640i 3.0 2012 WBALW3C59CC891863", "/_PROv/_Arhīvs", "/_PROv/Ford Ranger"]);
    const saved = await saveLtabPdfToOrderFolder(db.client, car, pdf, NO_ENV);
    expect(saved.path).toBe("/_PROv/BMW 640i 3.0 2012 WBALW3C59CC891863/LTAB - AB1234.pdf");
    expect(saved.folderCreated).toBe(false);
    expect(db.files.size).toBe(1);
  });

  it("creates a folder like Nils' ones when the order has none", async () => {
    const db = fakeDropbox(["/_PROv/Ford Ranger"]);
    const saved = await saveLtabPdfToOrderFolder(db.client, car, pdf, NO_ENV);
    expect(saved.folderCreated).toBe(true);
    expect(saved.path).toBe("/_PROv/BMW 640I 2012 WBALW3C59CC891863/LTAB - AB1234.pdf");
  });

  it("never overwrites an earlier LTAB PDF", async () => {
    const db = fakeDropbox(["/_PROv/BMW 640i 3.0 2012 WBALW3C59CC891863"]);
    await saveLtabPdfToOrderFolder(db.client, car, pdf, NO_ENV);
    const second = await saveLtabPdfToOrderFolder(db.client, car, pdf, NO_ENV);
    expect(second.path).toMatch(/LTAB - AB1234 \(1\)\.pdf$/);
    expect(db.files.size).toBe(2);
  });

  it("uses the PROV_ORDERS_DROPBOX_ROOT override", async () => {
    const db = fakeDropbox(["/Test/PROv/x WBALW3C59CC891863"]);
    const saved = await saveLtabPdfToOrderFolder(db.client, car, pdf, { PROV_ORDERS_DROPBOX_ROOT: "/Test/PROv/" } as unknown as NodeJS.ProcessEnv);
    expect(saved.path).toBe("/Test/PROv/x WBALW3C59CC891863/LTAB - AB1234.pdf");
  });

  it("names files and folders safely", () => {
    expect(ltabPdfFileName("ab1234")).toBe("LTAB - AB1234.pdf");
    expect(provOrderFolderName({ ...car, vin: "" })).toBe("BMW 640I 2012 AB1234");
  });
});
