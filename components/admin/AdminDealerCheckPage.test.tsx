import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminDealerCheckCsddPreview, AdminDealerCheckPage } from "@/components/admin/AdminDealerCheckPage";
import { dealerCheckEmptyStateText, dealerCheckPageHref, DEALER_CHECK_PAGE_PATH, type DealerCheckRecord } from "@/lib/dealer-check";
import type { DealerCheckHistoryEntry } from "@/lib/dealer-check-history";
import { DEALER_CHECK_MANUAL_ORDER_LABEL } from "@/lib/dealer-check-manual-order";
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
    expect(text).not.toContain(DEALER_CHECK_MANUAL_ORDER_LABEL);
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
    expect(text).not.toContain(DEALER_CHECK_MANUAL_ORDER_LABEL);
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
    expect(text).toContain(DEALER_CHECK_MANUAL_ORDER_LABEL);
    const createBtn = html.match(/<button[^>]*data-dealer-check-create-order[^>]*>/);
    expect(createBtn?.[0]).toBeTruthy();
    expect(createBtn?.[0]).not.toMatch(/\sdisabled[=\s>]/);
    expect(text).not.toContain("Gemini: Servisa vēsture");
    expect(text).not.toContain("CSDD salīdzinājums");
    expect(text).not.toMatch(/speckr/i);
  });

  it("atsvaidzināta lapa rāda saglabāto pārbaudi, konvertētā nav noklusējuma sarakstā", () => {
    const openVin = VIN;
    const convertedVin = "WF0XXXGCDX1234567";
    const saved: DealerCheckRecord = {
      id: "dc-refresh-open1",
      vin: openVin,
      plate: "LR-4521",
      template: "dzintarzeme",
      selectedProducts: ["vin_decoder"],
      results: { vin_decoder: { ok: true, payload: { make: "BMW" }, httpStatus: 200 } },
      display: { equipment: [], serviceTimeline: [], powertrain: [] },
      displayOriginal: { equipment: [], serviceTimeline: [], powertrain: [] },
      vehicle: {
        make: "BMW",
        model: "320d",
        body: "",
        engine: "",
        firstReg: "",
        color: "",
        gearbox: "",
        manufacturer: "",
        vin: openVin,
      },
      mileageRows: [],
      serviceRows: [],
      comments: { serviceHistory: "Serviss saglabāts.", oilIntervals: "Eļļa saglabāta." },
      csdd: null,
      csddSnapshot: sampleCsdd(),
      chargedCents: 18,
      quotedCents: 18,
      fetchedAt: "2026-11-02T10:00:00.000Z",
      monthKey: "2026-11",
      autoparks: { carId: "ap-1", title: "BMW 320d", stockPath: "/STOCK", dropboxFolderId: "id:1" },
      saved: true,
      createdAt: "2026-11-02T10:00:00.000Z",
      updatedAt: "2026-11-02T10:00:00.000Z",
      createdBy: "env-admin",
      status: "open",
    };
    const openRow: DealerCheckHistoryEntry = {
      id: saved.id,
      vin: openVin,
      plate: "LR-4521",
      template: "dzintarzeme",
      createdAt: saved.createdAt,
      fetchedAt: saved.fetchedAt,
      createdBy: "env-admin",
      status: "open",
      orderId: "",
      chargedCents: 18,
      hasData: true,
      autoparksTitle: "BMW 320d",
    };
    const convertedRow: DealerCheckHistoryEntry = {
      ...openRow,
      id: "dc-refresh-conv1",
      vin: convertedVin,
      status: "converted",
      orderId: "ord_1",
    };
    const html = renderHtml(
      <AdminDealerCheckPage initialVin={openVin} initialPlate="LR-4521" initialRecord={saved} initialEntries={[convertedRow, openRow]} />,
    );
    const text = renderText(
      <AdminDealerCheckPage initialVin={openVin} initialPlate="LR-4521" initialRecord={saved} initialEntries={[convertedRow, openRow]} />,
    );
    expect(html).toContain('data-dealer-check-history-row="dc-refresh-open1"');
    expect(html).not.toContain('data-dealer-check-history-row="dc-refresh-conv1"');
    expect(text).toContain("Saglabātās pārbaudes");
    expect(text).toContain("Eksportēt CSV");
    expect(text).toContain("Datums no");
    expect(text).toContain("Pasūtījums");
    expect(text).toContain("Šablons");
    expect(text).toContain("Serviss saglabāts.");
    expect(text).toContain(openVin);
    expect(text).not.toContain(convertedVin);
    expect(text).toContain(DEALER_CHECK_CSDD_TITLE);
  });

  it("Saglabātās pārbaudes ar 3 no 3 ir zem meklēšanas, ne virs tās", () => {
    const rows: DealerCheckHistoryEntry[] = [
      {
        id: "dc-order-open1",
        vin: VIN,
        plate: "LR-4521",
        template: "dzintarzeme",
        createdAt: "2026-11-02T10:00:00.000Z",
        fetchedAt: "2026-11-02T10:00:00.000Z",
        createdBy: "env-admin",
        status: "open",
        orderId: "",
        chargedCents: 18,
        hasData: true,
        autoparksTitle: "",
      },
      {
        id: "dc-order-open2",
        vin: "WVWZZZ3CZKE012345",
        plate: "AB-1234",
        template: "cits",
        createdAt: "2026-11-03T10:00:00.000Z",
        fetchedAt: "2026-11-03T10:00:00.000Z",
        createdBy: "env-admin",
        status: "open",
        orderId: "",
        chargedCents: 0,
        hasData: true,
        autoparksTitle: "",
      },
      {
        id: "dc-order-open3",
        vin: "WF0XXXGCDX1234567",
        plate: "CD-5678",
        template: "dzintarzeme",
        createdAt: "2026-11-04T10:00:00.000Z",
        fetchedAt: "2026-11-04T10:00:00.000Z",
        createdBy: "env-admin",
        status: "open",
        orderId: "",
        chargedCents: 18,
        hasData: true,
        autoparksTitle: "",
      },
    ];
    const html = renderHtml(<AdminDealerCheckPage initialVin="" initialEntries={rows} />);
    const text = renderText(<AdminDealerCheckPage initialVin="" initialEntries={rows} />);
    const historyAt = html.indexOf("data-dealer-check-history");
    const searchAt = html.indexOf(">Meklēšana<");
    const templateAt = html.indexOf("Šablons");
    const emptyAt = html.indexOf(dealerCheckEmptyStateText());
    expect(historyAt).toBeGreaterThan(-1);
    expect(searchAt).toBeGreaterThan(-1);
    expect(templateAt).toBeGreaterThan(-1);
    expect(historyAt).toBeGreaterThan(searchAt);
    expect(historyAt).toBeGreaterThan(templateAt);
    expect(historyAt).toBeGreaterThan(emptyAt);
    expect(text).toContain("Saglabātās pārbaudes");
    expect(text).toContain("3 no 3");
    expect(html).toContain('data-dealer-check-history-row="dc-order-open1"');
    expect(html).toContain('data-dealer-check-history-row="dc-order-open2"');
    expect(html).toContain('data-dealer-check-history-row="dc-order-open3"');
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
