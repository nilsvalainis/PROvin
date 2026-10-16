import { describe, expect, it, vi } from "vitest";
import {
  createDefaultSourceBlocks,
  emptyCsddFields,
  emptyVendorAvotuBlock,
} from "@/lib/admin-source-blocks";
import { coalesceOrderWorkspacePersistBody, type OrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { mergeProvinBannerPdfInclude } from "@/lib/provin-alert-banners";
import { persistWorkspaceState } from "@/lib/admin-workspace-persist-client";
import {
  overlayBulkyRawTextFields,
  slimUnknownForServerPersist,
  slimWorkspaceDraftForServerPersist,
  workspaceJsonBytes,
  WORKSPACE_PERSIST_JSON_SOFT_MAX_BYTES,
} from "@/lib/admin-workspace-persist-slim";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";

function persistBody(partial: Partial<OrderWorkspacePersistBody> & { sourceBlocks: OrderWorkspacePersistBody["sourceBlocks"] }): OrderWorkspacePersistBody {
  return {
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
    vehicleAiExtraction: null,
    vehicleAiExtractionMeta: null,
    ...partial,
  };
}

describe("slimWorkspaceDraftForServerPersist", () => {
  it("strips AI context and raw reports but keeps comments and tables", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments: "Klienta AutoDNA komentārs",
      aiContextRaw: "A".repeat(80_000),
      mileagePasteRaw: "B".repeat(80_000),
      serviceHistory: [{ date: "2024-01-01", odometer: "120000", country: "LV" }],
    };
    blocks.csdd = { ...emptyCsddFields(), comments: "CSDD piezīme", rawUnprocessedData: "C".repeat(200_000) };
    blocks.listing_analysis = {
      ...blocks.listing_analysis,
      listingPasteRaw: "D".repeat(50_000),
      listingSalesContext: "Pārdošanas konteksts",
      aiContextRaw: "E".repeat(20_000),
    };
    const draft: OrderDraftWorkspaceBody = {
      sourceBlocks: blocks,
      iriss: "Kopsavilkums",
      apskatesPlāns: "Apskate",
      tehniskoRiskuAnalize: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
      vehicleAiExtraction: null,
      vehicleAiExtractionMeta: null,
    };

    const slim = slimWorkspaceDraftForServerPersist(draft);
    const autodna = slim.sourceBlocks as ReturnType<typeof createDefaultSourceBlocks>;
    expect(autodna.autodna.comments).toBe("Klienta AutoDNA komentārs");
    expect(autodna.autodna.aiContextRaw).toBe("");
    expect(autodna.autodna.mileagePasteRaw).toBe("");
    expect(autodna.autodna.serviceHistory[0]?.odometer).toBe("120000");
    expect(autodna.csdd.comments).toBe("CSDD piezīme");
    expect(autodna.csdd.rawUnprocessedData).toBe("");
    expect(autodna.listing_analysis.listingSalesContext).toBe("Pārdošanas konteksts");
    expect(autodna.listing_analysis.listingPasteRaw).toBe("");
    expect(autodna.listing_analysis.aiContextRaw).toBe("");
    expect(slim.iriss).toBe("Kopsavilkums");

    const fullBytes = workspaceJsonBytes(draft);
    const slimBytes = workspaceJsonBytes(slim);
    expect(fullBytes).toBeGreaterThan(400_000);
    expect(slimBytes).toBeLessThan(8_000);
    expect(slimBytes).toBeLessThan(WORKSPACE_PERSIST_JSON_SOFT_MAX_BYTES);
  });

  it("clears bulky keys on nested citi avoti sections", () => {
    const slimed = slimUnknownForServerPersist({
      sections: [{ comments: "OK", aiContextRaw: "huge", rawUnprocessedData: "raw" }],
    }) as { sections: Array<{ comments: string; aiContextRaw: string; rawUnprocessedData: string }> };
    expect(slimed.sections[0]?.comments).toBe("OK");
    expect(slimed.sections[0]?.aiContextRaw).toBe("");
    expect(slimed.sections[0]?.rawUnprocessedData).toBe("");
  });
});

