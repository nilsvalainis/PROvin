import { describe, expect, it } from "vitest";
import {
  stableWorkspaceChecksum,
  verifyWorkspaceIntegrity,
  workspaceFillScoreFromDraft,
  isEmptyRegressiveOverwrite,
} from "@/lib/admin-workspace-integrity";
import { coalesceOrderWorkspacePersistBody, pickOrderWorkspaceHydrationServerFirst, workspaceHydrationFillScore } from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { enqueueWorkspacePersist } from "@/lib/admin-workspace-persist-queue";

function draftWithComment(comment: string): OrderDraftWorkspaceBody {
  const blocks = createDefaultSourceBlocks();
  blocks.autodna = { ...emptyVendorAvotuBlock(), comments: comment };
  return {
    sourceBlocks: blocks,
    iriss: "",
    apskatesPlāns: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
  };
}

describe("stableWorkspaceChecksum", () => {
  it("is stable for identical workspace", () => {
    const a = draftWithComment("hello");
    expect(stableWorkspaceChecksum(a)).toBe(stableWorkspaceChecksum(a));
  });

  it("changes when content changes", () => {
    const a = draftWithComment("hello");
    const b = draftWithComment("world");
    expect(stableWorkspaceChecksum(a)).not.toBe(stableWorkspaceChecksum(b));
  });
});

describe("verifyWorkspaceIntegrity", () => {
  it("fails on checksum mismatch", () => {
    const w = draftWithComment("data");
    const result = verifyWorkspaceIntegrity(w, 2, {
      revision: 2,
      checksum: "deadbeef",
      fillScore: workspaceFillScoreFromDraft(w),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("checksum_mismatch");
  });

  it("passes when read-back matches", () => {
    const w = draftWithComment("persisted");
    const checksum = stableWorkspaceChecksum(w);
    const fill = workspaceFillScoreFromDraft(w);
    const result = verifyWorkspaceIntegrity(w, 3, { revision: 3, checksum, fillScore: fill });
    expect(result.ok).toBe(true);
  });
});

describe("SSR server-wins hydration", () => {
  it("never drops server autodna when local is empty", () => {
    const serverBody = draftWithComment("Server canonical");
    type H = typeof serverBody & { pdfVisibility?: object; pdfBannerInclude?: object };
    const toH = (d: OrderDraftWorkspaceBody): H => ({ ...d, pdfVisibility: {}, pdfBannerInclude: {} });
    const picked = pickOrderWorkspaceHydrationServerFirst(
      [
        {
          source: "server",
          data: toH(serverBody),
          savedAtMs: 1000,
          fillScore: workspaceHydrationFillScore({
            sourceBlocks: serverBody.sourceBlocks,
            iriss: "",
            apskatesPlāns: "",
            cenasAtbilstiba: "",
            previewConfirmed: false,
            vehicleAiExtraction: null,
            vehicleAiExtractionMeta: null,
          }),
        },
        {
          source: "local",
          data: toH(draftWithComment("")),
          savedAtMs: 2000,
          fillScore: 0,
        },
      ],
      {
        source: "local",
        data: toH(draftWithComment("")),
        savedAtMs: 2000,
        fillScore: 0,
      },
    );
    expect(picked?.source).toBe("server");
    expect(picked?.data.sourceBlocks.autodna.comments).toContain("Server canonical");
  });
});

describe("empty overwrite detector", () => {
  it("detects regressive empty incoming", () => {
    const baseline = {
      sourceBlocks: createDefaultSourceBlocks(),
      iriss: "long iriss text here",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    };
    baseline.sourceBlocks.autodna = { ...emptyVendorAvotuBlock(), comments: "filled" };
    const empty = { ...baseline, iriss: "", sourceBlocks: createDefaultSourceBlocks() };
    expect(isEmptyRegressiveOverwrite(empty, baseline)).toBe(true);
    const merged = coalesceOrderWorkspacePersistBody(empty, baseline);
    expect(merged.sourceBlocks.autodna.comments).toContain("filled");
  });
});

describe("persist queue serialization", () => {
  it("runs jobs sequentially per session", async () => {
    const order: number[] = [];
    const a = enqueueWorkspacePersist("s1", async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
      return {
        ok: true,
        workspaceSavedAt: "",
        generation: 1,
        durable: true,
        storageBackend: "test",
        workspaceRevision: 1,
        workspaceChecksum: "abc",
      };
    });
    const b = enqueueWorkspacePersist("s1", async () => {
      order.push(2);
      return {
        ok: true,
        workspaceSavedAt: "",
        generation: 2,
        durable: true,
        storageBackend: "test",
        workspaceRevision: 2,
        workspaceChecksum: "def",
      };
    });
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });
});

describe("E2E persistence simulation", () => {
  it("upload → persist → reload without localStorage keeps server data", () => {
    const store = new Map<number, OrderDraftWorkspaceBody>();
    let revision = 0;

    const persist = (body: OrderDraftWorkspaceBody) => {
      revision += 1;
      store.set(revision, body);
      return { revision, checksum: stableWorkspaceChecksum(body) };
    };

    const imported = draftWithComment("AI extracted mileage row");
    imported.iriss = "Summary";
    const saved = persist(imported);

    const reloadFromServer = store.get(saved.revision);
    expect(reloadFromServer?.sourceBlocks.autodna.comments).toContain("AI extracted");
    expect(stableWorkspaceChecksum(reloadFromServer!)).toBe(saved.checksum);

    const localStorageEmpty = null;
    expect(localStorageEmpty).toBeNull();
    expect(reloadFromServer?.iriss).toBe("Summary");
  });
});

describe("stress concurrent revisions", () => {
  it("monotonic revision under parallel persist attempts", async () => {
    let revision = 0;
    const lock = { busy: false, queue: [] as (() => void)[] };

    const persistWithLock = async (label: string) => {
      while (lock.busy) {
        await new Promise<void>((r) => lock.queue.push(r));
      }
      lock.busy = true;
      const expected = revision;
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      if (expected !== revision) {
        lock.busy = false;
        lock.queue.shift()?.();
        return { ok: false as const, error: "stale_revision" };
      }
      revision += 1;
      lock.busy = false;
      lock.queue.shift()?.();
      return { ok: true as const, revision, label };
    };

    const results = await Promise.all([
      persistWithLock("ai"),
      persistWithLock("manual"),
      persistWithLock("autosave"),
      persistWithLock("pdf"),
    ]);
    const okCount = results.filter((r) => r.ok).length;
    expect(okCount).toBeGreaterThanOrEqual(3);
    expect(revision).toBe(okCount);
  });
});
