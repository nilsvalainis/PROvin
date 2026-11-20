import { describe, expect, it } from "vitest";
import {
  autobidLotPageUrl,
  autobidTitleFromPage,
  autobidTitleFromUrl,
  irissPdAutobidImport,
} from "@/lib/iriss-piedavajumi-autobid";
import type { IrissPdImport } from "@/lib/iriss-piedavajumi-import";
import { detectIrissPdLink, IRISS_PD_ADAPTERS } from "@/lib/iriss-piedavajumi-sources";
import { emptyIrissPdVehicle } from "@/lib/iriss-piedavajumi-types";

const URL_AB = "https://autobid.de/en/item/audi-q5-2-0-tdi-quattro-3635359/details";
const link = detectIrissPdLink(URL_AB)!;

function listing(over: Partial<IrissPdImport> = {}): IrissPdImport {
  return {
    source: "autobid",
    sourceRef: "listing:abc",
    sourceUrl: URL_AB,
    sourceKey: "3635359",
    vehicle: { ...emptyIrissPdVehicle(), title: "Audi Q5 2.0 TDI quattro S tronic", fuel: "Dīzelis", mileageKm: "120000", year: "2019" },
    photos: [{ kind: "url", url: "https://img.autobid.de/1.jpg" } as unknown as IrissPdImport["photos"][number]],
    price: "",
    purchasePrice: "15500",
    auto1: null,
    fieldCount: 4,
    historyText: "",
    note: "",
    ...over,
  };
}

describe("Autobid saite -> PD", () => {
  it("Autobid vairs nav stub", () => {
    expect(link.source).toBe("autobid");
    expect(link.key).toBe("3635359");
    expect(IRISS_PD_ADAPTERS.autobid.mode).toBe("relay_autobid");
  });

  it("lotes URL tikai /item/ lapām", () => {
    expect(autobidLotPageUrl(URL_AB)).toBe(URL_AB);
    expect(autobidLotPageUrl("https://autobid.de/en/search-results")).toBe("");
    expect(autobidLotPageUrl("https://evil.example/en/item/x-1")).toBe("");
  });

  it("nosaukums no lapas virsraksta un no saites", () => {
    expect(autobidTitleFromPage("Audi Q5 2.0 TDI quattro | Autobid.de")).toBe("Audi Q5 2.0 TDI quattro");
    expect(autobidTitleFromPage("Autobid.de")).toBe("");
    expect(autobidTitleFromPage("Login")).toBe("");
    expect(autobidTitleFromUrl(URL_AB)).toBe("Audi Q5 2.0 TDI Quattro");
    expect(autobidTitleFromUrl("https://autobid.de/en/search-results")).toBe("");
  });

  it("Sludinājums + lotes lapa: lauki, foto, cena, VIN", () => {
    const imp = irissPdAutobidImport(link, listing(), {
      status: "ok",
      note: "",
      results: [{ url: URL_AB, status: "ok", vin: "WAUZZZFY0K2012345", mileageKm: 121000, firstRegistration: "03/2019", title: "x | Autobid.de" }],
    });
    expect(imp.source).toBe("autobid");
    expect(imp.sourceUrl).toBe(URL_AB);
    expect(imp.vehicle.title).toBe("Audi Q5 2.0 TDI quattro S tronic");
    expect(imp.vehicle.vin).toBe("WAUZZZFY0K2012345");
    expect(imp.vehicle.mileageKm).toBe("120000");
    expect(imp.vehicle.firstRegistration).toBe("03/2019");
    expect(imp.photos).toHaveLength(1);
    expect(imp.purchasePrice).toBe("15500");
    expect(imp.fieldCount).toBeGreaterThanOrEqual(6);
    expect(imp.note).toBe("");
  });

  it("nav Sludinājumos: dati no lotes lapas", () => {
    const imp = irissPdAutobidImport(link, null, {
      status: "ok",
      note: "",
      results: [{ url: URL_AB, status: "ok", vin: "WAUZZZFY0K2012345", mileageKm: 98000, firstRegistration: "2018-05", title: "Audi Q5 Sportback | Autobid.de" }],
    });
    expect(imp.vehicle.title).toBe("Audi Q5 Sportback");
    expect(imp.vehicle.mileageKm).toBe("98000");
    expect(imp.vehicle.year).toBe("2018");
    expect(imp.note).toContain("nav IRISS Sludinājumos");
  });

  it("relejs nenolasīja: nosaukums no saites, nekad tukšs", () => {
    const imp = irissPdAutobidImport(link, null, { status: "login_required", note: "", results: [] });
    expect(imp.vehicle.title).toBe("Audi Q5 2.0 TDI Quattro");
    expect(imp.fieldCount).toBe(1);
    expect(imp.note).toContain("sesija");
    expect(irissPdAutobidImport(link, null, null).vehicle.title).toBe("Audi Q5 2.0 TDI Quattro");
  });
});
