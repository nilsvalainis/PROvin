import { describe, expect, it } from "vitest";
import { parseAutoRecordsPaste } from "@/lib/auto-records-paste-parse";
import { parseAutoRecordsOdometerTable } from "@/lib/auto-records-odometer-table-parse";
import { parseCarverticalPdfText, parseCarverticalOdometerFromText } from "@/lib/carvertical-pdf-parse";

const AUTO_RECORDS_RAW = `ODOMETER CHECK
Status Event Date Event Location Odometer Reading Event Detail
2023-01-06 Riga, Latvia 50,137 km ServiceVisit
2022-05-26 - 38,417 km ServiceVisit
2021-12-23 - 34,528 km ServiceVisit
2021-04-10 Riga, Latvia 30,589 km ServiceVisit
2021-04-10 - 30,588 km ServiceVisit
2020-11-06 Riga, Latvia 27,408 km ServiceVisit
2020-11-06 - 27,409 km ServiceVisit
2020-04-23 - 21,019 km ServiceVisit
2019-10-30 - 16,449 km ServiceVisit
2019-10-14 - 16,354 km ServiceVisit
2019-10-12 Marupe, Latvia 16,354 km ServiceVisit
2019-05-10 - 10,565 km ServiceVisit
2018-10-31 - 7,092 km ServiceVisit
2018-04-18 - 1,618 km ServiceVisit
2017-12-13 Riga, Latvia 6 km ServiceVisit`;

const CARVERTICAL_RAW = `Odometra rādījumu ieraksti
12.2017. 6 km
04.2018. 1618 km
10.2018. 7092 km
05.2019. 10 565 km
10.2019. 16 354 km
04.2020. 21 019 km
11.2020. 27 409 km
04.2021. 30 588 km
11.2021. 32 536 km
Odometra rādījumu ieraksti
12.2021. 34 528 km
05.2022. 38 417 km
11.2022. 47 135 km
01.2023. 50 137 km
11.2023. 61 869 km
11.2024. 77 610 km
11.2025. 92 610 km`;

describe("AutoRecords spaced ODOMETER CHECK paste", () => {
  it("parses all 15 rows with odometer and Latvia where present", () => {
    const rows = parseAutoRecordsPaste(AUTO_RECORDS_RAW);
    expect(rows).toHaveLength(15);
    expect(rows.every((r) => r.odometer.length > 0)).toBe(true);
    expect(rows.find((r) => r.date === "06.01.2023")?.odometer).toBe("50137");
    expect(rows.find((r) => r.date === "26.05.2022")?.odometer).toBe("38417");
    expect(rows.find((r) => r.date === "13.12.2017")?.odometer).toBe("6");
    expect(rows.find((r) => r.date === "06.01.2023")?.country).toBe("Latvija");
    expect(rows.find((r) => r.date === "26.05.2022")?.country).toBe("");
    expect(rows.every((r) => !/^\d+$/.test(r.country))).toBe(true);
  });

  it("table parser handles dash-location rows and small km values", () => {
    const rows = parseAutoRecordsOdometerTable(AUTO_RECORDS_RAW);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    expect(rows.some((r) => r.odometer === "6")).toBe(true);
    expect(rows.some((r) => r.odometer === "38417")).toBe(true);
  });
});

describe("CarVertical odometer paste", () => {
  it("parses all 16 rows with odometer; country empty when unknown", () => {
    const rows = parseCarverticalOdometerFromText(CARVERTICAL_RAW);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.odometer.length > 0)).toBe(true);
    expect(rows.find((r) => r.date === "00.12.2017")?.odometer).toBe("6");
    expect(rows.find((r) => r.date === "00.11.2025")?.odometer).toBe("92610");
    expect(rows.every((r) => r.country === "" || !/^\d+$/.test(r.country))).toBe(true);
  });

  it("parseCarverticalPdfText keeps odometer on serviceHistory", () => {
    const result = parseCarverticalPdfText(CARVERTICAL_RAW);
    expect(result.serviceHistory).toHaveLength(16);
    expect(result.serviceHistory.every((r) => r.odometer.length > 0)).toBe(true);
  });
});
