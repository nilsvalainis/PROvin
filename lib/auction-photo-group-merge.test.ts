import { describe, expect, it } from "vitest";

import { mergeImportedPhotoGroups } from "@/lib/auction-photo-group-merge";

describe("izsoļu foto grupu sapludināšana", () => {
  it("atkārtota ielāde pievieno trūkstošās bildes esošajā grupā, bez dublikātiem", () => {
    const existing = [
      {
        id: "ih_phg_aaa",
        title: "JoJ · Copart · lots 94166665 · 2026",
        photos: [
          { id: "ih_ph_aaaaaaaaaaaaaaaaaaaaaaaa", sourceUrl: "https://cs.copart.com/a.jpg", contentHash: "a".repeat(64) },
        ],
      },
    ];
    const merged = mergeImportedPhotoGroups(
      existing,
      [
        {
          title: "JoJ · Copart · lots 94166665 · 2026",
          photos: [
            { id: "ih_ph_bbbbbbbbbbbbbbbbbbbbbbbb", sourceUrl: "https://cs.copart.com/a.jpg", contentHash: "a".repeat(64) },
            { id: "ih_ph_cccccccccccccccccccccccc", sourceUrl: "https://cs.copart.com/b.jpg", contentHash: "b".repeat(64) },
          ],
        },
        {
          title: "JoJ · IAAI · lots 41872206 · 2026",
          photos: [
            {
              id: "ih_ph_dddddddddddddddddddddddd",
              sourceUrl: "https://vis.iaai.com/c.jpg",
              contentHash: "c".repeat(64),
            },
          ],
        },
      ],
      () => "ih_phg_newnewnewnewnewnewnewn",
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.photos.map((p) => p.id)).toEqual([
      "ih_ph_aaaaaaaaaaaaaaaaaaaaaaaa",
      "ih_ph_cccccccccccccccccccccccc",
    ]);
    expect(merged[1]!.title).toContain("IAAI");
    expect(merged[1]!.photos).toHaveLength(1);
  });

  it("sader ar veco VIN SCAN virsrakstu bez lots, ja lots sakrīt pēc avota", () => {
    const existing = [{ id: "g1", title: "VIN SCAN · Copart · 2025", photos: [{ id: "ih_ph_old" }] }];
    const merged = mergeImportedPhotoGroups(
      existing,
      [{ title: "VIN SCAN · Copart · lots 1 · 2025", photos: [{ id: "ih_ph_newnewnewnewnewnewnewnew" }] }],
      () => "g2",
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.photos.map((p) => p.id)).toEqual(["ih_ph_old"]);
    expect(merged[1]!.photos[0]!.id).toBe("ih_ph_newnewnewnewnewnewnewnew");
  });
});
