/**
 * ASV vēstures avots (admin: „ASV”).
 *
 * Klienta PDF: PROVIN noformējums, bez VIN Audit / Carfax zīmola.
 * Dati nāk no VIN Audit (One Auto API) — title, salvage, negadījumi, izsoles, ķīlas, zādzības.
 */

import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import type { AsvPhotoGroup, AsvPhotoMeta } from "@/lib/asv-photo-types";
import { normalizeAsvPhotoGroups, syncAsvPhotoGroupsAndFlat } from "@/lib/asv-photo-types";
import {
  ccVinAlertChecks,
  ccVinAmountToEurDisplay,
  ccVinBlockHasContent,
  ccVinCheckRowHasData,
  ccVinDamageRowHasData,
  ccVinRecordRowHasData,
  ccVinSaleRowHasData,
  ccVinTitleRowHasData,
  emptyCcVinCheckRow,
  emptyCcVinDamageRow,
  emptyCcVinMileageRow,
  emptyCcVinRecordRow,
  emptyCcVinSaleRow,
  emptyCcVinTitleRow,
  type CcVinBlockState,
  type CcVinCheckRow,
  type CcVinDamageRow,
  type CcVinPdfChecklist,
  type CcVinRecordRow,
  type CcVinSaleRow,
  type CcVinTitleRow,
} from "@/lib/cc-vin-report";

export const ASV_ADMIN_LABEL = "ASV";

/** Klienta PDF sadaļas nosaukums — bez ārējā pakalpojuma nosaukuma. */
export const ASV_PDF_TITLE = "ASV VĒSTURE";

/** Nobraukuma / negadījumu tabulu avota apzīmējums. */
export const ASV_PDF_SOURCE_LABEL = "ASV";

export const ASV_UNIFIED_INCIDENT_CHECK_LABELS = new Set(["Fiksētie bojājumi", "Negadījumi"]);

export const ASV_SUBTITLES = {
  checks: "Pārbaudītie reģistri",
  flags: "Brīdinājumi",
  damages: "Fiksētie bojājumi",
  brands: "Title atzīmes",
  titles: "Title (īpašumtiesību) ieraksti",
  sales: "Pārdošanas un izsoļu vēsture",
  liens: "Ķīlas, aizturēšana, eksports",
  thefts: "Zādzības",
} as const;

export type AsvCheckRow = CcVinCheckRow;
export type AsvDamageRow = CcVinDamageRow;
export type AsvRecordRow = CcVinRecordRow;
export type AsvTitleRow = CcVinTitleRow;
export type AsvSaleRow = CcVinSaleRow;
export type AsvPdfChecklist = CcVinPdfChecklist;

export type AsvBlockState = {
  reportDate: string;
  attentionMarks: string;
  ownersCount: string;
  /** lite | full | lite+full — admin, nav PDF. */
  productUsed: string;
  reportId: string;
  lastCostUsd: string;
  lastFetchedVin: string;
  fetchedAt: string;
  checks: AsvCheckRow[];
  mileage: AutoRecordsServiceRow[];
  damages: AsvDamageRow[];
  brands: AsvRecordRow[];
  titles: AsvTitleRow[];
  sales: AsvSaleRow[];
  liens: AsvRecordRow[];
  thefts: AsvRecordRow[];
  comments: string;
  rawUnprocessedData: string;
  aiContextRaw: string;
  photos: AsvPhotoMeta[];
  photoGroups: AsvPhotoGroup[];
  hidePhotoWatermarks?: boolean;
  pdfChecklist?: AsvPdfChecklist;
};

export function emptyAsvMileageRow(): AutoRecordsServiceRow {
  return emptyCcVinMileageRow();
}

export function emptyAsvCheckRow(): AsvCheckRow {
  return emptyCcVinCheckRow();
}

export function emptyAsvDamageRow(): AsvDamageRow {
  return emptyCcVinDamageRow();
}

export function emptyAsvRecordRow(): AsvRecordRow {
  return emptyCcVinRecordRow();
}

export function emptyAsvTitleRow(): AsvTitleRow {
  return emptyCcVinTitleRow();
}

export function emptyAsvSaleRow(): AsvSaleRow {
  return emptyCcVinSaleRow();
}

export function emptyAsvBlock(): AsvBlockState {
  return {
    reportDate: "",
    attentionMarks: "",
    ownersCount: "",
    productUsed: "",
    reportId: "",
    lastCostUsd: "",
    lastFetchedVin: "",
    fetchedAt: "",
    checks: [],
    mileage: [emptyAsvMileageRow()],
    damages: [emptyAsvDamageRow()],
    brands: [emptyAsvRecordRow()],
    titles: [emptyAsvTitleRow()],
    sales: [emptyAsvSaleRow()],
    liens: [emptyAsvRecordRow()],
    thefts: [emptyAsvRecordRow()],
    comments: "",
    rawUnprocessedData: "",
    aiContextRaw: "",
    photos: [],
    photoGroups: [],
  };
}

