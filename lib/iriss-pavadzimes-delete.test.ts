/**
 * 19.11 Pavadzīmju sarakstā «Dzēst» (tikai administrators): dzēš TIKAI izvēlēto ierakstu (indekss + tā PDF kopija),
 * Dropbox sinhronizācija to neatjauno, CSDD netiek aiztikts. Darbinieks/partneris - 403.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  isWaybillTombstoned,
  removeWaybillFromIndex,
  waybillDeleteBlocked,
  waybillDeleteConfirmText,
} from "@/lib/iriss-pavadzimes-delete";
import { emptyIrissPavadzimeRecord, type IrissPavadzimeRecord, type IrissPavadzimesIndex } from "@/lib/iriss-pavadzimes-types";
import { deleteIrissPavadzime, readIrissPavadzimesCached, runIrissPavadzimesDropboxSync } from "@/lib/iriss-pavadzimes-store";

function rec(id: string, over: Partial<IrissPavadzimeRecord> = {}): IrissPavadzimeRecord {
  return {
    ...emptyIrissPavadzimeRecord(id, "2026-11-01T10:00:00.000Z"),
    number: id.toUpperCase(),
    brandModel: "MB E250",
    plate: "B193-7",
    issuedAt: "2026-11-01T10:00:00.000Z",
    validUntil: "2026-11-02T10:00:00.000Z",
    fileName: `${id.toUpperCase()}.pdf`,
    ...over,
  };
}

describe("tīrā loģika", () => {
  it("noņem TIEŠI vienu ierakstu, pārējie paliek nemainīti; atzīme pēc id, numura un Dropbox id", () => {
    const index: IrissPavadzimesIndex = {
      version: 1,
      updatedAt: "",
      items: [rec("p02801"), rec("p02802", { dropboxId: "id:abc" }), rec("p02803")],
    };
    const frozen = JSON.stringify(index);
    const res = removeWaybillFromIndex(index, "p02802", "Nils", "2026-11-19T10:00:00.000Z");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.removed.id).toBe("p02802");
    expect(res.index.items.map((r) => r.id)).toEqual(["p02801", "p02803"]);
    expect(res.index.items).toEqual([index.items[0], index.items[2]]);
    expect(JSON.stringify(index)).toBe(frozen);
    expect(isWaybillTombstoned(res.index.deleted, { number: "p02802" })).toBe(true);
    expect(isWaybillTombstoned(res.index.deleted, { dropboxId: "id:abc" })).toBe(true);
    expect(isWaybillTombstoned(res.index.deleted, { id: "p02801", number: "P02801" })).toBe(false);
    expect(removeWaybillFromIndex(index, "p09999", "Nils", "")).toEqual({ ok: false, reason: "not_found" });
  });

  it("derīgu pavadzīmi dzēst nevar; beigušos, pārtrauktu vai arhīvā - var", () => {
    const now = Date.parse("2026-11-01T12:00:00.000Z");
    expect(waybillDeleteBlocked(rec("p1"), "active", now)).toBe(true);
    expect(waybillDeleteBlocked(rec("p1"), "interrupted", now)).toBe(false);
    expect(waybillDeleteBlocked(rec("p1", { archived: true }), "active", now)).toBe(false);
    expect(waybillDeleteBlocked(rec("p1", { validUntil: "2026-11-01T11:00:00.000Z" }), "expired", now)).toBe(false);
  });

  it("apstiprinājuma jautājums", () => {
    expect(waybillDeleteConfirmText(rec("p02812"))).toBe("Vai tiešām dzēst P02812 (MB E250)?");
    expect(waybillDeleteConfirmText(rec("x", { number: "", brandModel: "" }))).toBe("Vai tiešām dzēst X.pdf?");
  });
});

const dbx = vi.hoisted(() => ({ files: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/pdf-text-extract-server", () => ({ extractPdfTextOnServer: async () => "" }));
vi.mock("@/lib/iriss-pavadzimes-dropbox", () => ({
  isDropboxConfigured: () => true,
  listDropboxPavadzimes: async () => ({ ok: true, files: dbx.files }),
  downloadDropboxFile: async () => Buffer.from("%PDF-1.4 dropbox"),
}));

describe("krātuve (diskā): dzēš tikai izvēlēto, PDF līdzi, sinhronizācija neatjauno", () => {
  let dir = "";
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "pavadz-del-"));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const store = path.join(dir, ".data/iriss-pavadzimes");
    await fs.mkdir(path.join(store, "pdf"), { recursive: true });
    const items = [
      rec("p02801", { blobPath: ".data/iriss-pavadzimes/pdf/p02801.pdf", source: "upload" }),
      rec("p02802", {
        blobPath: ".data/iriss-pavadzimes/pdf/p02802.pdf",
        source: "dropbox",
        dropboxId: "id:b2",
        dropboxPath: "/Pavadzīmes_IRISS/P02802_MB_E250_B193-7.pdf",
        dropboxContentHash: "h2",
      }),
    ];
    await fs.writeFile(path.join(store, "index.json"), JSON.stringify({ version: 1, updatedAt: "", items }));
    await fs.writeFile(path.join(store, "pdf/p02801.pdf"), "%PDF one");
    await fs.writeFile(path.join(store, "pdf/p02802.pdf"), "%PDF two");
    dbx.files = [
      {
        id: "id:b2",
        name: "P02802_MB_E250_B193-7.pdf",
        path: "/Pavadzīmes_IRISS/P02802_MB_E250_B193-7.pdf",
        rev: "r2",
        contentHash: "h2",
        archived: false,
      },
    ];
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("admins dzēš vienu: indeksā paliek otrs, PDF tikai dzēstajam, rezerves kopija; Dropbox sync to neatjauno", async () => {
    const res = await deleteIrissPavadzime("p02802", "Nils");
    expect(res).toMatchObject({ ok: true, removed: { id: "p02802" } });
    expect((await readIrissPavadzimesCached()).map((r) => r.id)).toEqual(["p02801"]);
    const store = path.join(dir, ".data/iriss-pavadzimes");
    await expect(fs.access(path.join(store, "pdf/p02802.pdf"))).rejects.toThrow();
    expect(await fs.readFile(path.join(store, "pdf/p02801.pdf"), "utf8")).toBe("%PDF one");
    expect((await fs.readdir(store)).some((f) => f.startsWith("index.backup-"))).toBe(true);

    const synced = await runIrissPavadzimesDropboxSync();
    expect(synced.rows.map((r) => r.id)).toEqual(["p02801"]);
    expect((await readIrissPavadzimesCached()).map((r) => r.id)).toEqual(["p02801"]);
    expect(await deleteIrissPavadzime("p02802", "Nils")).toEqual({ ok: false, reason: "not_found" });
  });
});

const route = vi.hoisted(() => ({
  actor: null as null | { kind: "admin"; name: string } | { kind: "staff"; user: { id: string; name: string; sections: string[] } },
  record: null as null | Record<string, unknown>,
  deleted: [] as string[],
}));

vi.mock("@/lib/staff-auth", () => ({
  requireAdminOnlyApi: async () => {
    const a = route.actor;
    if (!a) return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
    if (a.kind !== "admin") return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    return { ok: true, actor: a };
  },
  requireIrissSectionApi: async () => ({ ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) }),
}));
vi.mock("@/lib/iriss-waybill-csdd-plates-store", () => ({ readCsddPlatesDocSafe: async () => null }));
vi.mock("@/lib/admin-change-history-store", () => ({ recordAdminChangeHistory: async () => undefined }));
vi.mock("@/lib/iriss-aivars-wake", () => ({ wakeAivars: async () => undefined }));
vi.mock("@/lib/iriss-waybill-requests-store", () => ({
  queueWaybillStop: async () => {
    throw new Error("CSDD must not be touched");
  },
  readWaybillRequestsDoc: async () => ({ version: 1, updatedAt: "", requests: [], events: [] }),
}));

describe("DELETE /api/admin/iriss-pavadzimes/[id]", () => {
  async function del(id: string) {
    vi.resetModules();
    vi.doMock("@/lib/iriss-pavadzimes-store", () => ({
      getIrissPavadzime: async (want: string) => (route.record && route.record.id === want ? route.record : null),
      deleteIrissPavadzime: async (want: string) => {
        route.deleted.push(want);
        return { ok: true, removed: route.record };
      },
    }));
    const { DELETE } = await import("@/app/api/admin/iriss-pavadzimes/[id]/route");
    return DELETE(new Request(`https://www.provin.lv/api/admin/iriss-pavadzimes/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });
  }

  beforeEach(() => {
    route.deleted = [];
    route.record = rec("p02790", { validUntil: "2026-10-01T10:00:00.000Z" });
  });

  it("administrators dzēš tieši izvēlēto", async () => {
    route.actor = { kind: "admin", name: "Nils" };
    const res = await del("p02790");
    expect(res.status).toBe(200);
    expect(route.deleted).toEqual(["p02790"]);
  });

  it("darbinieks (arī ar Pavadzīmēm) un partneris - 403, nekas netiek dzēsts; bez sesijas - 401", async () => {
    route.actor = { kind: "staff", user: { id: "usr_toms", name: "Toms", sections: ["pavadzimes", "pasutijumi"] } };
    expect((await del("p02790")).status).toBe(403);
    route.actor = { kind: "staff", user: { id: "usr_p", name: "Partneris", sections: ["pavadzimes"] } };
    expect((await del("p02790")).status).toBe(403);
    route.actor = null;
    expect((await del("p02790")).status).toBe(401);
    expect(route.deleted).toEqual([]);
  });

  it("derīgu pavadzīmi nedzēš (409); nezināmu - 404", async () => {
    route.actor = { kind: "admin", name: "Nils" };
    route.record = rec("p02899", { validUntil: new Date(Date.now() + 3_600_000).toISOString() });
    expect((await del("p02899")).status).toBe(409);
    expect((await del("p00000")).status).toBe(404);
    expect(route.deleted).toEqual([]);
  });
});
