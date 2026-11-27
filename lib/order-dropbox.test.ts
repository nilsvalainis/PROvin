import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropboxApiError, type DropboxClient, type DropboxEntry } from "@/lib/dropbox-client";

const h = vi.hoisted(() => ({ dir: "", drafts: new Map<string, unknown>(), client: null as unknown, blobFail: false }));

vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => (h.blobFail ? { prefix: "p/", token: "t" } : null),
  getOrderDraftStorageDir: () => h.dir,
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_]{4,200}$/.test(id),
  readOrderDraft: async (id: string) => h.drafts.get(id) ?? null,
}));
vi.mock("@vercel/blob", () => ({
  get: async () => {
    throw new Error("blob 503");
  },
  put: async () => {
    throw new Error("blob 503");
  },
}));
vi.mock("@/lib/dropbox-client", async (orig) => ({ ...(await orig<typeof import("@/lib/dropbox-client")>()), getDropboxClient: () => h.client ?? null }));

import {
  downloadOrderDropboxFile,
  ensureOrderDropboxFolder,
  moveOrderDropboxFolderToCategory,
  notePartnerOrderDropbox,
  readOrderDropboxRecord,
  saveFileToOrderFolderOrLegacy,
} from "@/lib/order-dropbox";

function entry(tag: DropboxEntry["tag"], p: string, id: string): DropboxEntry {
  return { tag, id, name: p.split("/").pop()!, pathLower: p.toLowerCase(), pathDisplay: p, rev: "", size: 0, contentHash: "", serverModified: "" };
}

function fakeDropbox() {
  const byId = new Map<string, string>();
  let seq = 0;
  const calls = { create: 0, move: 0, upload: [] as string[] };
  const client = {
    async ensureFolder(p: string) {
      calls.create++;
      for (const [id, cur] of byId) if (cur === p) return entry("folder", p, id);
      const id = `id:f${++seq}`;
      byId.set(id, p);
      return entry("folder", p, id);
    },
    async getMetadata(idOrPath: string) {
      const p = byId.get(idOrPath);
      return p ? entry("folder", p, idOrPath) : null;
    },
    async upload(p: string) {
      calls.upload.push(p);
      return entry("file", p, `id:u${++seq}`);
    },
    async move(from: string, to: string) {
      calls.move++;
      for (const [id, cur] of byId) if (cur === from) {
        byId.set(id, to);
        return entry("folder", to, id);
      }
      throw new DropboxApiError(409, "from_lookup/not_found");
    },
  } as unknown as DropboxClient;
  return { client, calls, byId };
}

const created = Date.parse("2026-11-23T10:00:00+02:00");

beforeEach(async () => {
  h.dir = await fs.mkdtemp(path.join(os.tmpdir(), "order-dropbox-"));
  h.drafts.clear();
  h.client = null;
  h.blobFail = false;
  vi.unstubAllEnvs();
});
afterEach(async () => {
  await fs.rm(h.dir, { recursive: true, force: true });
});

