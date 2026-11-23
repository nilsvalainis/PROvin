/**
 * Nils 23.11.2026: OneAuto `oe_service_history` atdeva ISO datumus nākotnē („2028-05-23”, „2028-04-24”)
 * 2022. gada auto ar ~28 000 km (pēc nobraukuma tie iederas 2023. gadā). Mūsu parseris tos nolasīja
 * pareizi - kļūda ir avotā. Likums: šādus ierakstus izmet ielasē un lasot saglabātos datus.
 * Paraugs anonimizēts (VIN / vietas izdomātas), datumu un km secība kā oriģinālā.
 */
import { describe, expect, it, vi } from "vitest";

import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import { emptyAutoRecordsBlock, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { mergeAutoRecordsServiceWorkRow, normalizeAutoRecordsServiceWorkRows } from "@/lib/auto-records-service-works";
import {
  findDealerOdometerDrops,
  findDealerOdometerOutliers,
  monthsSinceLastDealerRecord,
} from "@/lib/dealer-odometer-checks";
import { dealerRawReparseBlocker } from "@/lib/dealer-data-job-types";
import { buildDealerReviewScoreInput } from "@/lib/dealer-review-score";
import { dropFutureDatedRows, isImpossibleFutureDate } from "@/lib/future-date-guard";
import { buildOneautoDisplay } from "@/lib/oneauto-catalog";
import { applyOneautoToAutoRecords, emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import { printableDealerServiceWorks } from "@/lib/pdf-dealer-service-visits";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";
import { sortVendorServiceEntries } from "@/lib/vendor-service-history";

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0); // 23.11.2026

/** Anonimizēts OneAuto `oe_service_history` paraugs (tā pati forma kā RAW). */
const SAMPLE_HISTORY = {
  success: true,
  result: {
    vehicle_identification_number: "WBYTEST0000000001",
    service_events: [
      { date_of_service_event: "2028-05-23", mileage_observed: 28389, mileage_unit: "km", service_provider: null, service_type: "service", service_actions: [] },
      { date_of_service_event: "2028-04-24", mileage_observed: 26531, mileage_unit: "km", service_provider: null, service_type: "service", service_actions: [] },
      { date_of_service_event: "2026-01-23", mileage_observed: 64407, mileage_unit: "km", service_provider: "Test Service, Riga, Latvia", service_type: "service", service_actions: ["Brake fluid service.", "Vehicle check."] },
      { date_of_service_event: "2025-06-09", mileage_observed: 53104, mileage_unit: "km", service_provider: null, service_type: "service", service_actions: [] },
      { date_of_service_event: "2024-02-05", mileage_observed: 31292, mileage_unit: "km", service_provider: "Test Service, Riga, Latvia", service_type: "service", service_actions: ["Brake fluid service."] },
      { date_of_service_event: "2023-10-11", mileage_observed: 26995, mileage_unit: "km", service_provider: null, service_type: "service", service_actions: [] },
      { date_of_service_event: "2022-10-27", mileage_observed: 10105, mileage_unit: "km", service_provider: null, service_type: "service", service_actions: [] },
    ],
  },
};

function row(date: string, odometer: string, works = "Apkope"): AutoRecordsServiceWorkRow {
  return { date, odometer, location: "", works };
}

describe("isImpossibleFutureDate", () => {
  it("dienas, mēneša un gada precizitāte; šodiena un rītdiena paliek", () => {
    expect(isImpossibleFutureDate("23.05.2028", NOW)).toBe(true);
    expect(isImpossibleFutureDate("2028-04-24", NOW)).toBe(true);
    expect(isImpossibleFutureDate("23.11.2026", NOW)).toBe(false);
    expect(isImpossibleFutureDate("24.11.2026", NOW)).toBe(false);
    expect(isImpossibleFutureDate("26.11.2026", NOW)).toBe(true);
    expect(isImpossibleFutureDate("11.2026", NOW)).toBe(false);
    expect(isImpossibleFutureDate("12.2026", NOW)).toBe(true);
    expect(isImpossibleFutureDate("2026", NOW)).toBe(false);
    expect(isImpossibleFutureDate("2027", NOW)).toBe(true);
    expect(isImpossibleFutureDate("", NOW)).toBe(false);
    expect(isImpossibleFutureDate("nav datuma", NOW)).toBe(false);
  });

  it("žurnālā tikai avots un skaits", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const out = dropFutureDatedRows([row("23.05.2028", "28389"), row("23.01.2026", "64407")], {
      nowMs: NOW,
      source: "tests",
    });
    expect(out.map((r) => r.date)).toEqual(["23.01.2026"]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { source: "tests", count: 1 });
    warn.mockRestore();
  });
});

