import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_LABELS } from "@/components/admin/AdminSidebar";

describe("PRO sānjosla: Izsoļu portālu arhīvs", () => {
  it("ir PRO grupā un nav IRISS izvēlnē", () => {
    const pro = ADMIN_NAV_GROUPS.find((g) => g.title === ADMIN_NAV_LABELS.groupPro);
    const iriss = ADMIN_NAV_GROUPS.find((g) => g.title === ADMIN_NAV_LABELS.groupIriss);
    const item = pro?.items.find((i) => i.href === "/admin/izsolu-arhivs");
    expect(item?.label).toBe("Izsoļu portālu arhīvs");
    expect(iriss?.items.some((i) => i.href === "/admin/izsolu-arhivs")).toBe(false);
  });
});
