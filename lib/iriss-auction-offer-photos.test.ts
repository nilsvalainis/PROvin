import { describe, expect, it } from "vitest";
import { attachmentsFromAuctionPhotoUrls, auctionPhotoUrlsFromHit } from "@/lib/iriss-auction-offer-photos";
import { IRISS_MAX_OFFER_ATTACHMENTS } from "@/lib/iriss-pasutijumi-types";

describe("auction offer photos", () => {
  it("dedupes imageUrl against imageUrls and keeps https only", () => {
    expect(
      auctionPhotoUrlsFromHit({
        imageUrl: "https://img.example/a.jpg",
        imageUrls: ["https://img.example/a.jpg", "https://img.example/b.jpg", "ftp://x/c.jpg", ""],
      }),
    ).toEqual(["https://img.example/a.jpg", "https://img.example/b.jpg"]);
  });

  it("appends blobUrl attachments without exceeding 60 and without duplicating existing urls", () => {
    const existing = attachmentsFromAuctionPhotoUrls(["https://img.example/a.jpg"]);
    const next = attachmentsFromAuctionPhotoUrls(
      ["https://img.example/a.jpg", "https://img.example/c.jpg"],
      existing,
    );
    expect(next).toHaveLength(2);
    expect(next[1]?.blobUrl).toBe("https://img.example/c.jpg");
    expect(next[1]?.dataUrl).toBe("");
    const many = attachmentsFromAuctionPhotoUrls(
      Array.from({ length: 80 }, (_, i) => `https://img.example/${i}.jpg`),
    );
    expect(many).toHaveLength(IRISS_MAX_OFFER_ATTACHMENTS);
  });
});
