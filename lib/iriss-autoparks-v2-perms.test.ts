import { describe, expect, it } from "vitest";
import { autoparksV2CanCategory, autoparksV2CanOpen, autoparksV2PermsFor, type AutoparksV2Category } from "@/lib/iriss-autoparks-v2-perms";
import { autoparksV2StaffEnabled } from "@/lib/iriss-autoparks-v2-flag";
import { IRISS_SECTIONS, staffNavSections, type IrissSection } from "@/lib/staff-roles";

const CATS: AutoparksV2Category[] = ["pamatdati", "iegade", "serviss", "izdevumi", "cenu_lapa"];

/** IETEIKUMI 6. sadaļas matrica: A..H. */
const ROLES: Record<string, IrissSection[] | "admin"> = {
  A: "admin",
  B: ["ap_pamatdati"],
  C: ["ap_pamatdati", "ap_serviss"],
  D: ["ap_pamatdati", "ap_serviss", "ap_summas"],
  E: ["ap_pamatdati", "ap_iegade", "ap_izdevumi", "ap_summas"],
  F: ["pavadzimes"],
  G: ["logistika"],
  H: IRISS_SECTIONS.filter((s) => !s.startsWith("ap_")),
};

function perms(role: string, enabled = true) {
  const r = ROLES[role]!;
  return autoparksV2PermsFor(r === "admin" ? { kind: "admin" } : { kind: "staff", sections: r }, enabled);
}

describe("Autoparks v2 tiesības", () => {
  it.each([
    ["A", { pamatdati: 1, iegade: 1, serviss: 1, izdevumi: 1, cenu_lapa: 1, summas: 1, pasizmaksa: 1, vesture: 1 }],
    ["B", { pamatdati: 1, iegade: 0, serviss: 0, izdevumi: 0, cenu_lapa: 0, summas: 0, pasizmaksa: 0, vesture: 0 }],
    ["C", { pamatdati: 1, iegade: 0, serviss: 1, izdevumi: 0, cenu_lapa: 0, summas: 0, pasizmaksa: 0, vesture: 0 }],
    ["D", { pamatdati: 1, iegade: 0, serviss: 1, izdevumi: 0, cenu_lapa: 0, summas: 1, pasizmaksa: 0, vesture: 0 }],
    ["E", { pamatdati: 1, iegade: 1, serviss: 0, izdevumi: 1, cenu_lapa: 0, summas: 1, pasizmaksa: 1, vesture: 0 }],
    ["F", { pamatdati: 0, iegade: 0, serviss: 0, izdevumi: 0, cenu_lapa: 0, summas: 0, pasizmaksa: 0, vesture: 0 }],
    ["G", { pamatdati: 0, iegade: 0, serviss: 0, izdevumi: 0, cenu_lapa: 0, summas: 0, pasizmaksa: 0, vesture: 0 }],
    ["H", { pamatdati: 0, iegade: 0, serviss: 0, izdevumi: 0, cenu_lapa: 0, summas: 0, pasizmaksa: 0, vesture: 0 }],
  ])("loma %s", (role, want) => {
    const p = perms(role);
    for (const c of CATS) expect([c, autoparksV2CanCategory(p, c)]).toEqual([c, want[c] === 1]);
    expect(p.summas).toBe(want.summas === 1);
    expect(p.pasizmaksa).toBe(want.pasizmaksa === 1);
    expect(p.vesture).toBe(want.vesture === 1);
  });

  it("kamēr karogs izslēgts, darbinieks neredz neko (arī ar visām ap_* tiesībām); admins redz visu", () => {
    const all = autoparksV2PermsFor({ kind: "staff", sections: [...IRISS_SECTIONS] }, false);
    expect(autoparksV2CanOpen(all)).toBe(false);
    expect(all.summas).toBe(false);
    expect(autoparksV2CanOpen(autoparksV2PermsFor({ kind: "admin" }, false))).toBe(true);
  });

  it("karogs ieslēdzas tikai ar IRISS_AUTOPARKS_V2_STAFF=1", () => {
    expect(autoparksV2StaffEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(autoparksV2StaffEnabled({ IRISS_AUTOPARKS_V2_STAFF: "true" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(autoparksV2StaffEnabled({ IRISS_AUTOPARKS_V2_STAFF: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("navigācijā Autoparks v2 ir viens punkts un tikai ar ieslēgtu karogu", () => {
    const secs: IrissSection[] = ["logistika", "ap_summas", "ap_serviss", "ap_pamatdati"];
    expect(staffNavSections(secs, false)).toEqual(["logistika"]);
    expect(staffNavSections(secs, true)).toEqual(["logistika", "ap_serviss"]);
    expect(staffNavSections(["ap_summas"], true)).toEqual([]);
  });
});

describe("Autoparks saite (v1 dzēsta 27.10)", () => {
  it("administrators un darbinieks ar ap_* atver v2; bez ap_* - nav ko atvērt", async () => {
    const { autoparksV2CanOpen } = await import("@/lib/iriss-autoparks-v2-perms");
    expect(autoparksV2CanOpen(autoparksV2PermsFor({ kind: "admin" }, false))).toBe(true);
    expect(autoparksV2CanOpen(autoparksV2PermsFor({ kind: "staff", sections: ["logistika", "ap_serviss"] }, true))).toBe(true);
    expect(autoparksV2CanOpen(autoparksV2PermsFor({ kind: "staff", sections: ["logistika"] }, true))).toBe(false);
  });
});
