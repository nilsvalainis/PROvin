import { describe, expect, it } from "vitest";
import { listingDisplayImageUrl, listingImageHostnameAllowed, shrinkListingImageUrl } from "@/lib/iriss-listing-image";

describe("listing display images", () => {
  it("keeps an existing thumb field for list sizes", () => {
    expect(
      listingDisplayImageUrl({
        url: "https://img-pa.auto1.com/img/full.jpg?width=1600",
        thumbUrl: "https://img-pa.auto1.com/img/thumb.jpg",
        maxWidth: 480,
      }),
    ).toBe("https://img-pa.auto1.com/img/thumb.jpg");
  });

  it("shrinks width query, imagecache and pixel filenames when no thumb exists", () => {
    expect(shrinkListingImageUrl("https://img-pa.auto1.com/img/a.jpg?width=1600", 480)).toBe(
      "https://img-pa.auto1.com/img/a.jpg?width=480",
    );
    expect(shrinkListingImageUrl("https://cdn.autobid.de/imagecache/l/a.jpg", 320)).toBe(
      "https://cdn.autobid.de/imagecache/s/a.jpg",
    );
    expect(shrinkListingImageUrl("https://images.openlane.eu/car/1600x1200/a.jpg", 480)).toBe(
      "https://images.openlane.eu/car/480x360/a.jpg",
    );
    expect(shrinkListingImageUrl("https://img-pa.auto1.com/img/a.jpg?width=200", 480)).toBe(
      "https://img-pa.auto1.com/img/a.jpg?width=200",
    );
  });

  it("does not rewrite data urls and only opts known hosts into next/image", () => {
    expect(shrinkListingImageUrl("data:image/jpeg;base64,aaaa", 320)).toBe("data:image/jpeg;base64,aaaa");
    expect(listingImageHostnameAllowed("https://img-pa.auto1.com/a.jpg")).toBe(true);
    expect(listingImageHostnameAllowed("https://images.openlane.eu/a.jpg")).toBe(true);
    expect(listingImageHostnameAllowed("https://evil.example/a.jpg")).toBe(false);
    expect(listingImageHostnameAllowed("data:image/jpeg;base64,aa")).toBe(false);
  });
});