describe("ensureOrderDropboxFolder", () => {
  it("izveido uzreiz ar numuru, pēc CSDD pārdēvē uz marku/modeli (tā pati mape), idempotenti", async () => {
    const dbx = fakeDropbox();
    const r1 = await ensureOrderDropboxFolder("cs_test_order1", { category: "audits", createdMs: created, vin: "RO8544", client: dbx.client });
    expect(r1?.state).toBe("ok");
    expect(r1?.path).toBe("/_PROv/RO8544_2026-11-23_AUDITS");

    // Atkārtots webhook: nekas jauns netiek veidots.
    const again = await ensureOrderDropboxFolder("cs_test_order1", { category: "audits", createdMs: created + 999_999, vin: "RO8544", client: dbx.client });
    expect(again?.path).toBe(r1?.path);
    expect(dbx.calls.create).toBe(1);

    h.drafts.set("cs_test_order1", {
      workspace: { sourceBlocks: { csdd: { makeModel: "LAND ROVER DISCOVERY", registrationNumber: "RO8544", vin: "SALLAAAM6FA743824" } } },
    });
    const r2 = await ensureOrderDropboxFolder("cs_test_order1", { client: dbx.client });
    expect(r2?.path).toBe("/_PROv/LAND ROVER DISCOVERY_RO8544_SALLAAAM6FA743824_2026-11-23_AUDITS");
    expect(r2?.folderId).toBe(r1?.folderId);
    expect(dbx.calls.move).toBe(1);
    expect((await readOrderDropboxRecord("cs_test_order1"))?.path).toBe(r2?.path);

    await ensureOrderDropboxFolder("cs_test_order1", { client: dbx.client });
    expect(dbx.calls.move).toBe(1);
  });

  it("dīlera dati - atsevišķa virsmape (izveido tikai pie pirmā faila)", async () => {
    const dbx = fakeDropbox();
    const r = await ensureOrderDropboxFolder("cs_test_dealer", { category: "dealer", createdMs: created, vin: "WBA5R1C0XLFH42873", client: dbx.client, materialize: true });
    expect(r?.path).toBe("/_PROv/DĪLERA DATU ARHĪVS/BMW_WBA5R1C0XLFH42873_2026-11-23_DILERA DATI");
  });

  it("dīlera dati (Nils 27.11): pie pasūtījuma mapi neveido - ieraksts pending; pirmais fails izveido mapi", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r = await ensureOrderDropboxFolder("cs_test_dlazy", { category: "dealer", createdMs: created, vin: "WBA5R1C0XLFH42873", client: dbx.client });
    expect(r?.state).toBe("pending");
    expect(r?.path).toBeUndefined();
    expect(dbx.calls.create).toBe(0);
    // Pārdēvēšanas izsaukumi (pēc CSDD sēklas, numurs -> VIN) mapi arī neveido.
    expect((await ensureOrderDropboxFolder("cs_test_dlazy", { vin: "WBA5R1C0XLFH42873", client: dbx.client }))?.state).toBe("pending");
    expect(dbx.calls.create).toBe(0);
    expect((await readOrderDropboxRecord("cs_test_dlazy"))?.state).toBe("pending");

    const saved = await saveFileToOrderFolderOrLegacy("cs_test_dlazy", "Dilera dati.pdf", new Uint8Array([1]), async () => ({ path: "/legacy" }));
    expect(saved.legacy).toBe(false);
    expect(saved.path).toBe("/_PROv/DĪLERA DATU ARHĪVS/BMW_WBA5R1C0XLFH42873_2026-11-23_DILERA DATI/Dilera dati.pdf");
    expect(dbx.calls.create).toBe(1);
    const rec = await readOrderDropboxRecord("cs_test_dlazy");
    expect(rec?.state).toBe("ok");
    expect(rec?.orderCreatedMs).toBe(created);
    // Otrs fails - tā pati mape.
    await saveFileToOrderFolderOrLegacy("cs_test_dlazy", "CSDD.pdf", new Uint8Array([2]), async () => ({ path: "/legacy" }));
    expect(dbx.calls.create).toBe(1);
  });

  it("dīlera dati pending -> produkts mainās uz AUDITS: mapi izveido uzreiz saknē", async () => {
    const dbx = fakeDropbox();
    await ensureOrderDropboxFolder("manual_order_dl", { category: "dealer", createdMs: created, vin: "AB1236", client: dbx.client });
    const r = await moveOrderDropboxFolderToCategory("manual_order_dl", "audits", dbx.client);
    expect(r?.state).toBe("ok");
    expect(r?.path).toBe("/_PROv/AB1236_2026-11-23_AUDITS");
    expect(dbx.calls.create).toBe(1);
  });

  it("AUDITS / MINI / BUSINESS - mape uzreiz", async () => {
    for (const category of ["audits", "mini", "business"] as const) {
      const dbx = fakeDropbox();
      const r = await ensureOrderDropboxFolder(`cs_test_now_${category}`, { category, createdMs: created, vin: "AB1237", client: dbx.client });
      expect(r?.state).toBe("ok");
      expect(dbx.calls.create).toBe(1);
    }
  });

  it("Dropbox kļūda neizmet - ieraksts ar kļūdu (adminā sarkanā)", async () => {
    const client = { ensureFolder: async () => { throw new DropboxApiError(503, "x"); } } as unknown as DropboxClient;
    const r = await ensureOrderDropboxFolder("cs_test_err", { category: "audits", createdMs: created, client });
    expect(r?.state).toBe("error");
    expect(r?.error).toContain("dropbox_503");
  });

  it("bez kategorijas (SELECT u.c.) nekā nedara", async () => {
    const dbx = fakeDropbox();
    expect(await ensureOrderDropboxFolder("cs_test_sel", { client: dbx.client })).toBeNull();
    expect(dbx.calls.create).toBe(0);
  });

  it("Dropbox nav konfigurēts", async () => {
    const r = await ensureOrderDropboxFolder("cs_test_nocfg", { category: "audits", createdMs: created, client: null });
    expect(r?.error).toBe("not_configured");
  });
});

