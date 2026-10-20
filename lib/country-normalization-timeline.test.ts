import { describe, expect, it } from "vitest";
import { emptyCsddFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import {
  BMW_640I_VIN,
  PANAMERA_VIN,
  bmw640iInformationalUsaLifecycleInput,
  bmw640iLifecycleInput,
  panameraLifecycleInput,
} from "@/lib/country-normalization-timeline.fixture";
import {
  buildVehicleLifecycleEvents,
  lifecycleEventKnownCountryIso,
  lifecycleEventProvidesCountryResidence,
} from "@/lib/vehicle-lifecycle-timeline";

function importHops(events: ReturnType<typeof buildVehicleLifecycleEvents>) {
  return events
    .filter((e) => e.kind === "import")
    .map((e) => `${countryLabelToIso2(e.fromCountry ?? "")}→${countryLabelToIso2(e.country)}`);
}

describe("BMW 640i WBALW3C59CC891863 valstu ķēde", () => {
  it("rāda ASV → Lietuva pēc COPART rindas bez valsts, tad Lietuva → Latvija", () => {
    const input = bmw640iLifecycleInput();
    expect(input.csddForm?.vin).toBe(BMW_640I_VIN);
    const events = buildVehicleLifecycleEvents(input);

    const copart = events.find((e) => /COPART/i.test(e.title));
    expect(copart).toBeTruthy();
    expect(copart!.date).toBe("28.06.2021");
    expect(lifecycleEventKnownCountryIso(copart!)).toBeNull();
    expect(lifecycleEventProvidesCountryResidence(copart!)).toBe(false);

    const earlyUs = events.find((e) => e.date === "03.04.2018" && e.country);
    expect(countryLabelToIso2(earlyUs?.country ?? "")).toBe("US");

    const ltOdo = events.find((e) => e.kind === "odometer" && e.date === "27.12.2021");
    expect(countryLabelToIso2(ltOdo?.country ?? "")).toBe("LT");

    const hops = importHops(events);
    expect(hops).toContain("US→LT");
    expect(hops).toContain("LT→LV");
    expect(hops.filter((h) => h === "US→LT")).toHaveLength(1);
    expect(hops.filter((h) => h === "LT→LV")).toHaveLength(1);

    const usLt = events.find((e) => e.kind === "import" && countryLabelToIso2(e.fromCountry ?? "") === "US");
    expect(usLt?.detail).toBe("ASV → Lietuva");
    expect(usLt?.date).toBe("27.12.2021");
  });

  it("CarVertical laikposma ASV aizpilda ķēdi, ja stipra ASV rinda nav", () => {
    const events = buildVehicleLifecycleEvents(bmw640iInformationalUsaLifecycleInput());
    const hops = importHops(events);
    expect(hops).toContain("US→LT");
    expect(hops).toContain("LT→LV");
    expect(hops.filter((h) => h === "US→LT")).toHaveLength(1);
  });
});

describe("Panamera WP0ZZZ97ZLL145664 valstu ķēde", () => {
  it("rāda Vācija → Latvija kā atsevišķu pāreju", () => {
    const input = panameraLifecycleInput();
    expect(input.csddForm?.vin).toBe(PANAMERA_VIN);
    const events = buildVehicleLifecycleEvents(input);
    const hops = importHops(events);
    expect(hops).toContain("DE→LV");
    expect(hops.filter((h) => h === "DE→LV")).toHaveLength(1);
    const hop = events.find((e) => e.kind === "import");
    expect(hop?.detail).toBe("Vācija → Latvija");
  });
});

describe("vienas dienas valstu ķēde", () => {
  it("A → B → C paliek divas pārejas, A → B → A joprojām apvienojas", () => {
    const abc = buildVehicleLifecycleEvents({
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.tjekbil,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "02.10.2026", country: "ASV", description: "Reģistrēts", odometer: "1", includeInPdf: true },
            { date: "02.10.2026", country: "Lietuva", description: "Tehniskā apskate", odometer: "2", includeInPdf: true },
            { date: "02.10.2026", country: "Latvija", description: "Īpašnieka maiņa", odometer: "3", includeInPdf: true },
          ],
        },
      ],
    });
    expect(importHops(abc)).toEqual(["US→LT", "LT→LV"]);
    expect(abc.some((e) => e.kind === "anomaly" && /apvienota/i.test(e.title))).toBe(false);

    const aba = buildVehicleLifecycleEvents({
      csddForm: emptyCsddFields(),
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.tjekbil,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "02.10.2026", country: "Lietuva", description: "Reģistrēts", odometer: "1", includeInPdf: true },
            { date: "02.10.2026", country: "Latvija", description: "Tehniskā apskate", odometer: "2", includeInPdf: true },
            { date: "02.10.2026", country: "Lietuva", description: "Īpašnieka maiņa", odometer: "3", includeInPdf: true },
          ],
        },
      ],
    });
    expect(importHops(aba)).toEqual([]);
    expect(aba.some((e) => e.kind === "anomaly" && /A → B → A/.test(e.detail))).toBe(true);
  });
});
