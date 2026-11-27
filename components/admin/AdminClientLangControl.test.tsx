import { describe, expect, it } from "vitest";

import {
  AdminClientLangChip,
  AdminClientLangControlContext,
  AdminClientLangSegments,
  type AdminClientLangControl,
} from "@/components/admin/AdminClientLangControl";
import { decideOrderClientLang } from "@/lib/client-lang-detect";
import { toAdminOrderDetailClientModel } from "@/lib/admin-order-detail-client-model";
import { renderHtml } from "@/lib/test-render";

function ctl(over: Partial<AdminClientLangControl> = {}): AdminClientLangControl {
  return {
    decision: decideOrderClientLang({ locale: "en", signals: { ipCountry: "LV", orderPlate: "AB1234" } }),
    locked: false,
    busy: false,
    setLang: () => undefined,
    ...over,
  };
}

function render(node: React.ReactNode, value: AdminClientLangControl | null) {
  return renderHtml(<AdminClientLangControlContext.Provider value={value}>{node}</AdminClientLangControlContext.Provider>);
}

describe("Klienta valodas izvēle (Nils 27.11)", () => {
  it("čips rāda valodu un iemeslu", () => {
    const html = render(<AdminClientLangChip />, ctl());
    expect(html).toContain("Klienta valoda: LV");
    expect(html).toContain("pēc: IP LV, LV numurs");
  });

  it("vietnes valoda - bez iemesla teksta; manuāli - «manuāli»", () => {
    expect(render(<AdminClientLangChip />, ctl({ decision: decideOrderClientLang({ locale: "en" }) }))).not.toContain("pēc:");
    expect(render(<AdminClientLangChip />, ctl({ decision: decideOrderClientLang({ locale: "en", override: "de" }) }))).toContain(
      "manuāli",
    );
  });

  it("partnera fiksēta valoda vai bez konteksta - nerāda", () => {
    expect(render(<AdminClientLangChip />, ctl({ locked: true }))).toBe("");
    expect(render(<AdminClientLangSegments />, null)).toBe("");
  });

  it("logā četras valodas, izvēlētā atzīmēta", () => {
    const html = render(<AdminClientLangSegments />, ctl());
    for (const l of ["LV", "EN", "RU", "DE"]) expect(html).toContain(`>${l}<`);
    expect(html).toMatch(/aria-checked="true"[^>]*>LV</);
  });

  it("pasūtījuma modelis nodod tikai valstu kodus", () => {
    const m = toAdminOrderDetailClientModel({ id: "cs_1", clientLangSignals: { ipCountry: "lv", ip: "1.2.3.4" } });
    expect(m.clientLangSignals).toEqual({ ipCountry: "LV" });
    expect(toAdminOrderDetailClientModel({ id: "cs_1" }).clientLangSignals).toBeUndefined();
  });
});