describe("viena mape uz pasūtījumu (Nils 25.11: divas mapes)", () => {
  it("CarVertical/AutoDNA/LTAB/atskaite: jaunam pasūtījumam fails tā mapē, nevis otra mape /_PROv saknē", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("cs_test_one", { category: "audits", createdMs: created, vin: "WAUZZZ4G5JN000001", client: dbx.client });
    h.drafts.set("cs_test_one", { workspace: { sourceBlocks: { csdd: { makeModel: "AUDI A6", vin: "WAUZZZ4G5JN000001" } } } });
    const legacy = vi.fn(async () => ({ path: "/_PROv/Auto WAUZZZ4G5JN000001/CarVertical.pdf" }));
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_one", "CarVertical - WAUZZZ4G5JN000001.pdf", new Uint8Array([1]), legacy);
    expect(legacy).not.toHaveBeenCalled();
    expect(saved.legacy).toBe(false);
    // Tā pati mape (pārdēvēta, kad parādījās marka), jauna netiek veidota.
    expect(saved.path).toBe("/_PROv/AUDI A6_WAUZZZ4G5JN000001_2026-11-23_AUDITS/CarVertical - WAUZZZ4G5JN000001.pdf");
    expect(dbx.calls.create).toBe(1);
    expect(dbx.byId.get(r1!.folderId!)).toBe("/_PROv/AUDI A6_WAUZZZ4G5JN000001_2026-11-23_AUDITS");
  });

  it("ja pasūtījuma mapē saglabāt neizdodas - kļūda, nevis otra mape", async () => {
    await ensureOrderDropboxFolder("cs_test_err2", { category: "audits", createdMs: created, vin: "AB1234", client: null });
    const legacy = vi.fn(async () => ({ path: "/_PROv/x.pdf" }));
    await expect(saveFileToOrderFolderOrLegacy("cs_test_err2", "x.pdf", new Uint8Array([1]), legacy)).rejects.toThrow();
    expect(legacy).not.toHaveBeenCalled();
  });

  it("vecs pasūtījums bez mapes ieraksta - kā līdz šim mape pēc VIN /_PROv saknē", async () => {
    const legacy = vi.fn(async () => ({ path: "/_PROv/BMW 530 2012 WBAMW91010DV00001/AutoDNA.pdf" }));
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_old", "AutoDNA.pdf", new Uint8Array([1]), legacy);
    expect(legacy).toHaveBeenCalledOnce();
    expect(saved).toEqual({ path: "/_PROv/BMW 530 2012 WBAMW91010DV00001/AutoDNA.pdf", duplicate: false, legacy: true });
  });
});

describe("ieraksta krātuve neatbild", () => {
  it("nelasāms ieraksts - jaunu (otru) mapi neveido", async () => {
    const dbx = fakeDropbox();
    h.blobFail = true;
    vi.stubEnv("VERCEL", "1");
    expect(await ensureOrderDropboxFolder("cs_test_blob", { category: "audits", createdMs: created, vin: "AB1234", client: dbx.client })).toBeNull();
    expect(dbx.calls.create).toBe(0);
    await expect(saveFileToOrderFolderOrLegacy("cs_test_blob", "x.pdf", new Uint8Array([1]), async () => ({ path: "/x" }))).rejects.toThrow(
      "order_dropbox_record_unreadable",
    );
  });
});

