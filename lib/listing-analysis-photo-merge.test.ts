import { describe, expect, it } from "vitest";
import { coalesceOrderWorkspacePersistBody, normalizeOrderWorkspacePersistBody } from "@/lib/admin-order-workspace-persist";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

describe("listing analysis photo merge on coalesce", () => {
  it("keeps longer photo list when stale PATCH omits new uploads", () => {
    const base = createDefaultSourceBlocks();
    const baseline = normalizeOrderWorkspacePersistBody({
      sourceBlocks: {
        ...base,
        listing_analysis: {
          ...base.listing_analysis,
          photoAnalysis: "komentārs",
          photos: [{ id: "la_ph_aabbccddeeff001122334455" }],
        },
      },
      iriss: "",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    });
    const incoming = normalizeOrderWorkspacePersistBody({
      sourceBlocks: {
        ...base,
        listing_analysis: {
          ...base.listing_analysis,
          photoAnalysis: "komentārs",
          photos: [],
        },
      },
      iriss: "",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    });
    const merged = coalesceOrderWorkspacePersistBody(incoming, baseline);
    expect(merged.sourceBlocks.listing_analysis.photos).toHaveLength(1);
    expect(merged.sourceBlocks.listing_analysis.photos[0]?.id).toBe("la_ph_aabbccddeeff001122334455");
  });

  it("prefers incoming order when photo count matches (reorder)", () => {
    const base = createDefaultSourceBlocks();
    const idA = "la_ph_aabbccddeeff001122334455";
    const idB = "la_ph_112233445566778899aabbcc";
    const baseline = normalizeOrderWorkspacePersistBody({
      sourceBlocks: {
        ...base,
        listing_analysis: {
          ...base.listing_analysis,
          photos: [{ id: idA }, { id: idB }],
        },
      },
      iriss: "",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    });
    const incoming = normalizeOrderWorkspacePersistBody({
      sourceBlocks: {
        ...base,
        listing_analysis: {
          ...base.listing_analysis,
          photos: [{ id: idB }, { id: idA }],
        },
      },
      iriss: "",
      apskatesPlāns: "",
      cenasAtbilstiba: "",
      previewConfirmed: false,
    });
    const merged = coalesceOrderWorkspacePersistBody(incoming, baseline);
    expect(merged.sourceBlocks.listing_analysis.photos.map((p) => p.id)).toEqual([idB, idA]);
  });
});
