import { describe, expect, it } from "vitest";

import { irissPdPhotosFromUrls } from "@/lib/iriss-piedavajumi-import";

const A = "https://img-pa.auto1.com/imgef/3d/ef3d35a247403554a5d7415a3cdb8f47/pa";
const urls = (photos: { url?: string }[]) => photos.map((p) => p.url);

describe("Nils 30.10: izsoles bildes bez svešām (kājene, «līdzīgie auto») un bez dublikātiem", () => {
  it("Auto1: tikai šī auto krājuma kods; tā pati bilde vairākos izmēros - viena, lielākā", () => {
    const out = irissPdPhotosFromUrls([
      `${A}/XY05579_fa108c1cdc0c74874f1c3800c9c49eee.jpg`,
      `${A}/XY05579_1a6db518e0948d27b90552b4b1f782a5.jpg`,
      `${A}/sr-x2-XY05579_fa108c1cdc0c74874f1c3800c9c49eee.jpg`,
      `${A}/max-XY05579_1a6db518e0948d27b90552b4b1f782a5.jpg`,
      "https://img-pa.auto1.com/img58/f3/58f3c174e4681e76d8ae8c2061fe3c11/pa/sr-x2-SL80212_39542dbc21ba3694915e0d9b0b3cbd91.jpg",
      "https://img-pa.auto1.com/imgff/37/ff37ff03df11addff493b45a1b4130ed/pa/sr-x2-ZD99924_e7081a42c7355c31a2080bc9316fb275.jpg",
    ]);
    expect(urls(out)).toEqual([`${A}/sr-x2-XY05579_fa108c1cdc0c74874f1c3800c9c49eee.jpg`, `${A}/max-XY05579_1a6db518e0948d27b90552b4b1f782a5.jpg`]);
  });

  it("Auto1: atšķirīgas bildes (arī sr-x2 bez pāra) paliek visas, secība saglabājas", () => {
    const out = irissPdPhotosFromUrls([
      `${A}/XY05579_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
      `${A}/sr-x2-XY05579_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg`,
      `${A}/XY05579_cccccccccccccccccccccccccccccccc.jpg`,
    ]);
    expect(out).toHaveLength(3);
  });

  it("Openlane: šī auto carimgs paliek, kājenes sīktēli un cita auto bildes - nē", () => {
    const out = irissPdPhotosFromUrls([
      "https://images.openlane.eu/carimgs/6078031/general/94b61b76-7034-4fc0-8400-50ff8482c104.jpg",
      "https://images.openlane.eu/carimgs/6078031/general/11111111-7034-4fc0-8400-50ff8482c104.jpg?w=800",
      "https://images.openlane.eu/carimgs/6078031/general/11111111-7034-4fc0-8400-50ff8482c104.jpg?w=300",
      "https://images.openlane.eu/thumbnail/6033019/tn_thumbnail.jpg?size=300",
      "https://images.openlane.eu/carimgs/6091014/general/22222222-7034-4fc0-8400-50ff8482c104.jpg",
    ]);
    expect(out).toHaveLength(2);
  });

  it("logo un ikonas netiek ņemtas", () => {
    const out = irissPdPhotosFromUrls(["https://cdn.example.com/static/logo.png", "https://cdn.example.com/img/flag-de.svg", "https://cdn.example.com/cars/1.jpg"]);
    expect(urls(out)).toEqual(["https://cdn.example.com/cars/1.jpg"]);
  });
});