describe("produkta maiņa: mapi pārvieto, nevis veido jaunu", () => {
  it("manuālais pasūtījums AUDITI -> BUSINESS: tā pati mape (id), jauns ceļš un nosaukums; atskaite nonāk tur", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("manual_order_t1", { category: "audits", createdMs: created, vin: "WBA00000000000001", client: dbx.client });
    h.drafts.set("manual_order_t1", { workspace: { sourceBlocks: { csdd: { makeModel: "BMW 325", vin: "WBA00000000000001" } } } });
    const moved = await moveOrderDropboxFolderToCategory("manual_order_t1", "business", dbx.client);
    expect(moved?.category).toBe("business");
    expect(moved?.folderId).toBe(r1?.folderId);
    expect(moved?.path).toBe("/_PROv/BMW 325_WBA00000000000001_2026-11-23_BUSINESS");
    expect(dbx.byId.get(r1!.folderId!)).toBe(moved?.path);
    expect(dbx.calls.create).toBe(1);
    expect((await readOrderDropboxRecord("manual_order_t1"))?.category).toBe("business");

    const saved = await saveFileToOrderFolderOrLegacy("manual_order_t1", "PROVIN_BUSINESS_WBA00000000000001.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(saved.path).toBe("/_PROv/BMW 325_WBA00000000000001_2026-11-23_BUSINESS/PROVIN_BUSINESS_WBA00000000000001.pdf");
    expect(dbx.calls.create).toBe(1);

    // Tā pati kategorija vēlreiz - nekas nenotiek.
    await moveOrderDropboxFolderToCategory("manual_order_t1", "business", dbx.client);
    expect(dbx.calls.move).toBe(1);
  });

  it("pārvietošana neizdodas (mērķis aizņemts) - paliek vecā virsmape, nākamreiz mēģina vēlreiz", async () => {
    const dbx = fakeDropbox();
    const r1 = await ensureOrderDropboxFolder("manual_order_t2", { category: "audits", createdMs: created, vin: "WBA00000000000002", client: dbx.client });
    const failing = {
      ...dbx.client,
      getMetadata: dbx.client.getMetadata,
      move: async () => {
        throw new DropboxApiError(409, "to/conflict/folder");
      },
    } as unknown as DropboxClient;
    const r2 = await moveOrderDropboxFolderToCategory("manual_order_t2", "dealer", failing);
    expect(r2?.category).toBe("audits");
    expect(r2?.path).toBe(r1?.path);
    expect((await readOrderDropboxRecord("manual_order_t2"))?.category).toBe("audits");
    const r3 = await moveOrderDropboxFolderToCategory("manual_order_t2", "dealer", dbx.client);
    expect(r3?.path).toBe("/_PROv/DĪLERA DATU ARHĪVS/BMW_WBA00000000000002_2026-11-23_DILERA DATI");
  });

  it("vecs pasūtījums bez mapes ieraksta - neko neveido", async () => {
    const dbx = fakeDropbox();
    expect(await moveOrderDropboxFolderToCategory("manual_order_old", "business", dbx.client)).toBeNull();
    expect(dbx.calls.create).toBe(0);
  });
});

