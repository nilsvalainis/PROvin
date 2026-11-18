import { describe, expect, it } from "vitest";
import { BigVin, splitVinTail } from "@/components/admin/iriss-logistika/BigVin";
import { IrissLogistikaPrintList } from "@/components/admin/iriss-logistika/IrissLogistikaPrintList";
import type { LogisticsPrintRow } from "@/lib/iriss-logistics-map-print";
import { renderHtml, renderText } from "@/lib/test-render";

const row = (p: Partial<LogisticsPrintRow>): LogisticsPrintRow => ({
  id: "a",
  n: 1,
  car: "VW Passat",
  vin: "WVWZZZ3CZLE012345",
  place: "Openlane Bremen",
  address: "Musterstraße 1, Bremen",
  hours: "P-Pk 7:00-15:30",
  phone: "+49421111",
  pickupRef: "R-1",
  pickupDate: "2026-10-21",
  cargo: "Nākošā",
  ...p,
});

describe("Drukas 2. lapa (renderēts)", () => {
  it("rāda numurus secībā ar auto, VIN, vietu un darba laiku", () => {
    const text = renderText(
      <IrissLogistikaPrintList heading="IRISS Loģistika · Nākošā" meta="21.10 · 2 auto" rows={[row({}), row({ id: "b", n: 2, car: "BMW 520d" })]} />,
    );
    expect(text).toContain("IRISS Loģistika · Nākošā");
    expect(text).toMatch(/1 VW Passat WVWZZZ3CZLE ?012345 Nākošā Openlane Bremen Musterstraße 1, Bremen/);
    expect(text).toContain("P-Pk 7:00-15:30");
    expect(text.indexOf("VW Passat")).toBeLessThan(text.indexOf("BMW 520d"));
    expect(text).not.toContain("€");
  });

  it("tukšs saraksts: paskaidrojums, nav tabulas", () => {
    const html = renderHtml(<IrissLogistikaPrintList heading="x" meta="y" rows={[]} />);
    expect(html).toContain("Kartē nav auto ar adresi.");
    expect(html).not.toContain("<table");
  });
});

describe("Liels VIN šoferim (Nils 18.11)", () => {
  it("pēdējās 6 zīmes ir atsevišķi izceltas, VIN paliek viens nolasāms", () => {
    expect(splitVinTail(" wvwzzz3czle012345 ")).toEqual({ head: "WVWZZZ3CZLE", tail: "012345" });
    expect(splitVinTail("AB12")).toEqual({ head: "", tail: "AB12" });
    const html = renderHtml(<IrissLogistikaPrintList heading="x" meta="y" rows={[row({})]} />);
    expect(html).toContain('<span class="vin-tail">012345</span>');
    expect(html).toContain('data-vin="WVWZZZ3CZLE012345"');
    expect(html).toContain('class="vin mono"');
  });

  it("bez VIN nekā nerāda", () => {
    expect(renderHtml(<BigVin vin="  " />)).toBe("");
    const html = renderHtml(<IrissLogistikaPrintList heading="x" meta="y" rows={[row({ vin: "" })]} />);
    expect(html).not.toContain("vin-tail");
  });
});
