import { describe, expect, it } from "vitest";
import { DropboxApiError, type DropboxEntry } from "@/lib/dropbox-client";
import { findWaybillFileByNumber, saveWaybillPdfToDropbox } from "@/lib/iriss-waybill-dropbox-core";

const FOLDER = "/Pavadzīmes_IRISS";

function entry(name: string, size: number, dir = FOLDER): DropboxEntry {
  return {
    tag: "file",
    id: `id:${name}`,
    name,
    pathLower: `${dir}/${name}`.toLowerCase(),
    pathDisplay: `${dir}/${name}`,
    rev: "1",
    size,
    contentHash: "",
    serverModified: "",
  };
}

/** Atmiņas "Dropbox": nekad nedzēš; upload ar add bez autorename -> 409 conflict, ja fails jau ir. */
function fakeDropbox(initial: DropboxEntry[] = [], opts: { failUploads?: number; zeroAfterUpload?: boolean } = {}) {
  const files = new Map(initial.map((e) => [e.pathLower, e]));
  const uploads: { path: string; mode: string; autorename?: boolean }[] = [];
  let failUploads = opts.failUploads ?? 0;
  const byIdOrPath = (p: string) => [...files.values()].find((e) => e.id === p || e.pathLower === p.toLowerCase()) ?? null;
  const client = {
    async listAll() {
      return { entries: [...files.values()], cursor: "" };
    },
    async getMetadata(p: string) {
      return byIdOrPath(p);
    },
    async upload(path: string, bytes: Uint8Array, mode: "add" | "overwrite" = "add", o: { autorename?: boolean } = {}) {
      uploads.push({ path, mode, autorename: o.autorename });
      if (failUploads > 0) {
        failUploads -= 1;
        throw new DropboxApiError(500, "internal");
      }
      if (files.has(path.toLowerCase())) throw new DropboxApiError(409, "path/conflict/file/..");
      const name = path.split("/").pop() ?? "";
      const e = entry(name, opts.zeroAfterUpload ? 0 : bytes.byteLength);
      files.set(e.pathLower, e);
      return e;
    },
  };
  return { client, files, uploads };
}

const PDF = new Uint8Array([37, 80, 68, 70, 45, 49]);
const noSleep = async () => {};
const input = { folder: FOLDER, fileName: "P02813_MB_E250_B762-7.pdf", waybillNo: "P02813", bytes: PDF };

describe("waybill PDF -> Dropbox", () => {
  it("uploads into /Pavadzīmes_IRISS without overwrite and verifies size", async () => {
    const d = fakeDropbox();
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    expect(res).toEqual({ ok: true, path: `${FOLDER}/P02813_MB_E250_B762-7.pdf`, size: PDF.byteLength, reused: false });
    expect(d.uploads).toEqual([{ path: `${FOLDER}/P02813_MB_E250_B762-7.pdf`, mode: "add", autorename: false }]);
  });

  it("is idempotent: second save reuses the file, no second upload", async () => {
    const d = fakeDropbox();
    await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    const again = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    expect(again).toMatchObject({ ok: true, reused: true });
    expect(d.uploads).toHaveLength(1);
  });

  it("reuses Aivars' file with the same number (also in Arhīvs), even with another name", async () => {
    const d = fakeDropbox([entry("P02813_Mercedes_E_B762-7.pdf", 1000, `${FOLDER}/Arhīvs`)]);
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    expect(res).toMatchObject({ ok: true, reused: true, path: `${FOLDER}/Arhīvs/P02813_Mercedes_E_B762-7.pdf` });
    expect(d.uploads).toHaveLength(0);
  });

  it("never overwrites an existing empty file - reports error instead", async () => {
    const d = fakeDropbox([entry("P02813_MB_E250_B762-7.pdf", 0)]);
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    expect(res.ok).toBe(false);
    expect(d.uploads).toHaveLength(0);
    expect(d.files.get(`${FOLDER}/P02813_MB_E250_B762-7.pdf`.toLowerCase())?.size).toBe(0);
  });

  it("retries after a Dropbox failure", async () => {
    const d = fakeDropbox([], { failUploads: 1 });
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, input);
    expect(res).toMatchObject({ ok: true, reused: false });
    expect(d.uploads).toHaveLength(2);
  });

  it("verification failure (0 bytes) is an error for the admin", async () => {
    const d = fakeDropbox([], { zeroAfterUpload: true });
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, { ...input, attempts: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Dropbox/);
    expect(d.uploads).toHaveLength(1);
  });

  it("without PDF bytes nothing is uploaded", async () => {
    const d = fakeDropbox();
    const res = await saveWaybillPdfToDropbox({ client: d.client, sleep: noSleep }, { ...input, bytes: null });
    expect(res).toEqual({ ok: false, error: "PDF nav pieejams augšupielādei." });
    expect(d.uploads).toHaveLength(0);
  });

  it("matches only the exact waybill number", () => {
    const list = [entry("P028130_X.pdf", 10), entry("P02813_MB_E250_B762-7.pdf", 10)];
    expect(findWaybillFileByNumber(list, "P02813")?.name).toBe("P02813_MB_E250_B762-7.pdf");
    expect(findWaybillFileByNumber([entry("P028130_X.pdf", 10)], "P02813")).toBeNull();
  });
});
