import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));

import { IrissWaybillDesktopCreateForm } from "@/components/admin/IrissWaybillDesktopCreateForm";
import {
  applyWaybillAutoChoice,
  initialWaybillMobileForm,
  WAYBILL_FORM_DEFAULT_HOURS,
} from "@/lib/iriss-waybill-mobile-form";
import { renderHtml, renderText } from "@/lib/test-render";

const plates = [
  { plate: "B193-7" as const, busy: true },
  { plate: "B762-7" as const, busy: false },
  { plate: "B192-7" as const, busy: false },
];

function desktopForm(choice: "none" | "list" | "manual" = "none") {
  const auto = applyWaybillAutoChoice(initialWaybillMobileForm("B193-7"), choice);
  return (
    <IrissWaybillDesktopCreateForm
      plates={plates}
      plate="B193-7"
      onPlate={() => undefined}
      auto={auto}
      onAuto={() => undefined}
      tradeCars={[]}
      hoursPreset={WAYBILL_FORM_DEFAULT_HOURS}
      hoursOther=""
      onHoursPreset={() => undefined}
      onHoursOther={() => undefined}
      hoursChosen={WAYBILL_FORM_DEFAULT_HOURS}
      untilHint=""
      comment=""
      onComment={() => undefined}
      error={null}
      busy={false}
      onSubmit={() => undefined}
    />
  );
}

describe("pavadzīmes izveides forma datorā", () => {
  it("rāda Numuru, abas Auto izvēles, Derīgumu, Komentāru un Izveidot", () => {
    const html = renderHtml(desktopForm());
    const text = renderText(desktopForm());
    expect(html).toContain('data-waybill-desktop-create');
    for (const t of ["Numurs", "Auto", "No saraksta", "pieņemts tirdzniecībā", "Ar roku", "Derīgums", "Komentārs", "Izveidot pavadzīmi"]) {
      expect(text).toContain(t);
    }
    expect(html).toMatch(/aria-pressed="(true|false)"[^>]*>No saraksta/);
    expect(html).toMatch(/aria-pressed="(true|false)"[^>]*>Ar roku/);
    expect(html).not.toContain("Ja ievadīts VIN, Aivars meklē");
    expect(html).not.toContain('placeholder="17 zīmes"');
    expect([...text].some((c) => c.charCodeAt(0) === 8211 || c.charCodeAt(0) === 8212)).toBe(false);
  });

  it("No saraksta / Ar roku abi paliek redzami pēc izvēles", () => {
    const list = renderText(desktopForm("list"));
    const listHtml = renderHtml(desktopForm("list"));
    expect(list).toContain("No saraksta");
    expect(list).toContain("Ar roku");
    expect(list).toContain("Izvēlies auto");
    expect(listHtml).toMatch(/aria-pressed="true"[^>]*>No saraksta/);
    expect(listHtml).not.toContain('aria-label="VIN"');

    const manual = renderText(desktopForm("manual"));
    const manualHtml = renderHtml(desktopForm("manual"));
    expect(manual).toContain("No saraksta");
    expect(manual).toContain("Ar roku");
    expect(manualHtml).toContain('aria-label="Marka, modelis"');
    expect(manualHtml).toContain('aria-label="VIN"');
    expect(manualHtml).toMatch(/aria-pressed="true"[^>]*>Ar roku/);
  });
});