export const asvCheckRowHasData = ccVinCheckRowHasData;
export const asvDamageRowHasData = ccVinDamageRowHasData;
export const asvRecordRowHasData = ccVinRecordRowHasData;
export const asvTitleRowHasData = ccVinTitleRowHasData;
export const asvSaleRowHasData = ccVinSaleRowHasData;
export const asvAmountToEurDisplay = ccVinAmountToEurDisplay;

export function countAsvRecords(b: AsvBlockState | null | undefined): number {
  if (!b) return 0;
  return (
    (b.mileage ?? []).filter(autoRecordsRowHasData).length +
    (b.damages ?? []).filter(asvDamageRowHasData).length +
    (b.brands ?? []).filter(asvRecordRowHasData).length +
    (b.titles ?? []).filter(asvTitleRowHasData).length +
    (b.sales ?? []).filter(asvSaleRowHasData).length +
    (b.liens ?? []).filter(asvRecordRowHasData).length +
    (b.thefts ?? []).filter(asvRecordRowHasData).length
  );
}

export function asvAlertChecks(b: AsvBlockState | null | undefined): AsvCheckRow[] {
  return ccVinAlertChecks(asvBlockToCcVinView(b));
}

export function asvBlockHasContent(b: AsvBlockState | null | undefined): boolean {
  if (!b) return false;
  if (countAsvRecords(b) > 0) return true;
  if ((b.checks ?? []).some(asvCheckRowHasData)) return true;
  if ((b.photoGroups ?? []).some((g) => (g.photos ?? []).length > 0)) return true;
  return Boolean(b.comments.trim() || b.reportDate.trim() || b.attentionMarks.trim());
}

export function asvBlockHasOperatorData(b: AsvBlockState | null | undefined): boolean {
  if (!b) return false;
  if (asvBlockHasContent({ ...b, comments: "" })) return true;
  if (b.ownersCount.trim()) return true;
  if (b.rawUnprocessedData.trim()) return true;
  if (b.aiContextRaw.trim()) return true;
  if (b.productUsed.trim() || b.reportId.trim()) return true;
  return false;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function normalizeChecklist(raw: unknown): AsvPdfChecklist {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    incidents: o.incidents === true,
    mileageHistory: o.mileageHistory === true,
    mileageLine: o.mileageLine === true,
  };
}

function arr(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function rowObj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

export function normalizeAsvBlock(raw: unknown): AsvBlockState {
  const e = emptyAsvBlock();
  if (!raw || typeof raw !== "object") return e;
  const o = raw as Record<string, unknown>;
  const withFallback = <T>(rows: T[], empty: () => T): T[] => (rows.length > 0 ? rows : [empty()]);

  const checks = arr(o.checks)
    .map((x) => {
      const r = rowObj(x);
      const severity = r.severity === "alert" ? "alert" : "ok";
      return { label: str(r.label, 120), status: str(r.status, 120), severity } as AsvCheckRow;
    })
    .filter(asvCheckRowHasData);

  const mileage = arr(o.mileage)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        odometer: str(r.odometer, 40),
        country: str(r.country, 120),
      } as AutoRecordsServiceRow;
    })
    .filter(autoRecordsRowHasData);

  const damages = arr(o.damages)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        region: str(r.region, 120),
        amount: str(r.amount, 60),
        description: str(r.description, 400),
      } as AsvDamageRow;
    })
    .filter(asvDamageRowHasData);

  const records = (key: "brands" | "liens" | "thefts") =>
    arr(o[key])
      .map((x) => {
        const r = rowObj(x);
        return { date: str(r.date, 40), label: str(r.label, 160), detail: str(r.detail, 400) } as AsvRecordRow;
      })
      .filter(asvRecordRowHasData);

  const titles = arr(o.titles)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        region: str(r.region, 120),
        odometer: str(r.odometer, 40),
        note: str(r.note, 200),
      } as AsvTitleRow;
    })
    .filter(asvTitleRowHasData);

  const sales = arr(o.sales)
    .map((x) => {
      const r = rowObj(x);
      return {
        date: str(r.date, 40),
        venue: str(r.venue, 160),
        odometer: str(r.odometer, 40),
        price: str(r.price, 60),
        status: str(r.status, 80),
      } as AsvSaleRow;
    })
    .filter(asvSaleRowHasData);

  const synced = syncAsvPhotoGroupsAndFlat(normalizeAsvPhotoGroups(o.photoGroups, o.photos));

  return {
    reportDate: str(o.reportDate, 40),
    attentionMarks: str(o.attentionMarks, 20),
    ownersCount: str(o.ownersCount, 20),
    productUsed: str(o.productUsed, 40),
    reportId: str(o.reportId, 80),
    lastCostUsd: str(o.lastCostUsd, 20),
    lastFetchedVin: str(o.lastFetchedVin, 20),
    fetchedAt: str(o.fetchedAt, 40),
    checks,
    mileage: withFallback(mileage, emptyAsvMileageRow),
    damages: withFallback(damages, emptyAsvDamageRow),
    brands: withFallback(records("brands"), emptyAsvRecordRow),
    titles: withFallback(titles, emptyAsvTitleRow),
    sales: withFallback(sales, emptyAsvSaleRow),
    liens: withFallback(records("liens"), emptyAsvRecordRow),
    thefts: withFallback(records("thefts"), emptyAsvRecordRow),
    comments: str(o.comments, 12000),
    rawUnprocessedData: str(o.rawUnprocessedData, 200000),
    aiContextRaw: str(o.aiContextRaw, 200000),
    photos: synced.photos,
    photoGroups: synced.photoGroups,
    hidePhotoWatermarks: o.hidePhotoWatermarks === false ? false : true,
    ...("pdfChecklist" in o ? { pdfChecklist: normalizeChecklist(o.pdfChecklist) } : {}),
  };
}

