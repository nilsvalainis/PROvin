import { emptyCsddFields, SOURCE_BLOCK_LABELS, type ClientManualVendorBlockPdf } from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { BMW_640I_CSDD_RAW, BMW_640I_VIN, PANAMERA_CSDD_RAW, PANAMERA_VIN } from "@/lib/csdd-first-registration.fixtures";
import { emptyAsvBlock, type AsvBlockState } from "@/lib/asv-report";
import type { LifecycleInput } from "@/lib/vehicle-lifecycle-timeline";

export { BMW_640I_VIN, PANAMERA_VIN };

/**
 * BMW 640i WBALW3C59CC891863: ASV periods ar atšķirīgiem valsts vārdiem,
 * tad COPART rinda bez atpazīstamas valsts, tad Lietuva, tad Latvija.
 */
export function bmw640iAsvBlock(): AsvBlockState {
  return {
    ...emptyAsvBlock(),
    titles: [
      { date: "15.01.2012", region: "California", odometer: "12", note: "" },
      { date: "03.04.2018", region: "ASV", odometer: "84200", note: "" },
    ],
    mileage: [
      { date: "15.01.2012", odometer: "12", country: "California (ASV)" },
      { date: "03.04.2018", odometer: "84200", country: "USA" },
      { date: "28.06.2021", odometer: "118400", country: "Copart" },
    ],
    sales: [{ date: "28.06.2021", venue: "COPART", odometer: "118400", price: "", status: "Pārdots" }],
  };
}

export function bmw640iUsaVendorBlock(): ClientManualVendorBlockPdf {
  return {
    title: SOURCE_BLOCK_LABELS.carvertical,
    mileageRows: [
      { date: "15.01.2012", odometer: "12", country: "California (ASV)" },
      { date: "03.04.2018", odometer: "84200", country: "USA" },
    ],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: [
      { date: "15.01.2012", country: "California", description: "Pirmā reģistrācija", includeInPdf: true },
      { date: "03.04.2018", country: "US", description: "Reģistrēts", includeInPdf: true },
    ],
  };
}

export function bmw640iLithuaniaVendorBlock(): ClientManualVendorBlockPdf {
  return {
    title: SOURCE_BLOCK_LABELS.autodna,
    mileageRows: [
      { date: "27.12.2021", odometer: "126850", country: "LT" },
      { date: "10.03.2024", odometer: "168200", country: "Lietuva" },
    ],
    incidentRows: [],
    comments: "",
    vehicleHistoryTimeline: [
      { date: "27.12.2021", country: "Lithuania", description: "Reģistrēts", includeInPdf: true },
    ],
  };
}

export function bmw640iLifecycleInput(): LifecycleInput {
  const raw = BMW_640I_CSDD_RAW;
  return {
    csddForm: applyCsddPasteToForm(emptyCsddFields(), raw, parseCsddPaste(raw)),
    asvBlock: bmw640iAsvBlock(),
    manualVendorBlocks: [bmw640iUsaVendorBlock(), bmw640iLithuaniaVendorBlock()],
  };
}

/** Tikai CarVertical laikposma ASV, bez stipra ASV odometra / title. */
export function bmw640iInformationalUsaLifecycleInput(): LifecycleInput {
  const raw = BMW_640I_CSDD_RAW;
  return {
    csddForm: applyCsddPasteToForm(emptyCsddFields(), raw, parseCsddPaste(raw)),
    asvBlock: {
      ...emptyAsvBlock(),
      sales: [{ date: "28.06.2021", venue: "COPART", odometer: "118400", price: "", status: "Pārdots" }],
    },
    manualVendorBlocks: [
      {
        title: SOURCE_BLOCK_LABELS.carvertical,
        mileageRows: [],
        incidentRows: [],
        comments: "",
        vehicleHistoryTimeline: [
          { date: "15.01.2012", country: "California (ASV)", description: "Pirmā reģistrācija", includeInPdf: true },
          { date: "03.04.2018", country: "USA", description: "Reģistrēts", includeInPdf: true },
        ],
      },
      bmw640iLithuaniaVendorBlock(),
    ],
  };
}

export function panameraLifecycleInput(): LifecycleInput {
  const raw = PANAMERA_CSDD_RAW;
  return {
    csddForm: applyCsddPasteToForm(emptyCsddFields(), raw, parseCsddPaste(raw)),
    manualVendorBlocks: [
      {
        title: SOURCE_BLOCK_LABELS.autodna,
        mileageRows: [
          { date: "20.06.2020", odometer: "18", country: "DE" },
          { date: "11.11.2023", odometer: "51200", country: "Vācija" },
        ],
        incidentRows: [],
        comments: "",
        vehicleHistoryTimeline: [
          { date: "20.06.2020", country: "Germany", description: "Pirmā reģistrācija", includeInPdf: true },
        ],
      },
    ],
  };
}
