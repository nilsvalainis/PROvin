import { describe, expect, it } from "vitest";
import {
  ONEAUTO_IMAGE_MAX_VIEWS,
  ONEAUTO_PHOTO_GROUP_TITLE,
  formatOneautoImageCostEur,
  oneautoImageFetchCostCents,
  parseOneautoImageFromIdUrl,
  parseOneautoImageSearchPayload,
} from "@/lib/oneauto-images";
import {
  appendPhotosToAutoRecordsGroup,
  makeAutoRecordsPhotoGroupId,
} from "@/lib/auto-records-photo-types";

describe("OneAuto vehicle imagery", () => {
  it("parses image ids from VIN search payload and keeps exterior views first", () => {
    const match = parseOneautoImageSearchPayload({
      success: true,
      result: {
        images: [
          {
            manufacturer_desc: "Volkswagen",
            model_range_desc: "Passat",
            manufactured_year: 2009,
            image_ids: {
              front: "id-front",
              front_right: "id-front-right",
              right: "id-right",
              rear: "id-rear",
              rear_right: "id-rear-right",
              inside_1: "id-inside",
            },
            colour_desc_list: ["Arctic White", "Black"],
          },
        ],
      },
    });
    expect(match?.manufacturer).toBe("Volkswagen");
    expect(match?.modelRange).toBe("Passat");
    expect(match?.manufacturedYear).toBe(2009);
    expect(match?.colourHints[0]).toBe("Arctic White");
    expect(match?.views.map((v) => v.view)).toEqual([
      "front",
      "front_right",
      "right",
      "rear_right",
    ].slice(0, ONEAUTO_IMAGE_MAX_VIEWS));
    expect(match?.views.every((v) => !v.view.startsWith("inside"))).toBe(true);
    expect(match?.views).toHaveLength(ONEAUTO_IMAGE_MAX_VIEWS);
  });

  it("reads CDN url from Image from ID payload", () => {
    expect(
      parseOneautoImageFromIdUrl({
        success: true,
        result: { image_url: "https://cdn.example/vehicle.png?sig=1" },
      }),
    ).toBe("https://cdn.example/vehicle.png?sig=1");
    expect(parseOneautoImageFromIdUrl({ success: true, result: {} })).toBeNull();
  });

  it("sums search + per-view image costs", () => {
    expect(oneautoImageFetchCostCents(0)).toBe(18);
    expect(oneautoImageFetchCostCents(4)).toBe(18 + 4 * 18);
    expect(formatOneautoImageCostEur(4)).toBe("€0.90");
  });

  it("appends OneAuto photos into a titled auto-records group", () => {
    const idA = "ar_ph_aaaaaaaaaaaaaaaaaaaaaaaa";
    const idB = "ar_ph_bbbbbbbbbbbbbbbbbbbbbbbb";
    const first = appendPhotosToAutoRecordsGroup([], [idA], ONEAUTO_PHOTO_GROUP_TITLE);
    expect(first).toHaveLength(1);
    expect(first[0]?.title).toBe(ONEAUTO_PHOTO_GROUP_TITLE);
    expect(first[0]?.photos.map((p) => p.id)).toEqual([idA]);
    const second = appendPhotosToAutoRecordsGroup(first, [idA, idB], ONEAUTO_PHOTO_GROUP_TITLE);
    expect(second).toHaveLength(1);
    expect(second[0]?.photos.map((p) => p.id)).toEqual([idA, idB]);
    const other = appendPhotosToAutoRecordsGroup(
      [{ id: makeAutoRecordsPhotoGroupId(), title: "Cita grupa", photos: [{ id: idA }] }],
      [idB],
      ONEAUTO_PHOTO_GROUP_TITLE,
    );
    expect(other).toHaveLength(2);
    expect(other.some((g) => g.title === ONEAUTO_PHOTO_GROUP_TITLE)).toBe(true);
  });
});
