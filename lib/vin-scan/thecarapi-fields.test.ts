import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";
import { buildThecarapiAdminRecords, parseThecarapiDetail } from "@/lib/vin-scan/parse-thecarapi";
import {
  thecarapiDownloadUrls,
  thecarapiFieldsOf,
  thecarapiPdfGroupTitle,
  thecarapiPhotoDate,
} from "@/lib/vin-scan/thecarapi-fields";

function fixture(name: string): unknown {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

describe("TheCarApi lauki", () => {
  it("patur visus laukus, latviski zināmos un atslēgu nezināmajiem", () => {
    const records = buildThecarapiAdminRecords({
      historyJson: fixture("history-hit.json"),
      detailJson: { auctions: [fixture("detail-auto1.json")] },
      imagesByKey: { "auto1:A1-100": fixture("images-auto1.json") },
    });
    const openlane = records.find((row) => row.id === "OL-55");
    const auto1 = records.find((row) => row.id === "A1-100");
    expect(openlane?.photoDate).toBe("2024-06-02");
    expect(auto1?.photoDate).toBe("2024-03-12");
    expect(openlane?.fields.find((field) => field.key === "seller")).toMatchObject({
      label: "Pārdevējs",
      value: "Openlane DE",
    });
    expect(openlane?.fields.find((field) => field.key === "unknown_portal_code")).toMatchObject({
      label: "unknown_portal_code",
      value: "X-9",
    });
    expect(auto1?.fields.find((field) => field.key === "mystery_flag")?.value).toBe("keep-me");
    expect(auto1?.fields.find((field) => field.key === "damage.zone")).toMatchObject({
      label: "Bojājuma zona",
      value: "priekšpuse",
    });
    expect(JSON.stringify(auto1?.raw)).toContain("keep-me");
    expect(JSON.stringify(auto1?.raw)).toContain("insecure.jpg");
    expect(auto1?.photoUrls).toEqual([
      "https://img-pa.auto1.com/img/front.jpg",
      "https://img-pa.auto1.com/img/side.jpg",
      "https://img-pa.auto1.com/img/extra.jpg",
    ]);
    expect(auto1?.photoUrls.some((url) => url.startsWith("http://"))).toBe(false);
  });

  it("bildes datums ir izsoles datums, citādi first_seen_at, tad last_seen_at, tad data_updated_at", () => {
    expect(thecarapiPhotoDate({ auction_date: "2024-06-02", first_seen_at: "2024-06-01", last_seen_at: "2024-06-03" })).toBe(
      "2024-06-02",
    );
    expect(thecarapiPhotoDate({ first_seen_at: "2024-03-12T10:00:00Z", last_seen_at: "2024-03-15T18:00:00Z" })).toBe("2024-03-12");
    expect(thecarapiPhotoDate({ last_seen_at: "2024-03-15T18:00:00Z" })).toBe("2024-03-15");
    expect(thecarapiPhotoDate({ last_seen_at: "2024-03-15", data_updated_at: "2026-10-09T18:00:00Z" })).toBe("2024-03-15");
    expect(thecarapiPhotoDate({ first_seen: "2026-10-09", data_updated_at: "2026-10-01" })).toBe("2026-10-09");
    expect(thecarapiPhotoDate({ data_updated_at: "2026-10-09T18:00:00Z" })).toBe("2026-10-09");
    expect(
      thecarapiPhotoDate({
        auction_end_at: "2026-10-09T16:00:00Z",
        batch_start_date: "2026-10-01",
        last_changed_at: "2026-10-08T12:00:00Z",
        first_seen: "2026-09-01",
      }),
    ).toBe("2026-10-09");
    expect(thecarapiPhotoDate({ batch_start_date: "2026-10-01", last_changed_at: "2026-10-08" })).toBe("2026-10-01");
  });

  it("AUTO1 aploksne auction savāc visus bilžu laukus un data_updated_at rezervi", () => {
    const json = fixture("detail-auto1-wrapped.json");
    const detail = parseThecarapiDetail(json);
    expect(detail.site).toBe("auto1");
    expect(detail.id).toBe("1326383403");
    expect(detail.photoUrls).toHaveLength(29);

    const [row] = buildThecarapiAdminRecords({ historyJson: null, detailJson: json });
    expect(row?.photoUrls).toHaveLength(29);
    for (const name of ["main-1", "damage-1", "service-1", "vault-1", "vault-alt", "gallery-1", "nested-1", "sub-1"]) {
      expect(row?.photoUrls).toContain(`https://img-pa.auto1.com/img/${name}.jpg`);
    }
    expect(row?.photoUrls.some((url) => url.startsWith("http://"))).toBe(false);
    expect(row?.photoUrls.filter((url) => url.endsWith("/main-1.jpg"))).toHaveLength(1);
    expect(row?.photoDate).toBe("2026-10-09");
    expect(row?.fields.find((field) => field.key === "ImageUrls[0].image_index")).toMatchObject({
      label: "Bildes indekss",
      value: "0",
    });
    expect(row?.fields.find((field) => field.key === "ServiceImageUrls[0].image_source")).toMatchObject({
      label: "Bildes avots",
      value: "service",
    });
    expect(row?.fields.find((field) => field.key === "subAreaImages[0].image_status")).toMatchObject({
      label: "Bildes statuss",
      value: "hidden",
    });
    expect(row?.fields.find((field) => field.key === "inspection.images[0].image_source")?.value).toBe("nested");
    expect(row?.fields.find((field) => field.key === "ImageVaultImages[1].image_status")?.value).toBe("alt-key");
    const raw = JSON.stringify(row?.raw);
    expect(raw).toContain("service-insecure.jpg");
    expect(raw).toContain("data_updated_at");
    expect(raw).toContain("contract_version");
  });

  it("reālā AUTO1 detaļa lasa auction.images un car_identification", () => {
    const json = fixture("detail-auto1-live-shape.json");
    const history = {
      auctions: [
        {
          site_name: "auto1",
          auction_id: "1326383403",
          detail_path: "/api/auction/auto1/1326383403",
          mileage: 77387,
          first_seen: "2026-09-01",
          archived: false,
          archived_at: null,
        },
      ],
    };
    const [row] = buildThecarapiAdminRecords({ historyJson: history, detailJson: json });
    expect(row?.id).toBe("1326383403");
    expect(row?.photoDate).toBe("2026-10-09");
    for (const url of [
      "https://img-pa.auto1.com/img/live-1.jpg",
      "https://img-pa.auto1.com/img/live-2.jpg",
      "https://img-pa.auto1.com/img/cid-1.jpg",
      "https://img-pa.auto1.com/img/cid-vault.jpg",
      "https://img-pa.auto1.com/img/cid-damage.jpg",
      "https://img-pa.auto1.com/img/cid-service.jpg",
      "https://img-pa.auto1.com/img/cid-doc.jpg",
      "https://img-pa.auto1.com/img/cid-video.mp4",
      "https://img-pa.auto1.com/img/thumb.jpg",
      "https://img-pa.auto1.com/img/vault-main.jpg",
      "https://img-pa.auto1.com/img/zone-1.jpg",
    ]) {
      expect(row?.photoUrls).toContain(url);
    }
    expect(row?.photoUrls.some((url) => url.includes("/auction-photo/"))).toBe(false);
    const raw = JSON.stringify(row?.raw);
    expect(raw).toContain("car_identification");
    expect(raw).toContain("ImageUrls");
    expect(raw).toContain("live-1.jpg");
    expect(row?.fields.some((field) => field.key === "Auto1Details.kw" && field.value === "140")).toBe(true);
    expect(row?.fields.some((field) => field.key === "Auto1Details.originalEngine" && field.value === "jā")).toBe(true);
    expect(row?.fields.some((field) => field.key === "DamagesV3[0].zone" && field.value === "Priekšējais bamperis")).toBe(true);
    expect(row?.fields.some((field) => field.key === "DatEquipmentGroupsTranslated" && field.value.includes("Navigācija"))).toBe(true);
    expect(row?.rawDetail && typeof row.rawDetail === "object").toBe(true);
  });

  it("nezināma atslēga paliek, http saite netiek lejupielādēta", () => {
    const fields = thecarapiFieldsOf({ mystery_flag: "keep-me", gallery: ["http://img-pa.auto1.com/img/insecure.jpg"] });
    expect(fields.find((field) => field.key === "mystery_flag")?.label).toBe("mystery_flag");
    const urls = thecarapiDownloadUrls(
      ["http://img-pa.auto1.com/img/insecure.jpg", "https://img-pa.auto1.com/img/front.jpg"],
      isAllowedVinScanAuctionPhotoUrl,
    );
    expect(urls).toEqual(["https://img-pa.auto1.com/img/front.jpg"]);
  });

  it("klienta PDF virsrakstā nav TheCarApi", () => {
    expect(thecarapiPdfGroupTitle("TheCarApi · AUTO1 · 2024-03-12")).toBe("AUTO1 · 12.03.2024");
    expect(thecarapiPdfGroupTitle("Openlane · 2024-06-02")).toBe("Openlane · 02.06.2024");
  });
});
