import { describe, expect, it } from "vitest";

import { AdminDealerForecastRow } from "@/components/admin/AdminDealerForecastRow";
import { renderHtml } from "@/lib/test-render";

describe("AdminDealerForecastRow", () => {
  it("BMW: «Dīlera dati: OneAuto augsta (BMW 66/68) · CheckThisReg augsta · auto-records augsta»", () => {
    const html = renderHtml(<AdminDealerForecastRow make="BMW" vin="WBA8A71070K000000" />);
    const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(text).toContain("Dīlera dati:");
    expect(text).toContain("OneAuto augsta (BMW 66/68)");
    expect(text).toContain("CheckThisReg augsta");
    expect(text).toContain("auto-records augsta");
    expect(html).toContain('data-dealer-forecast="oneauto,checkthisreg,autorecords"');
    expect(html).toContain("text-emerald-700");
  });

  it("pēc OneAuto «datu nav» izceļ ieteicamo nākamo avotu", () => {
    const html = renderHtml(
      <AdminDealerForecastRow
        blocks={{ csdd: { makeModel: "MERCEDES-BENZ E 220", registry: { data: { make: "MERCEDES-BENZ", year: "2010" } } } }}
        vin="WDD2120021A000000"
        oneautoNoData
      />,
    );
    expect(html).toContain('data-forecast-level="no_data"');
    expect(html).toMatch(/data-forecast-source="autorecords"[^>]*data-forecast-next="1"/);
    expect(html.replace(/<[^>]+>/g, "")).toContain("datu nav");
  });

  it("Volvo: auto-records pirmais; zema - sarkans", () => {
    const html = renderHtml(<AdminDealerForecastRow make="Volvo" year={2021} vin="YV1ZZZ00000000000" />);
    expect(html).toContain('data-dealer-forecast="autorecords,oneauto,checkthisreg"');
    expect(html).toMatch(/data-forecast-source="oneauto"[^>]*data-forecast-level="zema"/);
    expect(html).toContain("text-red-700");
  });

  it("nezināma marka - pelēks «nav zināms»", () => {
    const html = renderHtml(<AdminDealerForecastRow make="Lada" />);
    expect(html).toContain('data-forecast-level="nav zināms"');
    expect(html).toContain("text-slate-500");
  });
});
