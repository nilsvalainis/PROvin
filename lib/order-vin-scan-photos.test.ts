import { describe, expect, it } from "vitest";

import {
  ccVinHasVinScanPhotoGroup,
  collectVinScanAuctionPhotoGroups,
  collectVinScanAuctionPhotoUrls,
  isAllowedVinScanAuctionPhotoUrl,
  ORDER_VIN_SCAN_PHOTO_IMPORT_MAX,
  vinScanAuctionPhotoGroupTitle,
  vinScanAuctionPhotoGroupTitleForAuction,
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
    expect(isAllowedVinScanAuctionPhotoUrl("https://www.copart.fi/photo/a.jpg")).toBe(true);
    expect(isAllowedVinScanAuctionPhotoUrl("http://cs.copart.com/a.jpg")).toBe(false);
    expect(isAllowedVinScanAuctionPhotoUrl("https://127.0.0.1/a.jpg")).toBe(false);
    expect(isAllowedVinScanAuctionPhotoUrl("https://evil.example/a.jpg")).toBe(false);
  });

  it("stat.vin un JoJ nekonkurē: katrs lots savu grupu, visi >20 URL", () => {
    const extras = Array.from({ length: 30 }, (_, i) => `https://cs.copart.com/p/${i}.jpg`);
    const jojExtras = Array.from({ length: 25 }, (_, i) => `https://cars2.import-motor.com/copart/j-${i}.webp`);
    const groups = collectVinScanAuctionPhotoGroups([
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
      indicator({
        id: "joj_copart_iaai",
        status: "found",
        auctions: [
          {
            venue: "Copart",
            date: "2026-03-25",
            lot: "94166665",
            photoUrl: jojExtras[0],
            photoUrls: jojExtras,
            photoCount: jojExtras.length,
          },
        ],
      }),
    ]);
    const urls = collectVinScanAuctionPhotoUrls([
      indicator({
        id: "stat_vin",
        status: "found",
        media: { photoUrls: extras },
      }),
      indicator({
        id: "joj_copart_iaai",
        status: "found",
        auctions: [{ venue: "Copart", lot: "94166665", date: "2026-03-25", photoUrls: jojExtras }],
      }),
    ]);
    expect(urls.length).toBeGreaterThan(20);
    expect(urls.length).toBeGreaterThan(ORDER_VIN_SCAN_PHOTO_IMPORT_MAX > 20 ? 20 : 0);
    expect(groups.some((g) => g.sourceId === "joj_copart_iaai" && g.urls.length === 25)).toBe(true);
    expect(groups.some((g) => g.sourceId === "stat_vin" && g.urls.length >= 29)).toBe(true);
    expect(groups.find((g) => g.sourceId === "joj_copart_iaai")?.title).toContain("lots 94166665");
  });

  it("JoJ import-motor foto iet AUCTION importā, savā grupā", () => {
    const joj = "https://cars2.import-motor.com/copart/a.webp";
    const extra = "https://cs.copart.com/p/1.jpg";
    const urls = collectVinScanAuctionPhotoUrls([
      indicator({
        id: "joj_copart_iaai",
        status: "found",
        media: { photoUrl: joj, photoUrls: [joj, extra] },
        auctions: [{ venue: "Copart", photoUrl: joj, photoUrls: [joj] }],
      }),
      indicator({
        id: "stat_vin",
        status: "found",
        media: { photoUrl: extra, photoUrls: [extra] },
      }),
    ]);
    expect(urls).toContain(extra);
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
    expect(
      vinScanAuctionPhotoGroupTitleForAuction("joj_copart_iaai", {
        venue: "IAAI",
        lot: "41872206",
        date: "2026-03-11",
      }),
    ).toBe("JoJ · IAAI · lots 41872206 · 2026");
    expect(ccVinHasVinScanPhotoGroup([{ title: "VIN SCAN · Copart", photos: [{ id: "ih_ph_1" }] }])).toBe(true);
    expect(ccVinHasVinScanPhotoGroup([{ title: "JoJ · Copart · lots 1", photos: [{ id: "x" }] }])).toBe(true);
    expect(ccVinHasVinScanPhotoGroup([{ title: "Citas", photos: [{ id: "x" }] }])).toBe(false);
  });
});
