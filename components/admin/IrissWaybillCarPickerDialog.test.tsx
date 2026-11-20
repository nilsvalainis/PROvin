import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// Portāls serverī neko nerenderē - testā saturs uzreiz, lai redzētu pašu logu.
vi.mock("@/components/admin/AdminBodyPortal", () => ({ AdminBodyPortal: ({ children }: { children: ReactNode }) => children }));

import {
  IrissWaybillCarPicker,
  IrissWaybillCarPickerDialog,
  IrissWaybillCarPickerPopup,
  waybillCarPickerHeading,
} from "@/components/admin/IrissWaybillMobileForm";
import type { WaybillTradeCar } from "@/lib/iriss-waybill-trade-cars";
import { renderHtml } from "@/lib/test-render";

const cars: WaybillTradeCar[] = Array.from({ length: 19 }, (_, i) => ({
  id: `c${i}`,
  brandModel: `Auto ${String(i + 1).padStart(2, "0")}`,
  vin: `WBA0000000000${String(i).padStart(4, "0")}`,
  year: "2020",
  statusLabel: "",
  accepted: true,
  owner: i === 18 ? "DZA" : "IRISS",
}));

describe("auto izvēle datorā (20.11: poga «Izvēlies auto» neko neatvēra)", () => {
  it("datora logs nav paslēpts datorā (bez md:hidden) un rāda visus 19 auto", () => {
    const html = renderHtml(
      <IrissWaybillCarPickerDialog {...waybillCarPickerHeading(cars, { isB192: false, fromAutoparks: false })} onClose={() => undefined}>
        <IrissWaybillCarPicker cars={cars} selected="" onChoose={() => undefined} inSheet />
      </IrissWaybillCarPickerDialog>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("data-waybill-car-dialog");
    expect(html).not.toContain("md:hidden");
    expect(html).toContain("Tirdzniecībā pieņemtie auto");
    expect((html.match(/WBA0000000000\d{4}/g) ?? []).length).toBe(19);
    // Saraksts ritinās loga iekšā (ierobežots augstums), meklēšana pielīp augšā.
    expect(html).toContain("max-h-[85dvh]");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain('data-in-sheet="true"');
  });

  it("telefonā (un serverī) paliek apakšējā lapa ar #1022 ritināšanu - tā ir tikai telefonam (md:hidden)", () => {
    const html = renderHtml(
      <IrissWaybillCarPickerPopup open cars={cars} isB192={false} fromAutoparks={false} selected="" onChoose={() => undefined} onClose={() => undefined} />,
    );
    expect(html).toContain("admin-sheet-root md:hidden");
    expect(html).toContain('data-in-sheet="true"');
    expect(html).not.toContain("data-waybill-car-dialog");
  });

  it("virsraksts un skaits: kopējais, B192-7 tikai DZA, Autoparka rezerve", () => {
    expect(waybillCarPickerHeading(cars, { isB192: false, fromAutoparks: false })).toEqual({ title: "Tirdzniecībā pieņemtie auto", subtitle: "19 auto" });
    expect(waybillCarPickerHeading(cars.slice(18), { isB192: true, fromAutoparks: false }).title).toBe("Dzintarzeme Auto - pieņemtie");
    expect(waybillCarPickerHeading(null, { isB192: false, fromAutoparks: false }).subtitle).toBe("Ielādē...");
    expect(waybillCarPickerHeading(cars, { isB192: false, fromAutoparks: true }).subtitle).toContain("CSDD reģistrs vēl nav nolasīts");
  });
});
