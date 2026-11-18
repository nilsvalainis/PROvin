import { describe, expect, it } from "vitest";
import { emptyAsvBlock } from "@/lib/asv-report";
import { buildUnifiedMileageTableHtml, PDF_MILEAGE_MILES_CONVERTED_NOTE } from "@/lib/client-report-html";

function asvWith(rows: { date: string; odometer: string; unit?: string }[]) {
  const b = emptyAsvBlock();
  b.mileage = rows.map((r) => ({ ...b.mileage[0]!, date: r.date, odometer: r.odometer, country: "ASV", unit: r.unit }));
  return b;
}

describe("PDF nobraukums: jūdzes (Nils B7)", () => {
  it("jūdzēs norādīts rādījums tabulā ir km un zem tabulas ir skaidrojums", () => {
    const html = buildUnifiedMileageTableHtml({
      csddForm: null,
      autoRecordsBlock: null,
      asvBlock: asvWith([
        { date: "10.05.2018", odometer: "10000", unit: "mi" },
        { date: "10.05.2019", odometer: "20000", unit: "mi" },
      ]),
    } as never);
    expect(html).toContain(PDF_MILEAGE_MILES_CONVERTED_NOTE);
    expect(html.replace(/\s/g, "")).toContain("32187");
  });

  it("bez jūdzēm skaidrojuma nav", () => {
    const html = buildUnifiedMileageTableHtml({
      csddForm: null,
      autoRecordsBlock: null,
      asvBlock: asvWith([
        { date: "10.05.2018", odometer: "10000", unit: "km" },
        { date: "10.05.2019", odometer: "20000", unit: "km" },
      ]),
    } as never);
    expect(html).not.toContain(PDF_MILEAGE_MILES_CONVERTED_NOTE);
  });
});