describe("overlayBulkyRawTextFields + coalesce", () => {
  it("keeps baseline AI context when slim incoming only adds comments", () => {
    const baselineBlocks = createDefaultSourceBlocks();
    baselineBlocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments: "Vecais komentārs",
      aiContextRaw: "Pilns AutoDNA raw AI",
      mileagePasteRaw: "Nobraukuma paste",
    };
    const incomingBlocks = createDefaultSourceBlocks();
    incomingBlocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments: "Jaunais klienta komentārs",
      aiContextRaw: "",
      mileagePasteRaw: "",
    };

    const merged = coalesceOrderWorkspacePersistBody(
      persistBody({ sourceBlocks: incomingBlocks }),
      persistBody({ sourceBlocks: baselineBlocks }),
    );
    expect(merged.sourceBlocks.autodna.comments).toBe("Jaunais klienta komentārs");
    expect(merged.sourceBlocks.autodna.aiContextRaw).toBe("Pilns AutoDNA raw AI");
    expect(merged.sourceBlocks.autodna.mileagePasteRaw).toBe("Nobraukuma paste");
  });

  it("does not restore bulky fields after an explicit source wipe", () => {
    const baselineBlocks = createDefaultSourceBlocks();
    baselineBlocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments: "Bija",
      aiContextRaw: "Vecais AI",
    };
    const incomingBlocks = createDefaultSourceBlocks();
    const merged = coalesceOrderWorkspacePersistBody(
      persistBody({ sourceBlocks: incomingBlocks, sourceBlockWipes: ["autodna"] }),
      persistBody({ sourceBlocks: baselineBlocks }),
    );
    expect(merged.sourceBlocks.autodna.comments).toBe("");
    expect(merged.sourceBlocks.autodna.aiContextRaw).toBe("");
  });

  it("picks incoming bulky text when the operator actually sent a new value", () => {
    const picked = overlayBulkyRawTextFields(
      { aiContextRaw: "jauns" },
      { aiContextRaw: "vecs" },
      { aiContextRaw: "jauns", comments: "ok" },
    ) as { aiContextRaw: string; comments: string };
    expect(picked.aiContextRaw).toBe("jauns");
    expect(picked.comments).toBe("ok");
  });
});

describe("persistWorkspaceState slim wire payload", () => {
  it("does not send AutoDNA AI context or CSDD raw in the PATCH body", async () => {
    const blocks = createDefaultSourceBlocks();
    blocks.autodna = {
      ...emptyVendorAvotuBlock(),
      comments: "Saglabājamais komentārs",
      aiContextRaw: "X".repeat(90_000),
      mileagePasteRaw: "Y".repeat(90_000),
    };
    blocks.csdd = { ...emptyCsddFields(), comments: "CSDD ok", rawUnprocessedData: "Z".repeat(180_000) };

    let sent = "";
    const fetchMock = vi.fn(async (_url: string, init?: { body?: string }) => {
      sent = typeof init?.body === "string" ? init.body : "";
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          updatedAt: "2026-10-16T21:20:00.000Z",
          durable: true,
          storageBackend: "blob",
          workspaceRevision: 3,
          workspaceChecksum: "slim",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await persistWorkspaceState({
        sessionId: "cs_live_a1AUo9OoQcQ5YMLJjRRwTJ0rz8R9sSL5Yb29mszeQgTvkOSNXkjKhrkA2x",
        body: persistBody({ sourceBlocks: blocks, iriss: "IRISS" }),
        baseline: null,
        pdfVisibility: mergePdfVisibility(undefined),
        pdfBannerInclude: mergeProvinBannerPdfInclude(undefined),
        expectedWorkspaceRevision: 2,
        logContext: "manual_save",
      });
      expect(result.ok).toBe(true);
      expect(sent.length).toBeLessThan(40_000);
      const parsed = JSON.parse(sent) as {
        workspace: {
          sourceBlocks: ReturnType<typeof createDefaultSourceBlocks>;
          iriss: string;
        };
      };
      expect(parsed.workspace.iriss).toBe("IRISS");
      expect(parsed.workspace.sourceBlocks.autodna.comments).toBe("Saglabājamais komentārs");
      expect(parsed.workspace.sourceBlocks.autodna.aiContextRaw).toBe("");
      expect(parsed.workspace.sourceBlocks.autodna.mileagePasteRaw).toBe("");
      expect(parsed.workspace.sourceBlocks.csdd.comments).toBe("CSDD ok");
      expect(parsed.workspace.sourceBlocks.csdd.rawUnprocessedData).toBe("");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
