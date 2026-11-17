import { describe, expect, it } from "vitest";
import { movePhotoList, PdPhotoSorter, photosToFront } from "@/components/admin/iriss-piedavajumi/PdPhotoSorter";
import { renderText } from "@/lib/test-render";

describe("Bilžu kārtotājs (Nils 28.10)", () => {
  it("pārvietošana un atzīmētās uz sākumu", () => {
    expect(movePhotoList(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(movePhotoList(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(photosToFront(["a", "b", "c", "d"], new Set([2, 3]))).toEqual(["c", "d", "a", "b"]);
  });

  it("51 foto: vāks, numuri, sākumā 12 un «Rādīt visas»", () => {
    const photos = Array.from({ length: 51 }, (_, i) => `p${i}`);
    const text = renderText(<PdPhotoSorter photos={photos} editable urlOf={(p) => `/x/${p}`} keyOf={(p) => p} onChange={() => undefined} />);
    expect(text).toContain("VĀKS");
    expect(text).toContain("12");
    expect(text).not.toContain("13");
    expect(text).toContain("Rādīt visas (51)");
    expect(text).toContain("Atzīmēt vairākas");
  });
});
