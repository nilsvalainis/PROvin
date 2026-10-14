import { describe, expect, it } from "vitest";

import {
  ccVinHasVinScanPhotoGroup,
  collectVinScanAuctionPhotoUrls,
  isAllowedVinScanAuctionPhotoUrl,
  ORDER_VIN_SCAN_PHOTO_IMPORT_MAX,
  vinScanAuctionPhotoGroupTitle,
} from "@/lib/order-vin-scan-photos";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

function indicator(partial: Partial<VinScanIndicator> & Pick<VinScanIndicator, "id" | "status">): VinScanIndicator {
  return {
    label: partial.label || partial.id,
    country: "US",
    summary: "",
    detail: "",
    openUrl: null,
    ...partial,
  };
}

describe("VIN SCAN izsoļu foto URL", () => {
  it("laiž cauri tikai https izsoļu hostus", () => {
    expect(isAllowedVinScanAuctionPhotoUrl("https://cs.copart.com/lot/a.jpg")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("https://vis.iaai.com/image.jpg")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("https://cars2.import-motor.com/copart/a.webp")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("http://cs.copart.com/a.jpg")).toBe(false);
    expect(isAllowedVinScanAuctionPhotoUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isAllowedVinScanAuctionPhotoUrl("https://evil.example/a.jpg")).toBe(false);
  });

  it("stat.vin pirmie, līdz 20, bez dubultiem", () => {
    const extras = Array.from({ length: 30 }, (_, i) => `https://cs.copart.com/p/${i}.jpg`);
    const urls = collectVinScanAuctionPhotoUrls([
      indicator({
        id: "bid_cars",
        status: "found",
        media: { photoUrl: "https://bid.cars/x.jpg" },
      }),
      indicator({
        id: "stat_vin",
        label: "stat.vin",
        status: "found",
        media: { photoUrl: extras[0], photoUrls: extras },
        auctions: [{ venue: "Copart", date: "2025-09-02", photoUrl: extras[0] }],
      }),
    ]);
    expect(urls[0]).toBe("https://cs.copart.com/p/0.jpg");
    expect(urls).toHaveLength(ORDER_VIN_SCAN_PHOTO_IMPORT_MAX);
    expect(urls).not.toContain("https://bid.cars/x.jpg");
  });

  it("JoJ import-motor foto iet AUCTION importā, pēc stat.vin", () => {
    const joj = "https://cars2.import-motor.com/copart/a.webp";
    const extra = "https://cs.copart.com/p/1.jpg";
    const urls = collectVinScanAuctionPhotoUrls([
      indicator({
        id: "joj_copart_iaai",
        status: "found",
        media: { photoUrl: joj, photoUrls: [joj, extra] },
        auctions: [{ venue: "Copart", photoUrl: joj }],
      }),
      indicator({
        id: "stat_vin",
        status: "found",
        media: { photoUrl: extra, photoUrls: [extra] },
      }),
    ]);
    expect(urls[0]).toBe(extra);
    expect(urls).toContain(joj);
  });

  it("grupas virsraksts un jau ieliktas bildes", () => {
    expect(
      vinScanAuctionPhotoGroupTitle([
        indicator({
          id: "stat_vin",
          status: "found",
          auctions: [{ venue: "Copart", date: "2025-09-02" }],
        }),
      ]),
    ).toBe("VIN SCAN · Copart · 2025");
    expect(ccVinHasVinScanPhotoGroup([{ title: "VIN SCAN · Copart", photos: [{ id: "ih_ph_1" }] }])).toBe(true);
    expect(ccVinHasVinScanPhotoGroup([{ title: "Citas", photos: [{ id: "x" }] }])).toBe(false);
  });
});