describe("paralēla pārdēvēšana (Nils 26.11: 540i LTAB PDF otrā mapē ar veco nosaukumu)", () => {
  it("cits izsaukums mapi jau pārdēvēja - ieraksts un fails iet uz jauno ceļu, vecā mape netiek atjaunota", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("cs_test_race", { category: "dealer", createdMs: created, vin: "WBAJB5101HWA00001", client: dbx.client, materialize: true });
    expect(r1?.path).toBe("/_PROv/DĪLERA DATU ARHĪVS/BMW_WBAJB5101HWA00001_2026-11-23_DILERA DATI");
    h.drafts.set("cs_test_race", {
      workspace: { sourceBlocks: { csdd: { makeModel: "BMW 540I XDRIVE", registrationNumber: "BM0001", vin: "WBAJB5101HWA00001" } } },
    });
    const renamed = "/_PROv/DĪLERA DATU ARHĪVS/BMW 540I XDRIVE_BM0001_WBAJB5101HWA00001_2026-11-23_DILERA DATI";
    // Šis izsaukums nolasa metadatus ar veco nosaukumu, bet pirms tā pārdēvē paralēls izsaukums.
    let first = true;
    const racing = {
      ...dbx.client,
      getMetadata: async (id: string) => {
        const m = await dbx.client.getMetadata(id);
        if (first && m) {
          first = false;
          dbx.byId.set(id, renamed);
        }
        return m;
      },
      move: dbx.client.move,
      upload: dbx.client.upload,
      ensureFolder: dbx.client.ensureFolder,
    } as unknown as DropboxClient;
    const r2 = await ensureOrderDropboxFolder("cs_test_race", { client: racing });
    expect(r2?.path).toBe(renamed);
    expect((await readOrderDropboxRecord("cs_test_race"))?.path).toBe(renamed);

    const saved = await saveFileToOrderFolderOrLegacy("cs_test_race", "LTAB - BM0001.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(saved.path).toBe(`${renamed}/LTAB - BM0001.pdf`);
    expect(dbx.calls.upload).toEqual([`${renamed}/LTAB - BM0001.pdf`]);
    expect(dbx.calls.create).toBe(1);
  });

  it("ieraksta ceļš novecojis - augšupielāde pēc mapes id, nevis pēc ieraksta ceļa", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("cs_test_stale", { category: "audits", createdMs: created, vin: "AB1234", client: dbx.client });
    // Mape pārdēvēta ārpus šī izsaukuma (piem. Nils Dropbox), ieraksts vēl rāda veco ceļu.
    dbx.byId.set(r1!.folderId!, "/_PROv/AUDI A6_AB1234_2026-11-23_AUDITS");
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_stale", "CarVertical - X.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(saved.path).toBe("/_PROv/AUDI A6_AB1234_2026-11-23_AUDITS/CarVertical - X.pdf");
  });

  it("mapi pārdēvē tieši augšupielādes brīdī - fails pārcelts uz īsto mapi, tukšā liekā mape uz atkritni", async () => {
    const dbx = fakeDropbox();
    const r1 = await ensureOrderDropboxFolder("cs_test_mid", { category: "audits", createdMs: created, vin: "AB1235", client: dbx.client });
    const oldPath = r1!.path!;
    const newPath = "/_PROv/AUDI A6_AB1235_2026-11-23_AUDITS";
    const deleted: string[] = [];
    const moved: Array<[string, string]> = [];
    const client = {
      ...dbx.client,
      getMetadata: dbx.client.getMetadata,
      ensureFolder: dbx.client.ensureFolder,
      async upload(p: string) {
        dbx.byId.set(r1!.folderId!, newPath); // paralēla pārdēvēšana
        return entry("file", p, "id:file1");
      },
      async move(from: string, to: string) {
        moved.push([from, to]);
        return entry("file", to, "id:file1");
      },
      async listFolder() {
        return { entries: [], cursor: "", hasMore: false };
      },
      async deleteFile(p: string) {
        deleted.push(p);
      },
    } as unknown as DropboxClient;
    h.client = client;
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_mid", "LTAB - AB1235.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(moved).toEqual([[`${oldPath}/LTAB - AB1235.pdf`, `${newPath}/LTAB - AB1235.pdf`]]);
    expect(deleted).toEqual([oldPath]);
    expect(saved.path).toBe(`${newPath}/LTAB - AB1235.pdf`);
  });
});

