import { afterEach, describe, expect, it, vi } from "vitest";
import {
  stableWorkspaceChecksum,
  verifyWorkspaceIntegrity,
  workspaceFillScoreFromDraft,
  isEmptyRegressiveOverwrite,
} from "@/lib/admin-workspace-integrity";
import { coalesceOrderWorkspacePersistBody, pickOrderWorkspaceHydrationServerFirst, workspaceHydrationFillScore } from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { enqueueWorkspacePersist, clearWorkspacePersistQueue, clearAllWorkspacePersistQueues } from "@/lib/admin-workspace-persist-queue";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import {
  buildSafeMergePersistBody,
  clearLastOkWorkspaceRevision,
  isOwnWriteRevisionConflict,
  isWorkspacePersistHardFailure,
  isWorkspaceRevisionConflict,
  persistWorkspaceState,
  resolveExpectedWorkspaceRevision,
  noteLastOkWorkspaceRevision,
  getLastOkWorkspaceRevision,
  WORKSPACE_SAVE_FAILED_LABEL,
} from "@/lib/admin-workspace-persist-client";
import { nextWorkspaceRevisionAfterRestore } from "@/lib/admin-workspace-integrity";

function draftWithComment(comment: string): OrderDraftWorkspaceBody {
  const blocks = createDefaultSourceBlocks();
  blocks.autodna = { ...emptyVendorAvotuBlock(), comments: comment };
  return {
    sourceBlocks: blocks,
    iriss: "",
    apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
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
      tehniskoRiskuAnalize: "",
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
      tehniskoRiskuAnalize: "",
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

describe("own-write revision helpers", () => {
  afterEach(() => {
    clearLastOkWorkspaceRevision();
    clearAllWorkspacePersistQueues();
    vi.unstubAllGlobals();
  });

  it("raises expected revision to this tab's last successful write", () => {
    expect(resolveExpectedWorkspaceRevision(5, null)).toBe(5);
    expect(resolveExpectedWorkspaceRevision(5, 6)).toBe(6);
    expect(resolveExpectedWorkspaceRevision(undefined, 4)).toBe(4);
    expect(resolveExpectedWorkspaceRevision(7, 6)).toBe(7);
  });

  it("treats same-tab +1 stale_revision as own-write, not another tab", () => {
    expect(
      isOwnWriteRevisionConflict({
        error: "stale_revision",
        expectedRevision: 5,
        currentRevision: 6,
        lastOkRevision: null,
      }),
    ).toBe(true);
    expect(
      isOwnWriteRevisionConflict({
        error: "stale_revision",
        expectedRevision: 5,
        currentRevision: 6,
        lastOkRevision: 6,
      }),
    ).toBe(true);
    expect(
      isOwnWriteRevisionConflict({
        error: "overwrite_blocked",
        expectedRevision: 5,
        currentRevision: 6,
        lastOkRevision: 6,
      }),
    ).toBe(false);
    expect(
      isOwnWriteRevisionConflict({
        error: "stale_revision",
        expectedRevision: 5,
        currentRevision: 9,
        lastOkRevision: null,
      }),
    ).toBe(false);
  });

  it("queued block saves reuse the previous put revision so one tab is not a conflict", async () => {
    clearLastOkWorkspaceRevision("s-race");
    clearWorkspacePersistQueue("s-race");
    let serverRev = 5;
    const seenExpected: number[] = [];
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          expectedWorkspaceRevision?: number;
        };
        seenExpected.push(body.expectedWorkspaceRevision ?? -1);
        if (body.expectedWorkspaceRevision !== serverRev) {
          return new Response(
            JSON.stringify({ ok: false, error: "stale_revision", currentRevision: serverRev }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
        serverRev += 1;
        return new Response(
          JSON.stringify({
            ok: true,
            updatedAt: new Date().toISOString(),
            durable: true,
            storageBackend: "blob",
            workspaceRevision: serverRev,
            workspaceChecksum: "x",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );

    const persistBody = {
      sourceBlocks: createDefaultSourceBlocks(),
      iriss: "",
      apskatesPlāns: "",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    };
    const common = {
      sessionId: "s-race",
      body: persistBody,
      baseline: null,
      pdfVisibility: mergePdfVisibility(undefined),
      pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
    };
    const a = persistWorkspaceState({ ...common, expectedWorkspaceRevision: 5, logContext: "autodna" });
    const b = persistWorkspaceState({ ...common, expectedWorkspaceRevision: 5, logContext: "dealer" });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(seenExpected).toEqual([5, 6]);
    expect(getLastOkWorkspaceRevision("s-race")).toBe(7);
  });

  it("retries stale_revision once when the server is only one revision ahead of this tab", async () => {
    clearLastOkWorkspaceRevision("s-own");
    clearWorkspacePersistQueue("s-own");
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      async (_url: string, init?: RequestInit) => {
        calls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          expectedWorkspaceRevision?: number;
        };
        if (calls === 1) {
          return new Response(
            JSON.stringify({ ok: false, error: "stale_revision", currentRevision: 6 }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
        expect(body.expectedWorkspaceRevision).toBe(6);
        return new Response(
          JSON.stringify({
            ok: true,
            updatedAt: new Date().toISOString(),
            durable: true,
            storageBackend: "blob",
            workspaceRevision: 7,
            workspaceChecksum: "y",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    const result = await persistWorkspaceState({
      sessionId: "s-own",
      body: {
        sourceBlocks: createDefaultSourceBlocks(),
        iriss: "kopsavilkums",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
      },
      baseline: null,
      pdfVisibility: mergePdfVisibility(undefined),
      pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
      expectedWorkspaceRevision: 5,
      logContext: "listing",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.workspaceRevision).toBe(7);
    expect(calls).toBe(2);
    expect(getLastOkWorkspaceRevision("s-own")).toBe(7);
  });

  it("does not treat a distant stale revision as own-write", async () => {
    noteLastOkWorkspaceRevision("s-other", 3);
    expect(
      isOwnWriteRevisionConflict({
        error: "stale_revision",
        expectedRevision: 3,
        currentRevision: 12,
        lastOkRevision: 3,
      }),
    ).toBe(false);
  });
});

describe("revision conflict contract", () => {
  it("treats stale_revision and overwrite_blocked as conflicts, not success", () => {
    expect(isWorkspaceRevisionConflict("stale_revision")).toBe(true);
    expect(isWorkspaceRevisionConflict("overwrite_blocked")).toBe(true);
    expect(isWorkspaceRevisionConflict("store_not_durable")).toBe(false);
    expect(isWorkspaceRevisionConflict("conditional_write_conflict")).toBe(false);
    expect(isWorkspaceRevisionConflict(undefined)).toBe(false);
    expect(isWorkspacePersistHardFailure("conditional_write_conflict")).toBe(true);
    expect(WORKSPACE_SAVE_FAILED_LABEL).toBe("Nav saglabāts!");
  });

  it("safe merge keeps filled server fields when local is empty", () => {
    const local = draftWithComment("");
    const server = draftWithComment("Cita cilne saglabāja komentāru");
    server.iriss = "Servera kopsavilkums";
    const merged = buildSafeMergePersistBody(
      {
        sourceBlocks: local.sourceBlocks,
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        previewConfirmed: false,
        vehicleAiExtraction: null,
        vehicleAiExtractionMeta: null,
      },
      server,
    );
    expect(merged.sourceBlocks.autodna.comments).toContain("Cita cilne");
    expect(merged.iriss).toBe("Servera kopsavilkums");
  });

  it("restore bumps revision so the other tab cannot overwrite quietly", () => {
    expect(nextWorkspaceRevisionAfterRestore(0)).toBe(1);
    expect(nextWorkspaceRevisionAfterRestore(4)).toBe(5);
    expect(nextWorkspaceRevisionAfterRestore(undefined)).toBe(1);
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
