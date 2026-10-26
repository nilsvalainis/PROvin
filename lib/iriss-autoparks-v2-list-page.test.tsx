import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoparksV2PermsFor, type AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import type { IrissSection } from "@/lib/staff-roles";

const nav = vi.hoisted(() => ({ redirects: [] as string[] }));
let perms: AutoparksV2Perms | null = null;

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    nav.redirects.push(url);
    throw new Error(`REDIRECT ${url}`);
  },
  useRouter: () => ({}),
}));
vi.mock("@/lib/iriss-autoparks-v2-access", () => ({
  getAutoparksV2PageActor: async () => (perms ? { actor: { kind: "staff" }, perms } : null),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({ getIrissLogisticsStorageState: () => ({ enabled: false }) }));
vi.mock("@/lib/iriss-autoparks-store", () => ({ readAutoparksState: async () => null }));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({ readAutoparksV2State: async () => null }));

const { default: AutoparksV2Page } = await import("@/app/admin/iriss/autoparks-v2/page");

function staff(sections: IrissSection[]): AutoparksV2Perms {
  return autoparksV2PermsFor({ kind: "staff", sections }, true);
}

describe("Autoparks v2 saraksta lapa (j69: cilne atveras, nevis atjauno sākumu)", () => {
  beforeEach(() => {
    nav.redirects.length = 0;
  });

  it("darbinieks tikai ar Servisu atver sarakstu bez + Auto", async () => {
    perms = staff(["ap_serviss"]);
    const el = (await AutoparksV2Page()) as { props: { canAddCar: boolean } };
    expect(nav.redirects).toEqual([]);
    expect(el.props.canAddCar).toBe(false);
  });

  it("ar Pamatdatiem + Auto ir", async () => {
    perms = staff(["ap_pamatdati", "ap_serviss"]);
    const el = (await AutoparksV2Page()) as { props: { canAddCar: boolean } };
    expect(el.props.canAddCar).toBe(true);
  });

  it("bez nevienas kabineta tiesības - uz sākumu", async () => {
    perms = null;
    await expect(AutoparksV2Page()).rejects.toThrow("REDIRECT /admin/iriss");
  });
});