describe("PDF pēc saglabātā ceļa, kad dubultmapes apvienotas (Nils 26.11)", () => {
  function withFiles(dbx: ReturnType<typeof fakeDropbox>, files: Record<string, number[]>) {
    const downloads: string[] = [];
    const client = {
      ...dbx.client,
      getMetadata: dbx.client.getMetadata,
      async download(p: string) {
        downloads.push(p);
        const f = files[p];
        if (!f) throw new DropboxApiError(409, "path/not_found/..");
        return { bytes: Buffer.from(f), entry: null };
      },
    } as unknown as DropboxClient;
    return { client, downloads };
  }

  it("ceļš derīgs - lasa to pašu, rezervi nemeklē", async () => {
    const dbx = fakeDropbox();
    const { client, downloads } = withFiles(dbx, { "/_PROv/X/LTAB - AB1.pdf": [1, 2] });
    const got = await downloadOrderDropboxFile(client, "cs_test_dl1", "/_PROv/X/LTAB - AB1.pdf");
    expect(got).toEqual({ bytes: new Uint8Array([1, 2]), path: "/_PROv/X/LTAB - AB1.pdf", fallback: false });
    expect(downloads).toHaveLength(1);
  });

  it("vecā mape pārvietota uz arhīvu - fails atrasts pasūtījuma kanoniskajā mapē pēc nosaukuma", async () => {
    const dbx = fakeDropbox();
    const r = await ensureOrderDropboxFolder("cs_test_dl2", { category: "dealer", createdMs: created, vin: "WBAJB5101HWA00002", client: dbx.client, materialize: true });
    dbx.byId.set(r!.folderId!, "/_PROv/DĪLERA DATU ARHĪVS/BMW 540I XDRIVE_BM0002_WBAJB5101HWA00002_2026-11-23_DILERA DATI");
    const canon = "/_PROv/DĪLERA DATU ARHĪVS/BMW 540I XDRIVE_BM0002_WBAJB5101HWA00002_2026-11-23_DILERA DATI/LTAB - BM0002.pdf";
    const { client } = withFiles(dbx, { [canon]: [7] });
    const got = await downloadOrderDropboxFile(client, "cs_test_dl2", "/_PROv/DĪLERA DATU ARHĪVS/WBAJB5101HWA00002_2026-11-23_DILERA DATI/LTAB - BM0002.pdf");
    expect(got).toEqual({ bytes: new Uint8Array([7]), path: canon, fallback: true });
    // Saknes mape («Auto VIN») - tas pats.
    const got2 = await downloadOrderDropboxFile(client, "cs_test_dl2", "/_PROv/Auto WBAJB5101HWA00002/LTAB - BM0002.pdf");
    expect(got2?.path).toBe(canon);
  });

  it("nav ne pa ceļu, ne kanoniskajā mapē / nav ieraksta - null", async () => {
    const dbx = fakeDropbox();
    await ensureOrderDropboxFolder("cs_test_dl3", { category: "audits", createdMs: created, vin: "AB0003", client: dbx.client });
    const { client } = withFiles(dbx, {});
    expect(await downloadOrderDropboxFile(client, "cs_test_dl3", "/_PROv/Auto AB0003/CarVertical - X.pdf")).toBeNull();
    expect(await downloadOrderDropboxFile(client, "cs_test_noreq", "/_PROv/Auto AB0004/CarVertical - X.pdf")).toBeNull();
  });

  it("cita Dropbox kļūda (ne not_found) netiek noslēpta", async () => {
    const dbx = fakeDropbox();
    const client = { ...dbx.client, download: async () => { throw new DropboxApiError(503, "x"); } } as unknown as DropboxClient;
    await expect(downloadOrderDropboxFile(client, "cs_test_dl5", "/_PROv/a.pdf")).rejects.toThrow();
  });
});