/** PDF / unified tabulas: ASV kā CC.VIN formas skats (bez ķīlām / zādzībām). */
export function asvBlockToCcVinView(b: AsvBlockState | null | undefined): CcVinBlockState | null {
  if (!b) return null;
  return {
    reportDate: b.reportDate,
    attentionMarks: b.attentionMarks,
    ownersCount: b.ownersCount,
    checks: b.checks,
    mileage: b.mileage,
    damages: b.damages,
    insurance: [],
    brands: b.brands,
    titles: b.titles,
    sales: b.sales,
    comments: b.comments,
    rawUnprocessedData: b.rawUnprocessedData,
    aiContextRaw: b.aiContextRaw,
    photos: [],
    photoGroups: [],
  };
}

export function asvBlockToPlainText(b: AsvBlockState | null | undefined): string {
  if (!b || !asvBlockHasContent(b)) return "";
  const lines: string[] = [ASV_PDF_TITLE];
  if (b.productUsed.trim()) lines.push(`Produkts: ${b.productUsed.trim()}`);
  if (b.reportDate.trim()) lines.push(`Atskaites datums: ${b.reportDate.trim()}`);
  if (b.attentionMarks.trim()) lines.push(`Atzīmes reģistros: ${b.attentionMarks.trim()}`);
  if (b.ownersCount.trim()) lines.push(`Īpašnieku skaits: ${b.ownersCount.trim()}`);

  const alerts = asvAlertChecks(b);
  if (alerts.length > 0) {
    lines.push(ASV_SUBTITLES.flags);
    for (const c of alerts) lines.push(`${c.label}: ${c.status}`);
  }

  const mileage = (b.mileage ?? []).filter(autoRecordsRowHasData);
  if (mileage.length > 0) {
    lines.push("Odometra ieraksti (km)");
    for (const r of mileage) lines.push([r.date, r.odometer, r.country].filter(Boolean).join("\t"));
  }

  const damages = (b.damages ?? []).filter(asvDamageRowHasData);
  if (damages.length > 0) {
    lines.push(ASV_SUBTITLES.damages);
    for (const r of damages) {
      lines.push([r.date, r.description, r.amount, r.region].filter(Boolean).join("\t"));
    }
  }

  const simple = (title: string, rows: AsvRecordRow[]) => {
    const printable = rows.filter(asvRecordRowHasData);
    if (printable.length === 0) return;
    lines.push(title);
    for (const r of printable) lines.push([r.date, r.label, r.detail].filter(Boolean).join("\t"));
  };
  simple(ASV_SUBTITLES.brands, b.brands ?? []);
  simple(ASV_SUBTITLES.liens, b.liens ?? []);
  simple(ASV_SUBTITLES.thefts, b.thefts ?? []);

  const titles = (b.titles ?? []).filter(asvTitleRowHasData);
  if (titles.length > 0) {
    lines.push(ASV_SUBTITLES.titles);
    for (const r of titles) lines.push([r.date, r.region, r.odometer, r.note].filter(Boolean).join("\t"));
  }

  const sales = (b.sales ?? []).filter(asvSaleRowHasData);
  if (sales.length > 0) {
    lines.push(ASV_SUBTITLES.sales);
    for (const r of sales) {
      lines.push([r.date, r.venue, r.odometer, r.price, r.status].filter(Boolean).join("\t"));
    }
  }

  const comments = b.comments.trim();
  if (comments) lines.push(`Komentāri\n${comments}`);
  return lines.join("\n");
}

export function asvCcVinViewHasContent(b: AsvBlockState | null | undefined): boolean {
  return ccVinBlockHasContent(asvBlockToCcVinView(b));
}
