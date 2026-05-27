import { describe, expect, it } from "vitest";
import {
  coalesceOrderWorkspacePersistBody,
  isRegressiveWorkspacePersist,
  mergeWorkspaceHydrationBodies,
  pickOrderWorkspaceHydrationServerFirst,
  workspaceHydrationFillScore,
  type OrderWorkspacePersistBody,
} from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";

function bodyWithAutodnaComment(comment: string): OrderWorkspacePersistBody {
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

describe("coalesceOrderWorkspacePersistBody", () => {
  it("keeps populated autodna when incoming patch only updates citi_avoti", () => {
    const baseline = bodyWithAutodnaComment("Saglabāts AutoDNA teksts");
    const incoming = createDefaultSourceBlocks();
    incoming.citi_avoti.sections[0]!.comments = "Jauns citi avoti";
    const merged = coalesceOrderWorkspacePersistBody(
      { ...baseline, sourceBlocks: incoming },
      baseline,
    );
    expect(merged.sourceBlocks.autodna.comments).toContain("AutoDNA");
    expect(merged.sourceBlocks.citi_avoti.sections[0]?.comments).toContain("citi avoti");
  });

  it("coalesce preserves baseline when incoming autodna comment is empty", () => {
    const baseline = bodyWithAutodnaComment("Pilns komentārs ar saturu");
    const empty = bodyWithAutodnaComment("");
    const coalesced = coalesceOrderWorkspacePersistBody(empty, baseline);
    expect(coalesced.sourceBlocks.autodna.comments).toContain("Pilns");
    expect(isRegressiveWorkspacePersist(coalesced, baseline)).toBe(false);
  });
});

describe("pickOrderWorkspaceHydrationServerFirst", () => {
  it("merges server and local blocks instead of dropping server autodna", () => {
    const serverBody = bodyWithAutodnaComment("Servera AutoDNA");
    const localBlocks = createDefaultSourceBlocks();
    localBlocks.ltab.comments = "Lokālais LTAB";
    const localBody: OrderWorkspacePersistBody = {
      ...bodyWithAutodnaComment(""),
      sourceBlocks: localBlocks,
    };

    type H = typeof serverBody & { pdfVisibility?: object; pdfBannerInclude?: object };
    const toHydrated = (b: OrderWorkspacePersistBody): H => ({
      ...b,
      pdfVisibility: {},
      pdfBannerInclude: {},
    });

    const picked = pickOrderWorkspaceHydrationServerFirst<H>(
      [
        {
          source: "server",
          data: toHydrated(serverBody),
          savedAtMs: Date.parse("2026-01-01T00:00:00.000Z"),
          fillScore: workspaceHydrationFillScore(serverBody),
        },
        {
          source: "local",
          data: toHydrated(localBody),
          savedAtMs: Date.parse("2026-01-02T00:00:00.000Z"),
          fillScore: workspaceHydrationFillScore(localBody),
        },
      ],
      {
        source: "local",
        data: toHydrated(localBody),
        savedAtMs: Date.parse("2026-01-02T00:00:00.000Z"),
        fillScore: workspaceHydrationFillScore(localBody),
      },
    );

    expect(picked).not.toBeNull();
    expect(picked!.data.sourceBlocks.autodna.comments).toContain("Servera AutoDNA");
    expect(picked!.data.sourceBlocks.ltab.comments).toContain("Lokālais LTAB");
  });

  it("marks local as source when local savedAt is newer with substantive edits", () => {
    const serverBody = bodyWithAutodnaComment("Vecs servera teksts");
    const localBody = bodyWithAutodnaComment("Jauns lokālais teksts garāks");
    type H = typeof serverBody & { pdfVisibility?: object; pdfBannerInclude?: object };
    const toHydrated = (b: OrderWorkspacePersistBody): H => ({
      ...b,
      pdfVisibility: {},
      pdfBannerInclude: {},
    });
    const picked = pickOrderWorkspaceHydrationServerFirst(
      [
        {
          source: "server",
          data: toHydrated(serverBody),
          savedAtMs: Date.parse("2026-01-01T00:00:00.000Z"),
          fillScore: workspaceHydrationFillScore(serverBody),
        },
      ],
      {
        source: "local",
        data: toHydrated(localBody),
        savedAtMs: Date.parse("2026-01-05T00:00:00.000Z"),
        fillScore: workspaceHydrationFillScore(localBody),
      },
    );
    expect(picked?.source).toBe("local");
    expect(picked?.data.sourceBlocks.autodna.comments).toContain("Jauns lokālais");
  });
});

describe("mergeWorkspaceHydrationBodies", () => {
  it("never replaces populated rows with only empty defaults from partial import", () => {
    const a = bodyWithAutodnaComment("A");
    const b = bodyWithAutodnaComment("B");
    const merged = mergeWorkspaceHydrationBodies([a, b]);
    expect(merged.sourceBlocks.autodna.comments.length).toBeGreaterThan(0);
  });
});
