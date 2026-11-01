import { describe, expect, it } from "vitest";
import { AdminDealerCheckCsddPreview, AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { dealerCheckEmptyStateText, dealerCheckPageHref, DEALER_CHECK_PAGE_PATH } from "@/lib/dealer-check";
import { DEALER_CHECK_CSDD_TITLE } from "@/lib/dealer-check-csdd";
import { emptyCsddTechData, type CsddTechData } from "@/lib/csdd-tech-data";
import { renderHtml, renderText } from "@/lib/test-render";

const VIN = "WBA8A71070K896936";

function sampleCsdd(): CsddTechData {
  return {
    ...emptyCsddTechData(),
    registrationNumber: "LR4521",
    vin: VIN,
    make: "BMW",
    model: "320d",
    year: "2016",
    fuel: "Dīzeļdegviela",
    powerKw: "140",
    displacementCm3: "1995",
    firstRegistrationIso: "2016-03-12",
    color: "Pelēka",
    vehicleKind: "Vieglais plašlietojuma",
    cocCategory: "M1",
    cocType: "3T",
    cocApprovalNumber: "e1*2007/46*0317*20",
    grossMassKg: "2000",
    curbMassKg: "1500",
    insuranceEndIso: "2026-12-01",
    inspectionValidUntilIso: "2027-05-14",
  };
}

describe("AdminDealerCheckPage", () => {
  it("sākumā avoti ir izslēgti, Ielādēt neaktīvs, rezultātu nav", () => {
    const html = renderHtml(<AdminDealerCheckPage initialVin="" />);
    const text = renderText(<AdminDealerCheckPage initialVin="" />);
    expect(text).toContain("Dīlera datu pārbaude");
    expect(text).toContain("noklusējumā visi izslēgti");
    expect(text).toContain("VIN Decoder");
    expect(text).toContain("OE Service History");
    expect(text).not.toMatch(/speckr/i);
    expect(html).toContain("disabled");
    expect(text).toContain(dealerCheckEmptyStateText());
    expect(text).not.toContain("Gemini: Servisa vēsture");
    expect(text).not.toContain("CSDD salīdzinājums");
    expect(text).not.toContain(DEALER_CHECK_CSDD_TITLE);
  });

  it("Autoparks deep-link atstāj avotus izslēgtus un rāda VIN", () => {
    const vin = "WVWZZZ3CZKE012345";
    const html = renderHtml(<AdminDealerCheckPage initialVin={vin} fromAutoparks />);
    const text = renderText(<AdminDealerCheckPage initialVin={vin} fromAutoparks />);
    expect(html).toContain(`value="${vin}"`);
    expect(text).toContain("VIN iekopēts no Autoparks");
    expect(text).toContain("Avoti paliek izslēgti");
    expect(text).toContain("noklusējumā visi izslēgti");
    expect(html).toContain("disabled");
    expect(dealerCheckPageHref({ vin, from: "autoparks" })).toBe(
      `${DEALER_CHECK_PAGE_PATH}?vin=${vin}&no=autoparks`,
    );
  });

  it("CSDD bloks redzams pirms dīlera ielādes, Ielādēt paliek izslēgts", () => {
    const csdd = sampleCsdd();
    const html = renderHtml(
      <AdminDealerCheckPage initialVin={VIN} initialPlate="LR-4521" initialCsdd={csdd} />,
    );
    const text = renderText(
      <AdminDealerCheckPage initialVin={VIN} initialPlate="LR-4521" initialCsdd={csdd} />,
    );
    expect(html).toContain(`value="${VIN}"`);
    expect(html).toContain('value="LR-4521"');
    expect(html).toContain("data-dealer-check-csdd-preview");
    expect(html).toContain("disabled");
    expect(text).toContain(DEALER_CHECK_CSDD_TITLE);
    expect(text).toContain("Pirms OneAuto");
    expect(text).toContain(VIN);
    expect(text).toContain("BMW 320d");
    expect(text).toContain("Dīzeļdegviela");
    expect(text).toContain("Vieglais plašlietojuma");
    expect(text).toContain("e1*2007/46*0317*20");
    expect(text).toContain(dealerCheckEmptyStateText());
    expect(text).not.toContain("Gemini: Servisa vēsture");
    expect(text).not.toContain("CSDD salīdzinājums");
    expect(text).not.toMatch(/speckr/i);
  });

  it("CSDD priekšskatījums rāda reģistra laukus, ne 4 lauku stub", () => {
    const text = renderText(<AdminDealerCheckCsddPreview data={sampleCsdd()} />);
    expect(text).toContain(DEALER_CHECK_CSDD_TITLE);
    expect(text).toContain("Marka, modelis");
    expect(text).toContain("Reģistrācijas numurs");
    expect(text).toContain("Motora tilpums");
    expect(text).toContain("Motora maksimālā jauda");
    expect(text).toContain("OCTA polise derīga līdz");
    expect(text).toContain("Nākamās apskates datums");
    expect(text).toContain("Pilna masa");
    expect(text).toContain("Pašmasa");
    expect(text).not.toContain("CSDD salīdzinājums");
  });
});
