import { describe, expect, it } from "vitest";
import {
  buildIrissMonthlyReport,
  formatIrissMonthlyReportCsv,
  IRISS_MONTHLY_REPORT_TENANT_MODE,
  resolveIrissReportMonth,
  type IrissMonthlyOrderInput,
} from "@/lib/iriss-monthly-report";

function rec(partial: IrissMonthlyOrderInput): IrissMonthlyOrderInput {
  return partial;
}

describe("iriss-monthly-report", () => {
  it("resolves month from query or current Riga month", () => {
    expect(resolveIrissReportMonth("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(resolveIrissReportMonth("bad", Date.parse("2026-10-13T08:00:00.000+03:00"))).toEqual({
      year: 2026,
      month: 10,
    });
  });

  it("counts orders and offers in the Riga month without PROVIN VIN fields", () => {
    const report = buildIrissMonthlyReport(
      [
        rec({
          id: "o1",
          createdAt: "2026-10-02T10:00:00.000Z",
          listStatus: "active",
          clientFirstName: "Anna",
          clientLastName: "Bērziņa",
          brandModel: "BMW X3",
          offers: [
            { id: "of1", createdAt: "2026-10-05T12:00:00.000Z" },
            { id: "of2", createdAt: "2026-09-20T12:00:00.000Z", updatedAt: "2026-10-08T09:00:00.000Z" },
          ],
        }),
        rec({
          id: "o2",
          createdAt: "2026-09-15T10:00:00.000Z",
          listStatus: "completed",
          offers: [{ id: "old", createdAt: "2026-09-16T10:00:00.000Z" }],
        }),
        rec({
          id: "o3",
          createdAt: "2026-10-20T10:00:00.000Z",
          listStatus: "completed",
          clientFirstName: "Pēteris",
        }),
        rec({
          id: "o4",
          createdAt: "2026-10-22T10:00:00.000Z",
          listStatus: "inactive",
        }),
      ],
      2026,
      10,
    );

    expect(report.tenantMode).toBe(IRISS_MONTHLY_REPORT_TENANT_MODE);
    expect(report.monthKey).toBe("2026-10");
    expect(report.monthLabel).toBe("2026. gada oktobris");
    expect(report.ordersCreated).toBe(3);
    expect(report.ordersByStatus).toEqual({ active: 1, completed: 1, inactive: 1 });
    expect(report.offersCreated).toBe(1);
    expect(report.offersUpdated).toBe(1);
    expect(report.ordersWithOffers).toBe(1);
    expect(report.pdfGenerationsTracked).toBe(false);
    expect(report.rows.map((r) => r.id)).toEqual(["o4", "o3", "o1"]);
    expect(report.rows[2]).toMatchObject({
      id: "o1",
      clientName: "Anna Bērziņa",
      brandModel: "BMW X3",
      offerCount: 2,
      offersCreatedInMonth: 1,
    });
    expect(JSON.stringify(report)).not.toMatch(/VIN|audit|Stripe/i);
    expect(report.rows.find((r) => r.id === "o4")?.clientName).toBe("Bez vārda");
  });

  it("exports a CSV summary without VIN or audit columns", () => {
    const csv = formatIrissMonthlyReportCsv(
      buildIrissMonthlyReport(
        [
          rec({
            id: "csv1",
            createdAt: "2026-10-03T10:00:00.000Z",
            clientFirstName: "Līga",
            brandModel: "Golf, 1.5",
            offers: [{ id: "x", createdAt: "2026-10-04T10:00:00.000Z" }],
          }),
        ],
        2026,
        10,
      ),
    );
    expect(csv).toContain("2026. gada oktobris");
    expect(csv).toContain("single-tenant");
    expect(csv).toContain("Pasūtījumi (izveidoti mēnesī),1");
    expect(csv).toContain("Piedāvājumi (izveidoti mēnesī),1");
    expect(csv).toContain("nav uzskaitīta datos");
    expect(csv).toContain("\"Golf, 1.5\"");
    expect(csv).not.toMatch(/\bVIN\b/);
    expect(csv).not.toMatch(/audit/i);
  });
});
