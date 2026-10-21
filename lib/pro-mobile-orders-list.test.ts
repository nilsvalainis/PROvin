import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditDeadlineMs } from "@/lib/admin-audit-deadline";
import { formatAdminMobileDeadlineTag } from "@/lib/admin-mobile-ds";
import { adminOrderCardTitle } from "@/components/admin/AdminOrdersTable";

const HOUR = 60 * 60 * 1000;
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("PRO order card deadline tag", () => {
  const created = 1_760_000_000;
  const due = auditDeadlineMs(created);

  it("says Kavē in hours, then days from 48 h, never negative hours", () => {
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due + 5 * HOUR })).toEqual({ label: "Kavē 5 h", tone: "overdue" });
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due + 3625 * HOUR })).toEqual({ label: "Kavē 151 d", tone: "overdue" });
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due + 30 * 60_000 }).label).toBe("Kavē 1 h");
  });

  it("says Atlikušas before the deadline and Gatavs when complete", () => {
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due - 12 * HOUR })).toEqual({ label: "Atlikušas 12 h", tone: "ok" });
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due - 2 * HOUR }).tone).toBe("urgent");
    expect(formatAdminMobileDeadlineTag(created, { nowMs: due - 20 * 60_000 }).label).toBe("Atlikušas 20 min");
    expect(formatAdminMobileDeadlineTag(created, { complete: true, nowMs: due + 99 * HOUR })).toEqual({ label: "Gatavs", tone: "done" });
  });
});

describe("PRO order card title", () => {
  it("never shows only '-' and is not upper-cased", () => {
    expect(adminOrderCardTitle("BMW X5 xDrive30d", { primaryClient: "-", vin: "", hasVin: false })).toBe("BMW X5 xDrive30d");
    expect(adminOrderCardTitle("", { primaryClient: "Jānis", vin: "", hasVin: false })).toBe("Jānis");
    expect(adminOrderCardTitle(null, { primaryClient: "-", vin: "WBA123", hasVin: true })).toBe("WBA123");
    expect(adminOrderCardTitle(null, { primaryClient: "-", vin: "", hasVin: false })).toBe("Pasūtījums bez datiem");
  });
});

describe("PRO order list chrome on phones", () => {
  const table = read("components/admin/AdminOrdersTable.tsx");

  it("has one chip row with Neapmaksāti instead of a second switch row", () => {
    expect(table).toContain('...(showUnpaidViewSwitch ? [{ id: "unpaid", label: "Neapmaksāti" }] : [])');
    expect(table).toContain("router.push(`${pathname}?view=unpaid`)");
  });

  it("names the header menu Darbības (not a second Vairāk) and makes + the primary button", () => {
    expect(table).toContain('<AdminMobileRoundBtn name="vairak" label="Darbības"');
    expect(table).toContain("max-md:[&_button]:bg-[var(--am-btn-primary-bg)]");
    expect(read("app/admin/admin-mobile.css")).toContain("--am-btn-primary-bg: rgba(31, 36, 48, 0.89);");
  });

  it("keeps export in the Darbības sheet on phones", () => {
    expect(table).toContain("<AdminOrdersExportButton variant=\"sheet\" />");
    expect(table).not.toContain(".toUpperCase()}");
  });
});
