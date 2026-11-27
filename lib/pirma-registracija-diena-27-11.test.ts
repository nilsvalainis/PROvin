/**
 * 27.11.2026 (WVWZZZ3CZNE054721): CarVertical «Pirmā reģistrācija 01.04.2022» (tikai mēnesis), AutoDNA - 22.04.2022.
 * Vākā un vēsturē bija 01.04.2022. Tā paša mēneša precīzā diena ir pareizā pirmā reģistrācija.
 */
import { describe, expect, it } from "vitest";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";

const vendor = (title: string, date: string, country: string) => ({
  title,
  mileageRows: [],
  incidentRows: [],
  comments: "",
  vehicleHistoryTimeline: [{ date, country, description: "Pirmā reģistrācija", odometer: "", includeInPdf: true }],
});

describe("pirmā reģistrācija - precīzā diena pār mēneša sākumu", () => {
  it("CarVertical 01.04.2022 + AutoDNA 22.04.2022 -> viena kartīte 22.04.2022, Beļģija", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [vendor(SOURCE_BLOCK_LABELS.carvertical, "01.04.2022", "Beļģija"), vendor(SOURCE_BLOCK_LABELS.autodna, "22.04.2022", "")],
    });
    const fr = events.filter((e) => e.kind === "first_registration");
    expect(fr).toHaveLength(1);
    expect(fr[0]!.date).toBe("22.04.2022");
    expect(fr[0]!.country).toBe("Beļģija");
  });
  it("ja otrs avots ir citā mēnesī - paliek agrākais", () => {
    const events = buildVehicleLifecycleEvents({
      manualVendorBlocks: [vendor(SOURCE_BLOCK_LABELS.carvertical, "01.04.2022", "Beļģija"), vendor(SOURCE_BLOCK_LABELS.autodna, "03.05.2022", "")],
    });
    expect(events.filter((e) => e.kind === "first_registration")[0]!.date).toBe("01.04.2022");
  });
});
