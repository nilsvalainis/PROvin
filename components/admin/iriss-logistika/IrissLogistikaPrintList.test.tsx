import { describe, expect, it } from "vitest";
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
    expect(text).toMatch(/1 VW Passat WVWZZZ3CZLE012345 Nākošā Openlane Bremen Musterstraße 1, Bremen/);
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
