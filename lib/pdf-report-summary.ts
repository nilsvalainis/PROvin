/**
 * Klienta PDF — atskaites kopsavilkuma plāksnītes (pirmā lapa).
 * Tikai jau savākto datu interpretācija: negadījumi, nobraukums, reģistrācija, servisa dziļums.
 */

import { autoRecordsRowHasData } from "@/lib/auto-records-paste-parse";
import { autoRecordsServiceWorkRowIsPrintable } from "@/lib/auto-records-service-works";
import type {
  AutoRecordsBlockState,
  CitiAvotiBlockState,
  ClientManualLtabBlockPdf,
  ClientManualVendorBlockPdf,
  CsddFormFields,
} from "@/lib/admin-source-blocks";
import { ltabRowHasData } from "@/lib/admin-source-blocks";
import {
  aggregateUnifiedIncidents,
  collectUnifiedIncidentDamageDetails,
  collectUnifiedIncidentRows,
  formatUnifiedIncidentCountLabel,
} from "@/lib/unified-incidents";
import {
  analyzeUnifiedMileageAnomalies,
  collectUnifiedMileageRows,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";

export type PdfSummaryTileTone = "ok" | "warn" | "alert" | "neutral";

export type PdfSummaryTile = {
  id: "incidents" | "mileage" | "registration" | "service";
  label: string;
  value: string;
  note: string;
  tone: PdfSummaryTileTone;
};

export type PdfSummaryInput = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  citiAvoti?: CitiAvotiBlockState | null;
};

export const PDF_REPORT_SUMMARY_TITLE = "ATSKAITES KOPSAVILKUMS";

function pluralLv(count: number, one: string, many: string): string {
  const isOne = count % 10 === 1 && count % 100 !== 11;
  return `${count} ${isOne ? one : many}`;
}

function buildIncidentsTile(input: PdfSummaryInput): PdfSummaryTile {
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks: input.manualVendorBlocks ?? null,
    manualLtabBlock: input.manualLtabBlock ?? null,
  });
  const agg = aggregateUnifiedIncidents(
    rows,
    collectUnifiedIncidentDamageDetails(input.manualVendorBlocks ?? null),
  );
  const count = agg.uniqueCount;
  if (count === 0) {
    return {
      id: "incidents",
      label: "Negadījumi un bojājumi",
      value: "Nav ierakstu",
      note: "Avotos nav fiksētu negadījumu",
      tone: "ok",
    };
  }
  const newest = agg.clusters[0];
  const withDamage = agg.clusters.filter((c) => c.damage && c.damage.zoneIds.length > 0).length;
  const noteParts: string[] = [];
  if (newest?.date && newest.date !== "—") noteParts.push(`Jaunākais: ${newest.date}`);
  if (withDamage > 0) noteParts.push(`${withDamage} ar bojājumu zonām`);
  return {
    id: "incidents",
    label: "Negadījumi un bojājumi",
    value: formatUnifiedIncidentCountLabel(count),
    note: noteParts.join(" · "),
    tone: count > 1 ? "alert" : "warn",
  };
}

function buildMileageTile(input: PdfSummaryInput): PdfSummaryTile {
  const rows = prepareUnifiedMileageDisplayRows(
    collectUnifiedMileageRows({
      csddForm: input.csddForm ?? undefined,
      autoRecordsBlock: input.autoRecordsBlock ?? undefined,
      manualVendorBlocks: input.manualVendorBlocks ?? undefined,
      citiAvotiBlock: input.citiAvoti ?? null,
    }),
  );
  if (rows.length === 0) {
    return {
      id: "mileage",
      label: "Nobraukums",
      value: "Nav ierakstu",
      note: "Odometra ieraksti nav atrasti",
      tone: "neutral",
    };
  }
  const { anomalyBySourceOrder } = analyzeUnifiedMileageAnomalies(rows);
  const anomalies = [...anomalyBySourceOrder.values()].filter(Boolean).length;
  const newest = [...rows].sort((a, b) => b.sortableTime - a.sortableTime)[0]!;
  const value = newest.odometer.trim() ? `${newest.odometer.trim()} km` : "Nav ierakstu";
  const note =
    anomalies > 0
      ? pluralLv(anomalies, "iespējama pretruna", "iespējamas pretrunas")
      : `${pluralLv(rows.length, "ieraksts", "ieraksti")} bez pretrunām`;
  return {
    id: "mileage",
    label: "Nobraukums",
    value,
    note,
    tone: anomalies > 0 ? "alert" : "ok",
  };
}

function buildRegistrationTile(input: PdfSummaryInput): PdfSummaryTile {
  const status = (input.csddForm?.registrationStatus ?? "").trim();
  const owners = (input.csddForm?.ownerCountLatvia ?? "").trim();
  const lower = status.toLowerCase();
  let tone: PdfSummaryTileTone = "neutral";
  if (/(arest|aizliegum|meklē|zādzīb)/.test(lower)) tone = "alert";
  else if (/(noņemts|atsavināt|norakstīt|utilizēt)/.test(lower)) tone = "warn";
  else if (/reģistrēt/.test(lower)) tone = "ok";
  return {
    id: "registration",
    label: "Reģistrācija",
    value: status || "Nav ierakstu",
    note: owners ? `Īpašnieki Latvijā: ${owners}` : "CSDD reģistrācijas statuss",
    tone,
  };
}

function buildServiceTile(input: PdfSummaryInput): PdfSummaryTile {
  const ar = input.autoRecordsBlock;
  const dealer =
    (ar?.serviceHistory ?? []).filter(autoRecordsRowHasData).length +
    (ar?.serviceWorks ?? []).filter(autoRecordsServiceWorkRowIsPrintable).length;
  const others = (input.citiAvoti?.sections ?? []).reduce(
    (sum, s) =>
      sum +
      (s.serviceHistory ?? []).filter(autoRecordsRowHasData).length +
      (s.incidents ?? []).filter(ltabRowHasData).length,
    0,
  );
  const total = dealer + others;
  return {
    id: "service",
    label: "Servisa vēsture",
    value: total === 0 ? "Nav ierakstu" : pluralLv(total, "ieraksts", "ieraksti"),
    note: total === 0 ? "Apkopju ieraksti nav atrasti" : "Ražotāja, dīlera un citu avotu apkopes",
    tone: total === 0 ? "neutral" : "ok",
  };
}

/** Kopsavilkuma plāksnītes secībā, kādā tās drukājas (vienmēr četras — arī tukšas ir informācija). */
export function buildPdfReportSummaryTiles(input: PdfSummaryInput): PdfSummaryTile[] {
  return [
    buildIncidentsTile(input),
    buildMileageTile(input),
    buildRegistrationTile(input),
    buildServiceTile(input),
  ];
}
