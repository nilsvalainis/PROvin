import { describe, expect, it } from "vitest";
import { emptyCsddFields, emptyTirgusFields, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { csddFieldsFromStructuredAiPayload } from "@/lib/csdd-ai-structured-map";
import { parseLvRegistryBasics } from "@/lib/client-report-lv-parse";
import {
  collectCsddFirstRegistrationWarnings,
} from "@/lib/csdd-first-registration-guard";
import {
  BMW_640I_CSDD_RAW,
  BMW_640I_VIN,
  PANAMERA_CSDD_RAW,
  PANAMERA_VIN,
} from "@/lib/csdd-first-registration.fixtures";
import { buildVehicleLifecycleEvents } from "@/lib/vehicle-lifecycle-timeline";
import { collectListingPriceLifecyclePoints } from "@/lib/listing-price-lifecycle";

describe("CSDD pirmā reģistrācija pasaulē vs Latvijā", () => {
  it("BMW 640i: paste neieliek Pirmā reģistrācija Latvijā pasaules laukā", () => {
    const form = applyCsddPasteToForm(emptyCsddFields(), BMW_640I_CSDD_RAW, parseCsddPaste(BMW_640I_CSDD_RAW));
    expect(form.vin).toBe(BMW_640I_VIN);
    expect(form.modelYear).toBe("2011");
    expect(form.previousRegistrationCountry).toMatch(/LIETUV/i);
    expect(form.firstRegistration).toBe("");
    expect(form.firstRegistrationLatvia).toBe("2026-10-02");
    expect(form.ownerRegistrationEvents[0]?.label).toMatch(/Pirmā reģistrācija Latvijā/i);
  });

  it("Panamera: paste atstāj pasaules lauku tukšu, Latvijas datums ir atsevišķi", () => {
    const form = applyCsddPasteToForm(emptyCsddFields(), PANAMERA_CSDD_RAW, parseCsddPaste(PANAMERA_CSDD_RAW));
    expect(form.vin).toBe(PANAMERA_VIN);
    expect(form.modelYear).toBe("2020");
    expect(form.previousRegistrationCountry).toMatch(/VĀCIJ/i);
    expect(form.firstRegistration).toBe("");
    expect(form.firstRegistrationLatvia).toBe("2025-03-15");
    expect(form.ownerRegistrationEvents).toHaveLength(2);
  });

  it("parseLvRegistryBasics vairs neliek Latvijas rindu firstReg", () => {
    const basics = parseLvRegistryBasics(BMW_640I_CSDD_RAW);
    expect(basics.firstRegLatvia).toMatch(/02[./]10[./]2026/);
    expect(basics.firstReg).toBeNull();
  });

  it("Copilot pirmasRegistracijaLatvija neaizpilda firstRegistration", () => {
    const fields = csddFieldsFromStructuredAiPayload(
      {
        pamataDati: {
          markaModelis: "BMW 640I",
          registracijasNumurs: "AB1234",
          pirmasRegistracijaLatvija: "02.10.2026",
          ieprieksejasRegistracijasValsts: "LIETUVA",
        },
      },
      BMW_640I_CSDD_RAW,
    );
    expect(fields.firstRegistration).toBe("");
    expect(fields.firstRegistrationLatvia).toBe("2026-10-02");
  });

  it("Copilot pasaules un Latvijas datumi paliek atsevišķi", () => {
    const fields = csddFieldsFromStructuredAiPayload(
      {
        pamataDati: {
          markaModelis: "BMW 640I",
          registracijasNumurs: "AB1234",
          pirmasRegistracija: "15.01.2012",
          pirmasRegistracijaLatvija: "02.10.2026",
        },
      },
      "",
    );
    expect(fields.firstRegistration).toBe("2012-01-15");
    expect(fields.firstRegistrationLatvia).toBe("2026-10-02");
  });
});

describe("collectCsddFirstRegistrationWarnings", () => {
  it("BMW: brīdina, ja pasaules lauks ir LV datums (bez auto-labojuma)", () => {
    const csdd = {
      ...emptyCsddFields(),
      vin: BMW_640I_VIN,
      modelYear: "2011",
      firstRegistration: "2026-10-02",
      firstRegistrationLatvia: "2026-10-02",
      previousRegistrationCountry: "LIETUVA",
      ownerRegistrationEvents: [{ date: "02.10.2026", label: "Pirmā reģistrācija Latvijā" }],
    };
    const warnings = collectCsddFirstRegistrationWarnings({
      csdd,
      otherRecordDates: ["01.2012", "15.01.2012"],
    });
    expect(warnings.map((w) => w.id)).toEqual(expect.arrayContaining(["FR1", "FR2", "FR3"]));
    expect(csdd.firstRegistration).toBe("2026-10-02");
  });

  it("Panamera: brīdina, ja LV datums ielikts kā pirmā pasaulē", () => {
    const csdd = {
      ...emptyCsddFields(),
      vin: PANAMERA_VIN,
      modelYear: "2020",
      firstRegistration: "2025-03-15",
      firstRegistrationLatvia: "2025-03-15",
      previousRegistrationCountry: "VĀCIJA",
    };
    const warnings = collectCsddFirstRegistrationWarnings({ csdd });
    expect(warnings.some((w) => w.id === "FR3")).toBe(true);
    expect(csdd.firstRegistration).toBe("2025-03-15");
  });

  it("tukšs pasaules lauks pēc pareiza parse nav brīdinājums", () => {
    const form = applyCsddPasteToForm(emptyCsddFields(), BMW_640I_CSDD_RAW, parseCsddPaste(BMW_640I_CSDD_RAW));
    expect(collectCsddFirstRegistrationWarnings({ csdd: form })).toEqual([]);
  });
});

describe("BMW 640i vēstures lente", () => {
  it("Pirmā reģistrācija Latvijā ir Latvija, viena Lietuva→Latvija, bez tādas pašas dienas lēciena", () => {
    const events = buildVehicleLifecycleEvents({
      csddForm: {
        ...emptyCsddFields(),
        vin: BMW_640I_VIN,
        modelYear: "2011",
        firstRegistration: "2026-10-02",
        firstRegistrationLatvia: "2026-10-02",
        previousRegistrationCountry: "LIETUVA",
        ownerRegistrationEvents: [{ date: "02.10.2026", label: "Pirmā reģistrācija Latvijā" }],
      },
    });
    const firstLv = events.filter((e) => e.kind === "first_registration");
    expect(firstLv).toHaveLength(1);
    expect(firstLv[0]!.country).toBe("Latvija");
    expect(firstLv[0]!.detail).toMatch(/Latvijā/);
    expect(firstLv[0]!.detail).not.toMatch(/Avoti atšķiras valstī/);
    const imports = events.filter((e) => e.kind === "import");
    expect(imports).toHaveLength(1);
    expect(imports[0]!.detail).toBe("Lietuva → Latvija");
    expect(imports.filter((e) => e.date === "02.10.2026")).toHaveLength(1);
    expect(events.some((e) => e.kind === "anomaly" && /A → B → A/.test(e.detail))).toBe(false);
  });

  it("ss.lv 192 000 km paliek tikai sludinājuma 09.09.2026 rindā", () => {
    const events = buildVehicleLifecycleEvents({
      listingUrl: "https://www.ss.lv/msg/bmw/640i.html",
      tirgusForm: {
        ...emptyTirgusFields(),
        listingCreated: "09.09.2026",
        listingMileageOdometer: "192000",
        listingMileageDate: "09.09.2026",
        listingMileageCountry: "Latvija",
        priceHistory: [
          { date: "09.09.2026", price: 18900, mileage: 192000, year: 2012, delta: 0 },
          { date: "02.10.2026", price: 18400, mileage: 192000, year: 2012, delta: -500 },
        ],
      },
      manualVendorBlocks: [
        {
          title: SOURCE_BLOCK_LABELS.citi_avoti,
          mileageRows: [],
          incidentRows: [],
          comments: "",
          vehicleHistoryTimeline: [
            { date: "29.09.2026", country: "Latvija", description: "Ieraksts", odometer: "", includeInPdf: true },
          ],
        },
      ],
    });
    const listed = events.filter((e) => e.kind === "listed");
    const firstListing = listed.find((e) => e.date === "09.09.2026");
    const priceChange = listed.find((e) => e.date === "02.10.2026");
    const citi = events.find((e) => e.date === "29.09.2026" && e.timelineInformational);
    expect(firstListing?.odometer).toMatch(/192\s?000/);
    expect(priceChange?.odometer ?? "").toBe("");
    expect(citi?.odometer ?? "").toBe("");
    expect(events.filter((e) => e.date !== "09.09.2026" && /192/.test(e.odometer))).toHaveLength(0);
    expect(events.some((e) => e.date === "09.09.2026" && /192/.test(e.odometer))).toBe(true);
  });

  it("vienā dienā A→B→A paliek viens brīdinājums, bez atkārtotiem importiem", () => {
    const events = buildVehicleLifecycleEvents({
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
    const imports = events.filter((e) => e.kind === "import" && e.date === "02.10.2026");
    expect(imports).toHaveLength(0);
    const warn = events.find((e) => e.kind === "anomaly" && /apvienota/i.test(e.title));
    expect(warn).toBeTruthy();
    expect(warn!.tone).toBe("warn");
  });
});

describe("collectListingPriceLifecyclePoints km ownership", () => {
  it("atkārtots tas pats km uz cenas izmaiņas rindas netiek rādīts", () => {
    const points = collectListingPriceLifecyclePoints({
      priceHistory: [
        { date: "09.09.2026", price: 18900, mileage: 192000, year: 2012, delta: 0 },
        { date: "02.10.2026", price: 18400, mileage: 192000, year: 2012, delta: -500 },
      ],
    });
    expect(points).toEqual([
      { date: "09.09.2026", price: 18900, mileageKm: 192000, delta: 0 },
      { date: "02.10.2026", price: 18400, mileageKm: null, delta: -500 },
    ]);
  });
});
