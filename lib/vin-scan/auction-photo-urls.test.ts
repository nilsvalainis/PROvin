import { describe, expect, it } from "vitest";

import {
  AUCTION_PHOTO_PER_LOT_MAX,
  collectBestAuctionPhotoUrls,
  normalizeAuctionPhotoId,
  pickBestAuctionPhotoUrl,
  uniqueBestAuctionPhotoUrls,
  upgradeAuctionPhotoUrl,
} from "@/lib/vin-scan/auction-photo-urls";

describe("auction photo URL atlase", () => {
  it("IAAI resizer iet uz 1920, id paliek imageKeys", () => {
    const small = "https://vis.iaai.com/resizer?imageKeys=ABC-1&width=640&height=480";
    const up = upgradeAuctionPhotoUrl(small);
    expect(up).toContain("width=1920");
    expect(normalizeAuctionPhotoId(small)).toBe(normalizeAuctionPhotoId(up));
    expect(normalizeAuctionPhotoId(small)).toBe("iaai:abc-1");
  });

  it("Copart thb/hrs un import-motor ir viens id; uzvar labākā izšķirtspēja", () => {
    const thb = "https://cs.copart.com/v1/thb/lot/1.jpg";
    const hrs = "https://cs.copart.com/v1/hrs/lot/1.jpg";
    const dl = "https://cars2.import-motor.com/copart/vin-1.webp";
    expect(normalizeAuctionPhotoId(thb)).toBe(normalizeAuctionPhotoId(hrs));
    expect(pickBestAuctionPhotoUrl([thb, hrs])).toBe(hrs);
    expect(uniqueBestAuctionPhotoUrls([thb, hrs, dl])).toEqual(
      expect.arrayContaining([hrs, dl]),
    );
    expect(uniqueBestAuctionPhotoUrls([thb, hrs])).toHaveLength(1);
  });

  it("JoJ images: downloaded/big pirms normal; visi >20, bez small ja ir labāki", () => {
    const downloaded = Array.from({ length: 12 }, (_, i) => `https://cars2.import-motor.com/copart/p-${i}.webp`);
    const big = Array.from({ length: 12 }, (_, i) => `https://cs.copart.com/v1/hrs/p-${i}.jpg`);
    const extra = Array.from({ length: 8 }, (_, i) => `https://cs.copart.com/v1/hrs/extra-${i}.jpg`);
    const small = ["https://cs.copart.com/v1/thb/skip.jpg"];
    const { photos } = collectBestAuctionPhotoUrls({
      downloaded,
      big,
      exterior: extra,
      interior: [],
      normal: big,
      small,
    });
    expect(photos.length).toBe(20);
    expect(photos.filter((u) => u.includes("import-motor")).length).toBe(12);
    expect(photos.every((u) => u.includes("import-motor") || u.includes("/hrs/") || u.includes("extra"))).toBe(true);
    expect(photos).not.toContain(small[0]);

    const many = collectBestAuctionPhotoUrls({
      downloaded: Array.from({ length: 30 }, (_, i) => `https://cars2.import-motor.com/copart/all-${i}.webp`),
    });
    expect(many.photos).toHaveLength(30);
    expect(many.photos.length).toBeLessThanOrEqual(AUCTION_PHOTO_PER_LOT_MAX);
  });
});
