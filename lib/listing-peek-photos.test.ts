import { describe, expect, it } from "vitest";
import {
  LISTING_PEEK_MAX_PHOTOS,
  isSafeListingPeekId,
  listingPeekPhotoCid,
  parseListingPeekPhotos,
} from "@/lib/listing-peek-photos";

const id = "11111111-1111-4111-8111-111111111111";

describe("parseListingPeekPhotos", () => {
  it("patur derīgus id un atmet dublikātus un ceļa mēģinājumus", () => {
    expect(
      parseListingPeekPhotos([
        { id },
        { id: id.toUpperCase() },
        { id: "../etc/passwd" },
        "nav-uuid",
        id,
      ]),
    ).toEqual([{ id }]);
    expect(isSafeListingPeekId(id)).toBe(true);
    expect(isSafeListingPeekId("../x")).toBe(false);
  });

  it("apstājas pie maksimuma", () => {
    const photos = Array.from({ length: LISTING_PEEK_MAX_PHOTOS + 2 }, (_, i) => ({
      id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
    }));
    expect(parseListingPeekPhotos(photos)).toHaveLength(LISTING_PEEK_MAX_PHOTOS);
  });

  it("veido stabilu pasta satura id", () => {
    expect(listingPeekPhotoCid(id)).toBe(`peek-photo-${id}@provin.lv`);
  });
});
