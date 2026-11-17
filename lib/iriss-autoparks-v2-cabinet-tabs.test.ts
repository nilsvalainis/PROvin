import { describe, expect, it } from "vitest";
import { allowedTabs, resolveCabinetTab } from "@/lib/iriss-autoparks-v2-cabinet-tabs";
import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";

const NONE: AutoparksV2Perms = {
  admin: false,
  pamatdati: false,
  iegade: false,
  serviss: false,
  izdevumi: false,
  cenuLapa: false,
  summas: false,
  pasizmaksa: false,
  vesture: false,
};

const ALL_PANES = { iegade: 1, serviss: 1, izdevumi: 1, cenu_lapa: 1 };

describe("allowedTabs (Nils 27.10: CSDD Pamatdatos, bez Izdevumiem)", () => {
  it("ar Pamatdatu tiesību - viena cilne Pamatdati (CSDD reģistrs tajā)", () => {
    expect(allowedTabs({ ...NONE, pamatdati: true }, ALL_PANES)).toEqual(["pamatdati"]);
    expect(allowedTabs({ ...NONE, pamatdati: true }, {})).toEqual(["pamatdati"]);
  });

  it("bez Pamatdatiem CSDD nerāda, pārējās cilnes paliek pēc pane + tiesībām", () => {
    expect(allowedTabs({ ...NONE, iegade: true, cenuLapa: true }, ALL_PANES)).toEqual(["iegade", "cenu_lapa"]);
  });

  it("admins: Pamatdati, Dokumenti, Serviss, Cenu lapa (Izdevumi paslēpti)", () => {
    const admin: AutoparksV2Perms = {
      admin: true,
      pamatdati: true,
      iegade: true,
      serviss: true,
      izdevumi: true,
      cenuLapa: true,
      summas: true,
      pasizmaksa: true,
      vesture: true,
    };
    expect(allowedTabs(admin, ALL_PANES)).toEqual(["pamatdati", "iegade", "serviss", "cenu_lapa"]);
  });
});

describe("resolveCabinetTab (?t=)", () => {
  const tabs = ["pamatdati", "iegade"] as const;

  it("vecā saite ?t=csdd atver Pamatdatus (CSDD reģistrs tajos)", () => {
    expect(resolveCabinetTab("csdd", tabs, false)).toBe("pamatdati");
  });

  it("nezināms ?t= krīt uz pirmo atļauto", () => {
    expect(resolveCabinetTab("cenu_lapa", tabs, false)).toBe("pamatdati");
    expect(resolveCabinetTab(null, tabs, false)).toBe("pamatdati");
  });

  it("?t=vesture tikai ar vesture tiesību", () => {
    expect(resolveCabinetTab("vesture", tabs, true)).toBe("vesture");
    expect(resolveCabinetTab("vesture", tabs, false)).toBe("pamatdati");
  });
});
