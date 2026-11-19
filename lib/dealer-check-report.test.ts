import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { OneautoDisplaySections } from "@/lib/oneauto-catalog";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import {
  applyDealerCheckBrandHeader,
  buildDealerCheckReportHtml,
  buildDealerCheckReportPayload,
  dealerCheckDzaEmailHtml,
  dealerCheckEmailDefaults,
  dealerCheckReportFilename,
} from "@/lib/dealer-check-report";
import { dealerCheckDealerFacts } from "@/lib/dealer-check-delivery";

const VIN = "WBA8A71070K896936";

function display(): OneautoDisplaySections {
  return {
    equipment: [],
    powertrain: [
      { label: "make", value: "BMW" },
      { label: "model", value: "320d" },
    ],
    serviceTimeline: [
      { date: "18.10.2024", odometer: "203900", place: "LV · Rīga", works: "Eļļas serviss" },
      { date: "02.03.2023", odometer: "180100", place: "DE · München", works: "Sajūgs un divmasu spararats nomainīts" },
    ],
  };
}

function record(patch: Partial<DealerCheckRecord> = {}): DealerCheckRecord {
  return {
    id: "dc-test-report-1",
    vin: VIN,
    plate: "LR-4521",
    template: "dzintarzeme",
    selectedProducts: ["oe_service_history"],
    results: {},
    display: display(),
    displayOriginal: display(),
    vehicle: {
      make: "BMW",
      model: "320d",
      body: "",
      engine: "",
      firstReg: "",
      color: "",
      gearbox: "",
      manufacturer: "",
      vin: VIN,
    },
    mileageRows: [],
    serviceRows: [],
    comments: { serviceHistory: "Regulāri apkopts.", oilIntervals: "Ik 15 000 km." },
    csdd: null,
    chargedCents: 300,
    quotedCents: 300,
    fetchedAt: "2026-11-19T10:00:00.000Z",
    monthKey: "2026-11",
    autoparks: null,
    saved: true,
    createdAt: "2026-11-19T10:00:00.000Z",
    updatedAt: "2026-11-19T10:00:00.000Z",
    ...patch,
  };
}

const LOGO = "data:image/png;base64,AAAA";

describe("dīlera datu servera PDF HTML", () => {
  it("ir dīlera-only atskaite ar servisa datiem", () => {
    const p = buildDealerCheckReportPayload(record());
    expect(p.pdfReportKind).toBe("dealer");
    expect(p.vin).toBe(VIN);
    expect(p.autoRecordsBlock?.serviceWorks?.length).toBeGreaterThan(0);
    const html = buildDealerCheckReportHtml(record(), { dzaLogoDataUrl: LOGO });
    expect(html).toContain(VIN);
    expect(html).toContain("Eļļas serviss");
  });

  it("Dzintarzeme šablonā galvenē DZA logo, nevis PROVIN", () => {
    const html = buildDealerCheckReportHtml(record(), { dzaLogoDataUrl: LOGO });
    expect(html).toContain('alt="Dzintarzeme Auto"');
    expect(html).not.toMatch(/PROVIN/);
    expect(html).toContain("pdf-doc-footer__logo");
    expect(html).not.toContain('class="pdf-doc-footer__legal"');
  });

  it("Cits šablonā paliek standarta galvene", () => {
    const html = buildDealerCheckReportHtml(record({ template: "cits" }), { dzaLogoDataUrl: LOGO });
    expect(html).not.toContain('alt="Dzintarzeme Auto"');
    expect(html).toContain("PROVIN");
    expect(applyDealerCheckBrandHeader("<p>x</p>", "cits", LOGO)).toBe("<p>x</p>");
  });

  it("Lielo darbu labojums nonāk PDF", () => {
    const facts = dealerCheckDealerFacts(record());
    expect(facts).toBeTruthy();
    const p = buildDealerCheckReportPayload(
      record({ dealerMajorWorkOverrides: [{ key: "custom:1", action: "set", assemblyId: "turbo", date: "01.01.2022", km: "150000" }] }),
    );
    expect(p.dealerMajorWorkOverrides).toHaveLength(1);
  });

  it("faila nosaukums un e-pasta teksts", () => {
    expect(dealerCheckReportFilename(record())).toBe(`OFICIALA_DILERA_DATI_${VIN}_DZA.pdf`);
    expect(dealerCheckReportFilename(record({ template: "cits" }))).toBe(`OFICIALA_DILERA_DATI_${VIN}.pdf`);
    const mail = dealerCheckEmailDefaults(record());
    expect(mail.subject).toContain(VIN);
    expect(mail.text).toContain("Pielikumā");
    expect(mail.text).not.toMatch(/[—–]/);
    expect(mail.text).not.toMatch(/provin/i);
    expect(dealerCheckEmailDefaults(record({ template: "cits" })).text).not.toContain("Nils Valainis");
    const html = dealerCheckDzaEmailHtml("Labdien!\n\n<b>x</b>\nAr cieņu,\nNils Valainis");
    expect(html).not.toMatch(/provin/i);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;<br>Ar cieņu,<br>Nils Valainis");
  });
});
