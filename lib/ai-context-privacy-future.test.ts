import { describe, expect, it } from "vitest";
import { buildAiOrderContextText, redactContactDataForAi } from "@/lib/admin-ai-order-context";
import { createDefaultSourceBlocks, vendorAvotuBlockToPlainText, emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import { carfaxReportToPlainText } from "@/lib/carfax-report";
import { emptyCarfaxReport } from "@/lib/carfax-report-parse";

const FUTURE = `12.05.${new Date().getUTCFullYear() + 2}`;

describe("25.11: AI kontekstā nav klienta personas datu", () => {
  it("klienta vārds neiet uz AI, kontakti piezīmēs aizklāti, VIN un km paliek", () => {
    const text = buildAiOrderContextText({
      sessionId: "cs_test_1",
      vin: "WBA5R1C0XLFH42873",
      listingUrl: null,
      customerName: "Jānis Bērziņš",
      notes: "Zvaniet +371 29 502 039 vai 29502039, e-pasts janis@example.lv. Auto 156 042 km.",
      sourceBlocks: createDefaultSourceBlocks(),
    });
    expect(text).not.toContain("Jānis");
    expect(text).not.toContain("Klienta vārds");
    expect(text).not.toContain("janis@example.lv");
    expect(text).not.toContain("29 502 039");
    expect(text).not.toContain("29502039");
    expect(text).toContain("WBA5R1C0XLFH42873");
    expect(text).toContain("156 042 km");
  });

  it("redactContactDataForAi neskar datumus, cenas un nobraukumu", () => {
    expect(redactContactDataForAi("12.03.2019 · 18 400 € · 225 000 km · 2019")).toBe(
      "12.03.2019 · 18 400 € · 225 000 km · 2019",
    );
    expect(redactContactDataForAi("tel. 27733440")).toBe("tel. [tālrunis]");
  });
});

describe("25.11: nākotnes datumi AutoDNA / CarVertical / CARFAX rindās AI kontekstā", () => {
  it("vendor bloka rindas ar datumu nākotnē neiet AI tekstā", () => {
    const b = {
      ...emptyVendorAvotuBlock(),
      serviceHistory: [
        { date: "12.03.2019", odometer: "50000", country: "DE", unit: "km" },
        { date: FUTURE, odometer: "90000", country: "DE", unit: "km" },
      ],
      vehicleHistoryTimeline: [
        { date: "01.2020", country: "Vācija", description: "Reģistrācija" },
        { date: FUTURE, country: "Vācija", description: "Nākotnes notikums" },
      ],
    } as never;
    const text = vendorAvotuBlockToPlainText(b);
    expect(text).toContain("50000");
    expect(text).not.toContain("90000");
    expect(text).toContain("Reģistrācija");
    expect(text).not.toContain("Nākotnes notikums");
  });

  it("CARFAX vēsture un bojājumi ar datumu nākotnē neiet AI tekstā", () => {
    const r = emptyCarfaxReport();
    r.vin = "WBA5R1C0XLFH42873";
    r.history = [
      { date: "05.2018", odometerKm: "12000", event: "Registration", eventLv: "Reģistrācija", country: "Vācija", details: [] },
      { date: FUTURE, odometerKm: "99999", event: "Service", eventLv: "Serviss", country: "Vācija", details: [] },
    ] as never;
    r.damages = [
      { date: FUTURE, country: "Vācija", cause: "Sadursme", areas: [], components: [], repairCost: "", severity: "" },
    ] as never;
    const text = carfaxReportToPlainText(r);
    expect(text).toContain("12000");
    expect(text).not.toContain("99999");
    expect(text).not.toContain("Sadursme");
  });
});
