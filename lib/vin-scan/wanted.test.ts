import { describe, expect, it } from "vitest";

import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import {
  classifyPoliceWanted,
  isVinScanWantedSource,
  vinScanWantedDotClass,
  vinScanWantedStatusLabel,
  vinScanWantedTileClass,
} from "@/lib/vin-scan/wanted";

const VIN = "WVWZZZ3CZWE123456";

const LT_FORM = `
Paieška Ieškomų transporto priemonių registre
Valstybinis numeris:
Kėbulo numeris:
Variklio numeris:
Ieškoti
`;

describe("policijas meklētie TL", () => {
  it("LT forma vien vēl nav rezultāts", () => {
    expect(classifyPoliceWanted("lt_itpr", LT_FORM, VIN)).toBeNull();
    expect(classifyBrowserProbe("lt_itpr", LT_FORM, VIN)).toBeNull();
  });

  it("nav sarakstā ir none, ne sarkans trūkums", () => {
    expect(classifyPoliceWanted("lt_itpr", "Pagal Jūsų nurodytus kriterijus duomenų nerasta.", VIN)).toMatchObject({
      status: "none",
      summary: "Nav meklēšanā",
    });
    expect(classifyPoliceWanted("vp_wanted", "Transportlīdzeklis nav meklēšanā.", VIN)).toMatchObject({
      status: "none",
      summary: "Nav meklēšanā",
    });
    expect(vinScanWantedStatusLabel("none")).toBe("Nav meklēšanā");
    expect(vinScanWantedDotClass("none")).toBe("bg-emerald-500");
  });

  it("meklēšanā ir found un sarkans", () => {
    const lt = `Ieškoma transporto priemonė ${VIN}. Paieškos priežastis: vagystė. Paiešką paskelbusi valstybė: Lietuva.`;
    expect(classifyBrowserProbe("lt_itpr", lt, VIN)).toMatchObject({
      status: "found",
      summary: expect.stringContaining("Meklēšanā"),
    });
    const lv = `VIN ${VIN} izsludināts meklēšanā. Meklēšanas iemesls: zādzība.`;
    expect(classifyPoliceWanted("vp_wanted", lv, VIN)?.status).toBe("found");
    expect(vinScanWantedStatusLabel("found")).toBe("Meklēšanā");
    expect(vinScanWantedDotClass("found")).toBe("bg-rose-600");
    expect(vinScanWantedTileClass("vp_wanted", "found")).toContain("rose");
    expect(isVinScanWantedSource("lt_itpr")).toBe(true);
    expect(isVinScanWantedSource("plc_auction")).toBe(false);
  });

  it("404 nav apgalvojums, ka nav meklēšanā", () => {
    expect(classifyPoliceWanted("vp_wanted", "Lapa netika atrasta. Page not found.", VIN)).toMatchObject({
      status: "unknown",
      summary: "Publiskā lapa nav pieejama",
    });
  });
});
