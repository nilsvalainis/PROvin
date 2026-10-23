import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generate = vi.fn();
vi.mock("@/lib/admin-ai-dispatch", () => ({
  adminGenerateExpertText: (opts: unknown) => generate(opts),
}));
vi.mock("@/lib/admin-ai-order-context", () => ({
  buildAiCommentGenerationContext: async () => "KONTEKSTS",
}));

import { generateListingFieldCommentWithAi } from "@/lib/admin-ai-listing-field";
import {
  LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT,
  LISTING_PHOTO_NO_DEFECTS_TEXT,
  applyListingPhotoNoDefectsTemplate,
} from "@/lib/admin-listing-photo-comment-presets";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";

function input(photoAnalysis: string) {
  const sourceBlocks = createDefaultSourceBlocks();
  sourceBlocks.listing_analysis = { ...sourceBlocks.listing_analysis, photoAnalysis };
  return { sessionId: "cs_test", sourceBlocks, field: "photoAnalysis" as const };
}

describe("✨ foto lauks ar operatora atzīmi „Nav vizuālo defektu”", () => {
  beforeEach(() => generate.mockReset());

  it("atgriež tieši Nila tekstu un modeli neizsauc", async () => {
    const out = await generateListingFieldCommentWithAi(input(applyListingPhotoNoDefectsTemplate("")) as never);
    expect(out).toBe(
      "Virspusēji izvērtējot sludinājuma fotogrāfijas, būtiski vizuālie defekti netika novēroti. Redzamas tikai deklarētajam vecumam un nobraukumam pieļaujamas lietošanas pazīmes.",
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("vecais pogas teksts laukā arī skaitās kā atzīme", async () => {
    const out = await generateListingFieldCommentWithAi(input(LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT) as never);
    expect(out).toBe(LISTING_PHOTO_NO_DEFECTS_TEXT);
    expect(generate).not.toHaveBeenCalled();
  });

  it("bez atzīmes modeli izsauc kā līdz šim", async () => {
    generate.mockResolvedValue("Fotogrāfijās redzams skrāpējums aizmugurējā bamperī.");
    const out = await generateListingFieldCommentWithAi(input("") as never);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out).toMatch(/skrāpējums/);
  });
});
