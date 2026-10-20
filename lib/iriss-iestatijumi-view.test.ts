import { describe, expect, it } from "vitest";
import { MARKETPLACE_LOADS_DISABLED_REASON } from "@/lib/marketplace/cost-caps";
import { defaultIrissTameCommissionSettings } from "@/lib/iriss-tame-commission";
import {
  IRISS_SETTINGS_DIRTY,
  IRISS_SETTINGS_LOADS_OFF,
  IRISS_SETTINGS_LOADS_ON,
  buildIrissSettingsLimitsView,
  formatIrissSettingsSpentMonth,
  irissSettingsCommissionDirty,
  irissSettingsDirtyDockTitle,
  irissSettingsDirtyFieldLabels,
} from "@/lib/iriss-iestatijumi-view";

describe("iriss settings view copy", () => {
  it("names the spent month in locative and formats USD with a comma", () => {
    expect(formatIrissSettingsSpentMonth("2026-10")).toBe("Izlietots oktobrī");
    expect(formatIrissSettingsSpentMonth("2026-01")).toBe("Izlietots janvārī");
    expect(formatIrissSettingsSpentMonth("")).toBe("Izlietots");
    const off = buildIrissSettingsLimitsView({
      monthlyCapUsd: 4.5,
      perRunCapUsd: 0.25,
      spentUsd: 0.01,
      loadsEnabled: false,
      monthKey: "2026-10",
    });
    expect(off.monthlyCapLabel).toBe("4,50 $");
    expect(off.perRunCapLabel).toBe("0,25 $");
    expect(off.spentValue).toBe("0,01 $");
    expect(off.spentLabel).toBe("Izlietots oktobrī");
    expect(off.loadsStatus).toBe(IRISS_SETTINGS_LOADS_OFF);
    expect(off.loadsStatus).toBe(MARKETPLACE_LOADS_DISABLED_REASON);
    const on = buildIrissSettingsLimitsView({
      monthlyCapUsd: 4.5,
      perRunCapUsd: 0.25,
      spentUsd: 0,
      loadsEnabled: true,
      monthKey: "2026-10",
    });
    expect(on.loadsStatus).toBe(IRISS_SETTINGS_LOADS_ON);
  });

  it("names the dirty commission field in the save dock", () => {
    const saved = defaultIrissTameCommissionSettings();
    const draft = { ...saved, variantANet: 1300 };
    expect(irissSettingsCommissionDirty(saved, saved)).toBe(false);
    expect(irissSettingsDirtyFieldLabels(saved, draft)).toEqual(["A variants"]);
    expect(irissSettingsDirtyDockTitle(["A variants"])).toBe(`${IRISS_SETTINGS_DIRTY} · A variants`);
    expect(irissSettingsDirtyDockTitle(["A variants", "B variants, bāze"])).toBe(IRISS_SETTINGS_DIRTY);
    expect(irissSettingsDirtyDockTitle([])).toBe(IRISS_SETTINGS_DIRTY);
  });
});
