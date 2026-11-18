import { describe, expect, it } from "vitest";
import { analyzeUnifiedMileageAnomalies, isLeadingMileageEntryError, type UnifiedMileageRow } from "@/lib/unified-mileage";
import { classifyOdometerAnomalies } from "@/lib/odometer-anomaly-classify";

const r = (sourceOrder: number, date: string, odometer: string, sourceLabel = "OFICIĀLĀ DĪLERA DATI"): UnifiedMileageRow => {
  const [d, m, y] = date.split(".").map(Number);
  return { date, odometer, country: "Vācija", sortableTime: Date.UTC(y!, m! - 1, d!), sourceOrder, sourceLabel, datePrecision: "day" };
};
const DAY = 86_400_000;

describe("17.11 klase B: kļūdains pirmais rādījums", () => {
  it("BMW 320d: 22 997 -> nākamajā dienā 12 397 -> 12 347 / 12 500: kļūda ir pirmais, nevis otrais", () => {
    const rows = [r(0, "22.09.2011", "22997"), r(1, "23.09.2011", "12397"), r(2, "10.10.2011", "12347", "CarVertical"), r(3, "21.11.2011", "12500")];
    const a = analyzeUnifiedMileageAnomalies(rows);
    expect([...a.dataEntryErrorSourceOrders]).toEqual([0]);
    expect([...a.anomalyBySourceOrder.values()].some(Boolean)).toBe(false);
    expect(classifyOdometerAnomalies(rows).map((c) => `${c.class}:${c.toKm}`)).toEqual(["typo_outlier:22997"]);
  });

  it("īsts kritums sākumā NETIEK paslēpts: tālāk sērija iet virs pirmā rādījuma (nevar zināt, kurš kļūdains)", () => {
    expect(isLeadingMileageEntryError(90_000, 0, 60_000, 5 * DAY, 95_000)).toBe(false);
  });

  it("ja nākamais rādījums ir vēlāk par 31 dienu - netiek aiztikts", () => {
    expect(isLeadingMileageEntryError(22_997, 0, 12_397, 40 * DAY, 12_500)).toBe(false);
  });

  it("mazs kritums (< 1 000 km) - nav kļūda", () => {
    expect(isLeadingMileageEntryError(12_900, 0, 12_397, DAY, 12_500)).toBe(false);
  });
});
