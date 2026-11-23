import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropboxApiError, type DropboxClient, type DropboxEntry } from "@/lib/dropbox-client";

const h = vi.hoisted(() => ({ dir: "", drafts: new Map<string, unknown>() }));

vi.mock("@/lib/admin-order-draft-store", () => ({
  getOrderDraftBlobConfig: () => null,
  getOrderDraftStorageDir: () => h.dir,
  isSafeOrderDraftSessionId: (id: string) => /^[A-Za-z0-9_]{4,200}$/.test(id),
  readOrderDraft: async (id: string) => h.drafts.get(id) ?? null,
}));
vi.mock("@/lib/dropbox-client", async (orig) => ({ ...(await orig<typeof import("@/lib/dropbox-client")>()), getDropboxClient: () => null }));

import { ensureOrderDropboxFolder, readOrderDropboxRecord } from "@/lib/order-dropbox";

function entry(tag: DropboxEntry["tag"], p: string, id: string): DropboxEntry {
  return { tag, id, name: p.split("/").pop()!, pathLower: p.toLowerCase(), pathDisplay: p, rev: "", size: 0, contentHash: "", serverModified: "" };
}

function fakeDropbox() {
  const byId = new Map<string, string>();
  let seq = 0;
  const calls = { create: 0, move: 0 };
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
});
afterEach(async () => {
  await fs.rm(h.dir, { recursive: true, force: true });
});

describe("ensureOrderDropboxFolder", () => {
  it("izveido uzreiz ar numuru, pēc CSDD pārdēvē uz marku/modeli (tā pati mape), idempotenti", async () => {
    const dbx = fakeDropbox();
    const r1 = await ensureOrderDropboxFolder("cs_test_order1", { category: "audits", createdMs: created, vin: "RO8544", client: dbx.client });
    expect(r1?.state).toBe("ok");
    expect(r1?.path).toBe("/_PROv/AUDITI/RO8544_2026-11-23_AUDITS");

    // Atkārtots webhook: nekas jauns netiek veidots.
    const again = await ensureOrderDropboxFolder("cs_test_order1", { category: "audits", createdMs: created + 999_999, vin: "RO8544", client: dbx.client });
    expect(again?.path).toBe(r1?.path);
    expect(dbx.calls.create).toBe(1);

    h.drafts.set("cs_test_order1", {
      workspace: { sourceBlocks: { csdd: { makeModel: "LAND ROVER DISCOVERY", registrationNumber: "RO8544", vin: "SALLAAAM6FA743824" } } },
    });
    const r2 = await ensureOrderDropboxFolder("cs_test_order1", { client: dbx.client });
    expect(r2?.path).toBe("/_PROv/AUDITI/LAND ROVER DISCOVERY_RO8544_SALLAAAM6FA743824_2026-11-23_AUDITS");
    expect(r2?.folderId).toBe(r1?.folderId);
    expect(dbx.calls.move).toBe(1);
    expect((await readOrderDropboxRecord("cs_test_order1"))?.path).toBe(r2?.path);

    await ensureOrderDropboxFolder("cs_test_order1", { client: dbx.client });
    expect(dbx.calls.move).toBe(1);
  });

  it("dīlera dati - atsevišķa virsmape", async () => {
    const dbx = fakeDropbox();
    const r = await ensureOrderDropboxFolder("cs_test_dealer", { category: "dealer", createdMs: created, vin: "WBA5R1C0XLFH42873", client: dbx.client });
    expect(r?.path).toBe("/_PROv/DILERA DATI/WBA5R1C0XLFH42873_2026-11-23_DILERA DATI");
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
