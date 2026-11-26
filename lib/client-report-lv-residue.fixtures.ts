/**
 * Bagāts klienta PDF payload valodas atlieku testam (EN/RU/DE). Visi dati izdomāti (publisks repo).
 * Avotu oriģinālais teksts (CARFAX, kfzgutachten, dīlera darbi) jau ir svešvalodā - LV paliek tikai mūsu apvalks.
 */
import {
  createDefaultSourceBlocks,
  emptyCsddFields,
  toPdfCarfaxBlock,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import { applyCarfaxReportToBlock } from "@/lib/carfax-report";
import { CARFAX_FIXTURE_IT } from "@/lib/carfax-report-parse.fixtures";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import type { ClientReportPayload } from "@/lib/client-report-html";
import { ECSDD_NEW_FORMAT_DEREGISTERED, ECSDD_OLD_FORMAT_MEASUREMENTS } from "@/lib/csdd-bloki.fixtures";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { GUTACHTEN_LINES } from "@/lib/kfzgutachten/__fixtures__/gutachten";
import { applyKfzAtToCitiAvoti } from "@/lib/kfzgutachten/apply-citi";
import { parseKfzGutachtenText } from "@/lib/kfzgutachten/parse-gutachten";
import { emptyLtabCertificate, type LtabCertificate } from "@/lib/ltab-report-extract";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import { readFileSync } from "node:fs";
import path from "node:path";

export const LV_RESIDUE_VIN = "WDC00000000000002";

function csddForm(raw: string): CsddFormFields {
  return applyCsddPasteToForm({ ...emptyCsddFields(), rawUnprocessedData: raw }, raw, parseCsddPaste(raw));
}

const LTAB_NO_CLAIMS: LtabCertificate = {
  ...emptyLtabCertificate(),
  issuedAt: "25.11.2026 11:29:16",
  makeModel: "TESTA AUTO X1",
  year: "2006",
  plate: "AA0000",
  vehicleLine: "Transportlīdzeklis TESTA AUTO X1, izlaiduma gads 2006. Valsts numura zīme AA0000.",
  accidentCount: "0",
  insuredFrom: "01.03.2019",
  insuredTo: "25.11.2026",
  insuredDays: "2826",
  footerNote: "Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.",
};

function ccVin() {
  return {
    ...emptyCcVinBlock(),
    sales: [
      { date: "01.10.2026", venue: "Openlane", odometer: "390 100 km", price: "4 500 €", status: "Sold" },
      { date: "02.03.2025", venue: "Autobid", odometer: "371 000 km", price: "", status: "" },
    ],
    photoGroups: [
      {
        id: "g1",
        title: "Openlane · 2026-10-01",
        photos: [
          { id: "ih_ph_1", sourceUrl: "https://img.example/1.jpg", contentHash: "h1" },
          { id: "ih_ph_2", sourceUrl: "https://img.example/2.jpg", contentHash: "h2" },
        ],
      },
      { id: "g0", title: "Autobid · 2025-03-02", photos: [{ id: "ih_ph_0", sourceUrl: "https://img.example/0.jpg", contentHash: "h0" }] },
    ],
  } as unknown as ReturnType<typeof emptyCcVinBlock>;
}

/** AUTO1 izsoles ieraksts no anonimizētas TheCarApi fiktūras (izsoļu kartītes EN/RU/DE testam, 26.11). */
export function lvResidueAuctionRecord(): ThecarapiAdminRecord {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi/detail-auto1-full-anon.json");
  const [row] = buildThecarapiAdminRecords({
    historyJson: {
      auctions: [
        { site_name: "auto1", auction_id: "1326383403", detail_path: "/api/auction/auto1/1326383403", mileage: 226760, first_seen: "2026-10-07" },
      ],
    },
    detailJson: JSON.parse(readFileSync(file, "utf8")) as unknown,
  });
  return row!;
}

export const LV_RESIDUE_PHOTO = "data:image/jpeg;base64,/9j/izdomats";

export function lvResiduePhotoMap(): Map<string, string> {
  return new Map([
    ["ih_ph_0", LV_RESIDUE_PHOTO],
    ["ih_ph_1", LV_RESIDUE_PHOTO],
    ["ih_ph_2", LV_RESIDUE_PHOTO],
  ]);
}

/** Pilnā atskaite: CSDD (jaunais formāts ar TA vēsturi), AutoDNA, CarVertical, CARFAX, kfzgutachten, LTAB, izsoles, serviss. */
export function lvResiduePayload(opts: { measurements?: boolean; izvilkums?: boolean; auctions?: boolean } = {}): ClientReportPayload {
  const blocks = createDefaultSourceBlocks();
  blocks.csdd = csddForm(opts.measurements ? ECSDD_OLD_FORMAT_MEASUREMENTS : ECSDD_NEW_FORMAT_DEREGISTERED);
  blocks.autodna = {
    ...blocks.autodna,
    serviceHistory: [{ date: "2019-06-01", odometer: "240000", country: "DE" }],
    incidents: [{ csngDate: "03.2018", lossAmount: "1200 €", incidentNo: "DE" }],
    previousSearches: [
      { dateTime: "14.03.2026 09:12:44", service: "Report autoDNA", ip: "163.116.XXX.XXX", location: "Riga, Latvia" },
    ],
    comments: "",
  } as typeof blocks.autodna;
  blocks.carvertical = {
    ...blocks.carvertical,
    serviceHistory: [{ date: "2020-08-01", odometer: "255000", country: "NL" }],
    incidents: [],
    comments: "",
  } as typeof blocks.carvertical;
  const carfax = applyCarfaxReportToBlock(blocks.carfax, CARFAX_FIXTURE_IT);
  if (carfax) blocks.carfax = { ...carfax.block, comments: "" };
  blocks.citi_avoti = applyKfzAtToCitiAvoti(blocks.citi_avoti, { reports: parseKfzGutachtenText(GUTACHTEN_LINES) }).block;
  blocks.auto_records = {
    ...blocks.auto_records,
    serviceHistory: [
      { date: "12.03.2017", odometer: "180000", country: "DE" },
      { date: "16.09.2018", odometer: "215000", country: "DE" },
    ],
    serviceWorks: [
      { date: "12.03.2017", odometer: "180000", location: "Mercedes-Benz Köln, DE-50667", works: "Engine oil and filter change" },
      { date: "16.09.2018", odometer: "215000", location: "Mercedes-Benz Köln, DE-50667", works: "Engine oil and filter change; brake pads front" },
    ],
    oilIntervalChart: {
      useSavedRows: true,
      highlightOverOem: true,
      oemKm: 30_000,
      oemMonths: 24,
      rows: [
        { id: "a", date: "12.03.2017", odometer: "180000", works: "Eļļas maiņa" },
        { id: "b", date: "16.09.2018", odometer: "215000", works: "Eļļas maiņa" },
        { id: "c", date: "20.01.2021", odometer: "283000", works: "Eļļas maiņa" },
      ],
    },
  } as typeof blocks.auto_records;
  blocks.cc_vin = ccVin();
  if (opts.auctions) blocks.cc_vin = { ...blocks.cc_vin, thecarapiRecords: [lvResidueAuctionRecord()] } as typeof blocks.cc_vin;
  const ltab = { ...blocks.ltab, rows: [], comments: "", certificate: LTAB_NO_CLAIMS };

  return {
    sessionId: "cs_test_lv_residue",
    vin: LV_RESIDUE_VIN,
    created: Date.UTC(2026, 10, 25) / 1000,
    amountTotal: 9999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: "Testa Klients",
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    ccVinBlock: blocks.cc_vin,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    carfaxBlock: toPdfCarfaxBlock(blocks.carfax),
    manualLtabBlock: toPdfLtabManualBlock(ltab as typeof blocks.ltab, { csdd: { ...blocks.csdd, registrationNumber: "AA0000", registrationStatus: "Reģistrēts" } }),
    citiAvoti: blocks.citi_avoti,
    pdfVisibility: mergePdfVisibility({
      csddPdfWarnings: true,
      csddPdfRestrictions: true,
      csddPdfMeasurements: true,
      csddPdfTaAnalysis: true,
      ...(opts.izvilkums ? { izvilkums: true } : {}),
    }),
  } as unknown as ClientReportPayload;
}

/** Tukšs pasūtījums (tikai VIN): kartītes «Nav ierakstu», «Apkopju ieraksti nav atrasti», «Nav datu». */
export function lvResidueSparsePayload(): ClientReportPayload {
  const blocks = createDefaultSourceBlocks();
  return {
    ...lvResiduePayload(),
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    ccVinBlock: emptyCcVinBlock(),
    manualVendorBlocks: [],
    carfaxBlock: null,
    manualLtabBlock: null,
    citiAvoti: blocks.citi_avoti,
  } as unknown as ClientReportPayload;
}
