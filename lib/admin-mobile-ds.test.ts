import { describe, expect, it } from "vitest";
import { AUDIT_PREPARATION_DEADLINE_MS } from "@/lib/admin-audit-deadline";
import {
  ADMIN_MOBILE_AUDIT_FILTER_LABEL,
  ADMIN_MOBILE_VIN_SCAN_EVENT,
  adminMobileAuditFilterLabel,
  adminMobileIconUrl,
  adminMobileSourceStatusIcon,
  formatAdminMobileDeadlineHours,
  formatAdminMobileHoursLabel,
  formatAdminMobilePhone,
  formatIrissWaybillChip,
  irissWaybillUrgent,
  isAdminMobilePaidSourceKey,
} from "@/lib/admin-mobile-ds";

describe("admin-mobile-ds", () => {
  it("keeps concept filter labels and paid keys", () => {
    expect(adminMobileAuditFilterLabel("green")).toBe("Labi");
    expect(adminMobileAuditFilterLabel("orange")).toBe("Jāpēta");
    expect(ADMIN_MOBILE_AUDIT_FILTER_LABEL.red).toBe("Riski");
    expect(isAdminMobilePaidSourceKey("carvertical")).toBe(true);
    expect(isAdminMobilePaidSourceKey("csdd")).toBe(false);
    expect(adminMobileSourceStatusIcon("loaded")).toBe("avotsIeladets");
    expect(adminMobileIconUrl("pasutijumi")).toBe("/admin-mobile/icons/pasutijumi.svg");
    expect(ADMIN_MOBILE_VIN_SCAN_EVENT).toBe("provin-admin-mobile-vin-scan");
  });

  it("formats deadline as compact hours", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    const created = Math.floor((now - (AUDIT_PREPARATION_DEADLINE_MS - 12 * 3600_000)) / 1000);
    expect(formatAdminMobileDeadlineHours(created, now)).toBe("12 h");
    const overdue = Math.floor((now - (AUDIT_PREPARATION_DEADLINE_MS + 5 * 3600_000)) / 1000);
    expect(formatAdminMobileDeadlineHours(overdue, now)).toBe("-5 h");
  });

  it("formats IRISS waybill chips with make/model", () => {
    expect(formatIrissWaybillChip({ code: "B192-7", makeModel: "Audi A6", hoursLeft: 6 })).toBe("B192-7 Audi A6 6 h");
    expect(irissWaybillUrgent(6)).toBe(true);
    expect(irissWaybillUrgent(30)).toBe(false);
    expect(irissWaybillUrgent(null, "B1 6 h")).toBe(true);
  });

  it("formats mobile phone as grouped +371", () => {
    expect(formatAdminMobilePhone("+3712878268")).toBe("+371 28 782 68");
    expect(formatAdminMobilePhone("28782668")).toBe("+371 28 782 668");
  });

  it("formats compact hours", () => {
    expect(formatAdminMobileHoursLabel(20 * 3600_000)).toBe("20 h");
    expect(formatAdminMobileHoursLabel(-2 * 3600_000)).toBe("-2 h");
  });
});
