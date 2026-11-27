import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Buffer>();
const draft = { workspace: { sourceBlocks: {} as Record<string, unknown> } };

vi.mock("@vercel/blob", () => ({
  get: vi.fn(async (p: string) => {
    const b = store.get(p);
    return b ? { statusCode: 200, stream: new Response(new Uint8Array(b)).body } : null;
  }),
  put: vi.fn(async (p: string, body: Buffer | string) => {
    store.set(p, Buffer.from(body));
    return {};
  }),
  del: vi.fn(async (p: string) => {
    store.delete(p);
  }),
}));
vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => ({ prefix: "t/", token: "x" }),
  getOrderDraftStorageDir: () => null,
  isSafeOrderDraftSessionId: (s: string) => /^cs_[a-z0-9_]+$/i.test(s),
  readOrderDraft: async () => draft,
}));
vi.mock("@/lib/order-dropbox", () => ({
  ensureOrderDropboxFolder: async () => ({ state: "ok", path: "/P/AUDITI/2026-11-27 Renault", folderId: "id:1" }),
  currentOrderDropboxFolderPath: async () => "/P/AUDITI/2026-11-27 Renault",
}));
const jpeg = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(50, n)]);
vi.mock("@/lib/dealer-photos-server", () => ({
  readDealerPhotoJpeg: async (_s: string, id: string) => jpeg(id.endsWith("3") ? 1 : Number(id.slice(-1))),
}));
vi.mock("@/lib/auction-photo-fetch", () => ({
  fetchAuctionPhotoOriginal: async () => ({ ok: true, bytes: jpeg(9) }),
}));

import { dropboxContentHash } from "@/lib/dropbox-content-hash";
import type { DropboxClient } from "@/lib/dropbox-client";
import { readOrderPhotoDropboxRecord, stashOrderPhotoOriginal, syncOrderPhotosToDropbox } from "@/lib/order-photo-dropbox";

const id = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;
const SID = "cs_test_photo";

function fakeClient(existing: { path: string; bytes: Buffer }[] = []) {
  const files = new Map(existing.map((e) => [e.path, e.bytes]));
  const uploads: string[] = [];
  const client = {
    listAll: async (folder: string) => ({
      entries: [...files.entries()]
        .filter(([p]) => p.startsWith(`${folder}/`))
        .map(([p, b]) => ({ tag: "file", name: p.slice(p.lastIndexOf("/") + 1), pathDisplay: p, contentHash: dropboxContentHash(b) })),
      cursor: "",
    }),
    upload: async (p: string, bytes: Uint8Array) => {
      uploads.push(p);
      files.set(p, Buffer.from(bytes));
      return { pathDisplay: p, name: p.slice(p.lastIndexOf("/") + 1) };
    },
  } as unknown as DropboxClient;
  return { client, uploads };
}

beforeEach(() => {
  store.clear();
  process.env.DROPBOX_ACCESS_TOKEN = "t";
  draft.workspace.sourceBlocks = {
    cc_vin: {
      photoGroups: [
        { title: "Autobid 12.10.2026", photos: [{ id: id(1) }, { id: id(2), sourceUrl: "https://img.autobid.de/2.jpg" }, { id: id(3) }] },
      ],
    },
  };
});

describe("pasūtījuma bildes -> Dropbox", () => {
  it("oriģināls / sourceUrl / galerija, bez dublikātiem (tas pats saturs vienā mapē)", async () => {
    await stashOrderPhotoOriginal(SID, id(1), new Uint8Array(Buffer.concat([jpeg(7), Buffer.alloc(500)])), 54);
    const { client, uploads } = fakeClient();
    const r = await syncOrderPhotosToDropbox(SID, { client });
    // id(3) gallery bytes == jpeg(1); id(1) - oriģināls (cits saturs) -> 3 faili.
    expect(uploads.sort()).toEqual([
      "/P/AUDITI/2026-11-27 Renault/Foto - Autobid 12.10.2026/01.jpg",
      "/P/AUDITI/2026-11-27 Renault/Foto - Autobid 12.10.2026/02.jpg",
      "/P/AUDITI/2026-11-27 Renault/Foto - Autobid 12.10.2026/03.jpg",
    ]);
    expect(r).toMatchObject({ total: 3, saved: 3, failed: 0, uploaded: 3 });
    // Oriģināls pēc saglabāšanas dzēsts no krātuves.
    expect([...store.keys()].some((k) => k.includes("order_photo_originals"))).toBe(false);

    // Otrā palaišana - nekas jauns.
    const again = await syncOrderPhotosToDropbox(SID, { client });
    expect(again.skipped).toBe("nothing_to_do");
    expect(uploads).toHaveLength(3);
  });

  it("bilde, kas mapē jau ir (hash), netiek likta otrreiz; kļūda -> failed + atkārtojums", async () => {
    const folder = "/P/AUDITI/2026-11-27 Renault/Foto - Autobid 12.10.2026";
    const { client, uploads } = fakeClient([{ path: `${folder}/vecs.jpg`, bytes: jpeg(1) }]);
    const failing = {
      ...client,
      upload: async (p: string, b: Uint8Array) => {
        if (p.endsWith("02.jpg")) throw new Error("boom");
        return (client as unknown as { upload: (p: string, b: Uint8Array) => Promise<unknown> }).upload(p, b);
      },
      listAll: client.listAll,
    } as unknown as DropboxClient;
    const r = await syncOrderPhotosToDropbox(SID, { client: failing });
    expect(uploads).toEqual([]); // id(1) un id(3) = jpeg(1) jau mapē
    expect(r).toMatchObject({ saved: 2, failed: 1, duplicates: 2 });
    const rec = await readOrderPhotoDropboxRecord(SID);
    expect(rec.items[id(2)]).toMatchObject({ s: "failed", n: 1 });
    expect(rec.items[id(2)]!.next).toBeTruthy();
  });
});
