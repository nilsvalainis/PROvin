import { describe, expect, it } from "vitest";
import { appendUploadedPhotosToGroup } from "@/lib/photo-group-append";

describe("K5 upload vs autosave/delete race", () => {
  it("augšupielāde pievieno jaunākajām grupām — paralēli izdzēsta bilde neatgriežas", () => {
    // Augšupielādes sākumā grupā bija A,B; tikmēr B izdzēsta → jaunākais stāvoklis [A].
    const latest = [{ id: "g1", title: "G", photos: [{ id: "A" }] }, { id: "g2", title: "", photos: [{ id: "X" }] }];
    const out = appendUploadedPhotosToGroup(latest, "g1", [{ id: "C" }]);
    expect(out[0]!.photos.map((p) => p.id)).toEqual(["A", "C"]);
    expect(out[1]).toBe(latest[1]);
    expect(out[0]!.title).toBe("G");
  });
  it("bez dublikātiem; citas grupas un virsraksti nemainīti", () => {
    const latest = [{ id: "g1", title: "T", photos: [{ id: "A" }, { id: "C" }] }];
    expect(appendUploadedPhotosToGroup(latest, "g1", [{ id: "C" }])[0]!.photos.map((p) => p.id)).toEqual(["A", "C"]);
  });
});
