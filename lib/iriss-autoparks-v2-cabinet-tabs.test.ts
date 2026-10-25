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

describe("allowedTabs (j63 CSDD cilne)", () => {
  it("ar Pamatdatu tiesību rāda Pamatdati un CSDD reģistrs", () => {
    expect(allowedTabs({ ...NONE, pamatdati: true }, ALL_PANES)).toEqual(["pamatdati", "csdd"]);
  });

  it("CSDD nav atsevišķa pane atkarība - pietiek ar pamatdati", () => {
    expect(allowedTabs({ ...NONE, pamatdati: true }, {})).toEqual(["pamatdati", "csdd"]);
  });

  it("bez Pamatdatiem CSDD nerāda, pārējās cilnes paliek pēc pane + tiesībām", () => {
    expect(allowedTabs({ ...NONE, iegade: true, cenuLapa: true }, ALL_PANES)).toEqual(["iegade", "cenu_lapa"]);
  });

  it("admins ar visām pane redz secību: Pamatdati, CSDD, Iegāde, Serviss, Izdevumi, Cenu lapa", () => {
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
    expect(allowedTabs(admin, ALL_PANES)).toEqual(["pamatdati", "csdd", "iegade", "serviss", "izdevumi", "cenu_lapa"]);
  });
});

describe("resolveCabinetTab (?t=)", () => {
  const tabs = ["pamatdati", "csdd", "iegade"] as const;

  it("?t=csdd atver CSDD cilni", () => {
    expect(resolveCabinetTab("csdd", tabs, false)).toBe("csdd");
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