describe("_PROv struktūra (Nils 27.11): sakne + arhīvi + PARTNERI", () => {
  it("Nils mapi pārvietoja uz AUDITU ARHĪVS - pārdēvēšana notiek tur pat, mape netiek vilkta atpakaļ uz sakni", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("cs_test_arch", { category: "audits", createdMs: created, vin: "RO8545", client: dbx.client });
    expect(r1?.path).toBe("/_PROv/RO8545_2026-11-23_AUDITS");
    dbx.byId.set(r1!.folderId!, "/_PROv/AUDITU ARHĪVS/RO8545_2026-11-23_AUDITS");
    h.drafts.set("cs_test_arch", {
      workspace: { sourceBlocks: { csdd: { makeModel: "LAND ROVER DISCOVERY", registrationNumber: "RO8545", vin: "SALLAAAM6FA743825" } } },
    });
    const r2 = await ensureOrderDropboxFolder("cs_test_arch", { client: dbx.client });
    expect(r2?.path).toBe("/_PROv/AUDITU ARHĪVS/LAND ROVER DISCOVERY_RO8545_SALLAAAM6FA743825_2026-11-23_AUDITS");
    expect(r2?.folderId).toBe(r1?.folderId);
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_arch", "LTAB - RO8545.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(saved.path).toBe(`${r2!.path}/LTAB - RO8545.pdf`);
    expect(dbx.calls.create).toBe(1);
  });

  it("vecs ieraksts ar ceļu /_PROv/AUDITI/... (mape tagad AUDITU ARHĪVS pēc id) - fails nonāk īstajā mapē", async () => {
    const dbx = fakeDropbox();
    h.client = dbx.client;
    const r1 = await ensureOrderDropboxFolder("cs_test_old", { category: "audits", createdMs: created, vin: "AB1299", client: dbx.client });
    dbx.byId.set(r1!.folderId!, "/_PROv/AUDITU ARHĪVS/AUDI A6_AB1299_2026-11-23_AUDITS");
    const saved = await saveFileToOrderFolderOrLegacy("cs_test_old", "CarVertical - X.pdf", new Uint8Array([1]), async () => ({ path: "/x" }));
    expect(saved.path).toBe("/_PROv/AUDITU ARHĪVS/AUDI A6_AB1299_2026-11-23_AUDITS/CarVertical - X.pdf");
  });

  it("partnera Business: esošā partnera mape pēc nosaukuma (RKG GROUP), id saglabāts nākamajiem", async () => {
    const dbx = fakeDropbox();
    const rkgId = "id:rkg";
    dbx.byId.set(rkgId, "/_PROv/PARTNERI/Pērc un brauc (RKG GROUP)");
    const lists: string[] = [];
    const client = {
      ...dbx.client,
      getMetadata: dbx.client.getMetadata,
      ensureFolder: dbx.client.ensureFolder,
      move: dbx.client.move,
      upload: dbx.client.upload,
      async listAll(p: string) {
        lists.push(p);
        const kids = [...dbx.byId].filter(([, cur]) => cur.startsWith(`${p}/`) && !cur.slice(p.length + 1).includes("/"));
        return { entries: kids.map(([id, cur]) => entry("folder", cur, id)), cursor: "" };
      },
    } as unknown as DropboxClient;
    await notePartnerOrderDropbox("manual_order_pb1", { category: "business", partnerId: "p_rkg", partnerName: "RKG Group SIA", createdMs: created, vin: "TMBJJ9NS7J8097121" });
    const r = await ensureOrderDropboxFolder("manual_order_pb1", { category: "business", vin: "TMBJJ9NS7J8097121", client });
    expect(r?.state).toBe("ok");
    expect(r?.path).toBe("/_PROv/PARTNERI/Pērc un brauc (RKG GROUP)/ŠKODA_TMBJJ9NS7J8097121_2026-11-23_BUSINESS");
    expect(r?.partnerId).toBe("p_rkg");
    // Partnera mapi pārdēvē - nākamais pasūtījums to atrod pēc id, nevis pēc nosaukuma.
    dbx.byId.set(rkgId, "/_PROv/PARTNERI/RKG");
    await notePartnerOrderDropbox("manual_order_pb2", { category: "business", partnerId: "p_rkg", partnerName: "RKG Group SIA", createdMs: created, vin: "WBA00000000000009" });
    const r2 = await ensureOrderDropboxFolder("manual_order_pb2", { category: "business", vin: "WBA00000000000009", client });
    expect(r2?.path?.startsWith("/_PROv/PARTNERI/RKG/")).toBe(true);
    expect(lists).toEqual(["/_PROv/PARTNERI"]);
  });

  it("jauns partneris - izveido PARTNERI/<Uzņēmums>; partnera dīlera dati - pending, mape partnera mapē pie pirmā faila", async () => {
    const dbx = fakeDropbox();
    const client = {
      ...dbx.client,
      getMetadata: dbx.client.getMetadata,
      ensureFolder: dbx.client.ensureFolder,
      move: dbx.client.move,
      upload: dbx.client.upload,
      async listAll() {
        return { entries: [], cursor: "" };
      },
    } as unknown as DropboxClient;
    h.client = client;
    await notePartnerOrderDropbox("manual_order_pd1", { category: "dealer", partnerId: "p_new", partnerName: "Jauns Auto SIA", createdMs: created, vin: "WBA5R1C0XLFH42873" });
    const pend = await ensureOrderDropboxFolder("manual_order_pd1", { category: "dealer", vin: "WBA5R1C0XLFH42873", client });
    expect(pend?.state).toBe("pending");
    expect(pend?.partnerId).toBe("p_new");
    const saved = await saveFileToOrderFolderOrLegacy("manual_order_pd1", "Dilera dati.pdf", new Uint8Array([1]), async () => ({ path: "/legacy" }));
    expect(saved.path).toBe("/_PROv/PARTNERI/Jauns Auto SIA/BMW_WBA5R1C0XLFH42873_2026-11-23_DILERA DATI/Dilera dati.pdf");
  });

  it("notePartnerOrderDropbox esošu ierakstu nepārraksta", async () => {
    const dbx = fakeDropbox();
    const r1 = await ensureOrderDropboxFolder("manual_order_pn", { category: "audits", createdMs: created, vin: "AB1300", client: dbx.client });
    await notePartnerOrderDropbox("manual_order_pn", { category: "business", partnerId: "p_x", partnerName: "X", createdMs: created });
    const rec = await readOrderDropboxRecord("manual_order_pn");
    expect(rec?.path).toBe(r1?.path);
    expect(rec?.partnerId).toBeUndefined();
  });
});
