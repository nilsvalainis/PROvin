import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss monthly report layout", () => {
  it("keeps required copy and drops the sticky header and PDF grammar bug", () => {
    const view = readFileSync("components/admin/IrissMonthlyReportView.tsx", "utf8");
    const copy = readFileSync("lib/iriss-monthly-report-view.ts", "utf8");
    const page = readFileSync("app/admin/iriss/atskaite/page.tsx", "utf8");
    expect(view).toContain("Lejupielādēt CSV");
    expect(view).toContain("IRISS_REPORT_ABOUT_TITLE");
    expect(copy).toContain("Par atskaiti");
    expect(copy).toContain("Nav datu");
    expect(view).toContain("Šajā mēnesī nav jaunu IRISS pasūtījumu.");
    expect(view).not.toMatch(/nav datos/i);
    expect(view).not.toMatch(/sticky top-0/);
    expect(view).not.toMatch(/\u2014|\u2013/);
    expect(view).not.toContain("Single-tenant IRISS ops");
    expect(page).toContain("Melnraksts ir izslēgts");
    expect(page).toContain("Neizdevās ielādēt atskaiti");
    expect(page).not.toMatch(/#F8F8F9/);
    expect(page).not.toMatch(/\u2014|\u2013/);
  });
});
