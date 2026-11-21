import { describe, expect, it } from "vitest";
import {
  movePhotoById,
  movePhotoList,
  PdPhotoSorter,
  photoIds,
  photosToFront,
  removePhotosById,
} from "@/components/admin/iriss-piedavajumi/PdPhotoSorter";
import { renderHtml, renderText } from "@/lib/test-render";

const key = (p: string) => p;

describe("Bilžu kārtotājs (Nils 28.10)", () => {
  it("pārvietošana un atzīmētās uz sākumu", () => {
    expect(movePhotoList(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(movePhotoList(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(photosToFront(["a", "b", "c", "d"], new Set(["c", "d"]), key)).toEqual(["c", "d", "a", "b"]);
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

describe("Nils 21.11: noņemšana pēc id, nevis pozīcijas", () => {
  it("pēc pārkārtošanas noņem tieši izvēlēto bildi", () => {
    const moved = movePhotoById(["a", "b", "c", "d", "e"], "e", "a", key);
    expect(moved).toEqual(["e", "a", "b", "c", "d"]);
    expect(removePhotosById(moved, new Set(["c"]), key)).toEqual(["e", "a", "b", "d"]);
  });

  it("vāka bildes noņemšana - vāks kļūst nākamā", () => {
    const left = removePhotosById(["a", "b", "c"], new Set(["a"]), key);
    expect(left[0]).toBe("b");
    expect(renderText(<PdPhotoSorter photos={left} editable urlOf={(p) => `/x/${p}`} keyOf={key} onChange={() => undefined} />)).toMatch(/VĀKS × 2 ×/);
  });

  it("«Atzīmēt vairākas»: atzīmētās paliek tās pašas arī pēc pārkārtošanas", () => {
    const picked = new Set(["b", "d"]);
    const moved = movePhotoById(["a", "b", "c", "d"], "d", "a", key);
    expect(removePhotosById(moved, picked, key)).toEqual(["a", "c"]);
  });

  it("dublēta bilde: katrai savs id, noņem tikai vienu", () => {
    const list = ["a", "b", "a"];
    expect(photoIds(list, key)).toEqual(["a", "b", "a#2"]);
    expect(removePhotosById(list, new Set(["a#2"]), key)).toEqual(["a", "b"]);
  });

  it("katrai bildei «×» un vilkšanas atribūti; skatam bez rediģēšanas - nav", () => {
    const html = renderHtml(<PdPhotoSorter photos={["a", "b"]} editable urlOf={(p) => `/x/${p}`} keyOf={key} onChange={() => undefined} />);
    expect(html.match(/Foto \d: noņemt/g)).toHaveLength(2);
    expect(html).toContain("pārvietojama bilde");
    const ro = renderHtml(<PdPhotoSorter photos={["a", "b"]} editable={false} urlOf={(p) => `/x/${p}`} keyOf={key} onChange={() => undefined} />);
    expect(ro).not.toContain("noņemt");
    expect(ro).not.toContain("pārvietojama");
  });
});