describe("OneAuto ielase ar nākotnes datumiem (anonimizēts RAW paraugs)", () => {
  it("parseris ISO datumu nolasa pareizi, bet nākotnes ierakstus izmet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const display = buildOneautoDisplay({ oe_service_history: SAMPLE_HISTORY });
      warn.mockRestore();
      const dates = display.serviceTimeline.map((e) => e.date);
      expect(dates).not.toContain("23.05.2028");
      expect(dates).not.toContain("24.04.2028");
      expect(dates).toContain("23.01.2026");
      expect(dates).toContain("27.10.2022");

      const next = applyOneautoToAutoRecords(emptyAutoRecordsBlock(), {
        display,
        ingest: { ...emptyOneautoIngest(), lastFetchedVin: "WBYTEST0000000001" },
      });
      expect(next.serviceWorks.some((r) => r.date.endsWith("2028"))).toBe(false);
      expect(next.serviceHistory.some((r) => r.date.endsWith("2028"))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("atkārtota ielase no RAW tīra jau saglabātās nākotnes rindas (labošana bez maksas pieprasījuma)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const stored = {
        ...emptyAutoRecordsBlock(),
        serviceWorks: [row("23.05.2028", "28389"), row("24.04.2028", "26531"), row("23.01.2026", "64407")],
        serviceHistory: [
          { date: "23.05.2028", odometer: "28389", country: "" },
          { date: "23.01.2026", odometer: "64407", country: "Latvija" },
        ],
      };
      const next = applyOneautoToAutoRecords(stored, {
        display: buildOneautoDisplay({ oe_service_history: SAMPLE_HISTORY }),
        ingest: { ...emptyOneautoIngest(), lastFetchedVin: "WBYTEST0000000001" },
      });
      warn.mockRestore();
      expect(next.serviceWorks.map((r) => r.date)).not.toContain("23.05.2028");
      expect(next.serviceWorks.map((r) => r.date)).not.toContain("24.04.2028");
      expect(next.serviceHistory.map((r) => r.date)).not.toContain("23.05.2028");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("saglabāto datu lasīšana un aprēķini", () => {
  const stored = [
    row("23.05.2028", "28389"),
    row("24.04.2028", "26531"),
    row("23.01.2026", "64407", "Bremžu šķidruma maiņa"),
    row("09.06.2025", "53104"),
    row("27.10.2022", "10105"),
  ];

  it("admin / PDF / AI rindas bez nākotnes ierakstiem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      expect(normalizeAutoRecordsServiceWorkRows(stored).map((r) => r.date)).toEqual([
        "23.01.2026",
        "09.06.2025",
        "27.10.2022",
      ]);
      expect(printableDealerServiceWorks(stored).some((r) => r.date.endsWith("2028"))).toBe(false);
      const facts = extractDealerFactsFromServiceWorks(stored);
      expect(facts.rows.some((f) => f.date.endsWith("2028"))).toBe(false);
      expect(mergeAutoRecordsServiceWorkRow(stored.slice(2), row("01.01.2030", "1"))).toHaveLength(3);
      const merged = mergeSourceBlocksWithDefaults({
        auto_records: { serviceWorks: stored, serviceHistory: [{ date: "23.05.2028", odometer: "28389", country: "" }] },
      });
      expect(merged.auto_records.serviceWorks.some((r) => r.date.endsWith("2028"))).toBe(false);
      expect(merged.auto_records.serviceHistory.some((r) => r.date.endsWith("2028"))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("nav viltus odometra krituma, izlecēja un nākotnes „pēdējā ieraksta”", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      expect(findDealerOdometerDrops(stored)).toEqual([]);
      expect(findDealerOdometerOutliers(stored).size).toBe(0);
      expect(monthsSinceLastDealerRecord(stored, NOW)).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it("atsauksmes / AUDITS ievade: bez krituma, pēdējais ieraksts 23.01.2026", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const input = buildDealerReviewScoreInput({
        autoRecords: { ...emptyAutoRecordsBlock(), serviceWorks: stored },
        job: null,
        vin: "WBYTEST0000000001",
        nowMs: NOW,
      });
      expect(input.odometerDrops).toEqual([]);
      expect(input.lastDate).toBe("23.01.2026");
      expect(input.recordCount).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("citu avotu nobraukums un servisa ieraksti: nākotnes datums izmests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const mileage = collectUnifiedMileageRows({
        autoRecordsBlock: {
          ...emptyAutoRecordsBlock(),
          serviceHistory: [
            { date: "23.05.2028", odometer: "28389", country: "Vācija" },
            { date: "23.01.2026", odometer: "64407", country: "Latvija" },
          ],
        },
      } as Parameters<typeof collectUnifiedMileageRows>[0]);
      warn.mockRestore();
      expect(mileage.some((r) => r.date.endsWith("2028"))).toBe(false);
      expect(
        sortVendorServiceEntries([
          { date: "01.03.2029", odometer: "1", country: "", category: "", location: "", works: [] },
          { date: "01.03.2024", odometer: "2", country: "", category: "", location: "", works: [] },
        ]).map((e) => e.date),
      ).toEqual(["01.03.2024"]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pārparsēšana no RAW bez maksas pieprasījuma", () => {
  const base = {
    vin: "WBYTEST0000000001",
    status: "done" as const,
    serviceEventCount: 7,
    paidOutcomes: { oe_service_history: "ok" as const, oe_vin_lookup: "ok" as const },
    oneautoResults: {
      oe_service_history: { ok: true, payload: SAMPLE_HISTORY },
      oe_vin_lookup: { ok: true, payload: { success: true, result: { vehicle_identification_number: "WBYTEST0000000001", oem_vehicle_desc: "Test" } } },
    },
  };

  it("atļauj, ja visi maksas produkti jau saņemti", () => {
    expect(dealerRawReparseBlocker(base)).toBeNull();
  });

  it("atsaka, ja vajadzīgs maksas solis vai nav RAW", () => {
    expect(dealerRawReparseBlocker(null)).toBe("no_job");
    expect(dealerRawReparseBlocker({ ...base, status: "running" })).toBe("not_finished");
    expect(dealerRawReparseBlocker({ ...base, paidOutcomes: {} })).toBe("paid_step_needed");
    expect(
      dealerRawReparseBlocker({
        ...base,
        paidOutcomes: { oe_service_history: "ok" },
        oneautoResults: { oe_service_history: base.oneautoResults.oe_service_history },
      }),
    ).toBe("paid_step_needed");
    expect(dealerRawReparseBlocker({ ...base, oneautoResults: {} })).toBe("no_raw");
  });
});
