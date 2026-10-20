import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  irissSaveWirePayload,
  irissWireImageBytes,
  mergeServerAttachmentStorage,
} from "@/lib/iriss-pasutijumi-autosave-wire";

const ORDER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-10-17T20:00:00.000Z";
// 1×1 PNG
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("IRISS autosave without images (FS store)", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    rmSync(path.join(process.cwd(), ".data", "iriss-pasutijumi-backups"), { recursive: true, force: true });
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load(dir: string) {
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_MIRROR_DIR", "disabled");
    vi.stubEnv("IRISS_PASUTIJUMI_LOCAL_FULL_BUNDLE", "0");
    vi.resetModules();
    return import("@/lib/iriss-pasutijumi-store");
  }

  it("uploads an added image once; later text autosaves keep it and send no bytes", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-wire-"));
    dirs.push(dir);
    const store = await load(dir);

    const offer = {
      ...emptyIrissOfferRecord("o1", NOW),
      attachments: [{ id: "img1", name: "a.png", mimeType: "image/png", size: 68, dataUrl: PNG }],
    };
    const local0 = { ...emptyIrissPasutijums(ORDER_ID, NOW), brandModel: "Volvo XC90", offers: [offer] };

    // 1) first save: image goes with bytes
    expect(irissWireImageBytes(irissSaveWirePayload(local0))).toBeGreaterThan(0);
    const first = await store.writeIrissPasutijums(irissSaveWirePayload(local0), { expectedWorkspaceRevision: null });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const storedAtt = first.record.offers[0].attachments[0];
    expect(storedAtt.blobPath).toBeTruthy();
    expect(storedAtt.dataUrl).toBe("");
    const imgFile = path.isAbsolute(storedAtt.blobPath!) ? storedAtt.blobPath! : path.join(dir, storedAtt.blobPath!);
    const imgMtime = statSync(imgFile).mtimeMs;

    // 2) client adopts storage refs, operator edits text
    const local1 = {
      ...mergeServerAttachmentStorage({ ...local0, workspaceRevision: first.record.workspaceRevision }, first.record),
      notes: "Zvanīt pēc 18",
    };
    expect(local1.offers[0].attachments[0].dataUrl).toBe(PNG); // preview stays local
    const wire = irissSaveWirePayload(local1);
    expect(irissWireImageBytes(wire)).toBe(0);

    const second = await store.writeIrissPasutijums(wire, {
      expectedWorkspaceRevision: first.record.workspaceRevision,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.record.notes).toBe("Zvanīt pēc 18");
    expect(second.record.brandModel).toBe("Volvo XC90");
    expect(second.record.offers[0].attachments).toHaveLength(1);
    expect(second.record.offers[0].attachments[0].blobPath).toBe(storedAtt.blobPath);
    expect(statSync(imgFile).mtimeMs).toBe(imgMtime);

    // 3) unchanged autosave is a no-op on disk (no new revision)
    const file = path.join(dir, `${ORDER_ID}.json`);
    const before = readFileSync(file, "utf8");
    const third = await store.writeIrissPasutijums(
      irissSaveWirePayload({ ...local1, workspaceRevision: second.record.workspaceRevision }),
      { expectedWorkspaceRevision: second.record.workspaceRevision },
    );
    expect(third.ok).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("stale revision still returns conflict (409 path) with a slim payload", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-wire-409-"));
    dirs.push(dir);
    const store = await load(dir);
    const base = { ...emptyIrissPasutijums(ORDER_ID, NOW), brandModel: "MB Vito" };
    const a = await store.writeIrissPasutijums(base, { expectedWorkspaceRevision: null });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = await store.writeIrissPasutijums(
      { ...a.record, notes: "cita cilne" },
      { expectedWorkspaceRevision: a.record.workspaceRevision },
    );
    expect(b.ok).toBe(true);
    const stale = await store.writeIrissPasutijums(irissSaveWirePayload({ ...a.record, notes: "vecā cilne" }), {
      expectedWorkspaceRevision: a.record.workspaceRevision,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.stale).toBe(true);
  });

  it("merges a later eCarsTrade deletion with another tab's notes instead of 409", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-wire-merge-"));
    dirs.push(dir);
    const store = await load(dir);
    const etA = "https://ecarstrade.com/search?mark[]=68";
    const etB = "https://ecarstrade.com/search?mark[]=5";
    const base = {
      ...emptyIrissPasutijums(ORDER_ID, NOW),
      brandModel: "Volvo XC60",
      listingLinkEcarstrade: [etA, etB],
    };
    const a = await store.writeIrissPasutijums(base, { expectedWorkspaceRevision: null });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const agent = await store.writeIrissPasutijums(
      { ...a.record, notes: "Aģenta piezīme", fieldUpdatedAt: { notes: 40 } },
      { expectedWorkspaceRevision: a.record.workspaceRevision },
    );
    expect(agent.ok).toBe(true);
    if (!agent.ok) return;
    const nils = await store.writeIrissPasutijums(
      {
        ...a.record,
        listingLinkEcarstrade: [etA],
        ecarstradeLinksManual: true,
        fieldUpdatedAt: { listingLinkEcarstrade: 50 },
      },
      { expectedWorkspaceRevision: a.record.workspaceRevision },
    );
    expect(nils.ok).toBe(true);
    if (!nils.ok) return;
    expect(nils.record.notes).toBe("Aģenta piezīme");
    expect(nils.record.listingLinkEcarstrade).toEqual([etA]);
    expect(nils.record.ecarstradeLinksManual).toBe(true);
  });
});
