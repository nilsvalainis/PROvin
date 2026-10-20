import { describe, expect, it } from "vitest";
import { appendMissingFlatPhotos } from "@/lib/photo-group-legacy-recover";

describe("appendMissingFlatPhotos", () => {
  it("puts leftover flat ids into the first titled-empty group", () => {
    const next = appendMissingFlatPhotos(
      [{ id: "g1", title: "Arhīva fotogrāfijas 2026-10-20", photos: [] as { id: string }[] }],
      [{ id: "inc_ph_aabbccddeeff001122334455" }, { id: "inc_ph_112233445566778899aabbcc" }],
    );
    expect(next[0]!.photos.map((p) => p.id)).toEqual([
      "inc_ph_aabbccddeeff001122334455",
      "inc_ph_112233445566778899aabbcc",
    ]);
  });

  it("does not duplicate photos already present in a group", () => {
    const next = appendMissingFlatPhotos(
      [{ id: "g1", photos: [{ id: "a" }] }],
      [{ id: "a" }, { id: "b" }],
    );
    expect(next[0]!.photos.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
