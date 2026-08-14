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
import type {
  ProvinAlertBanner,
  ProvinAlertBannerKind,
  ProvinInfoBanner,
  ProvinManualBanner,
  ProvinManualBannerSeverity,
} from "@/lib/provin-alert-banners";
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
  /** Bāzes plāksnītes — fiksēti id; brīdinājumu un manuālās kartītes — `alert-…`, `manual-…`. */
  id: string;
  label: string;
  value: string;
  note: string;
  tone: PdfSummaryTileTone;
  /** Gara teksta kartīte — režģī aizņem abas kolonnas. */
  wide?: boolean;
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

/**
 * Automātiskie brīdinājumi kā kartītes. Odometrs un negadījumi jau ir bāzes plāksnītēs
 * (tie paši aprēķini), tāpēc tos neatkārtojam.
 */
const ALERT_CARD_COPY: Record<ProvinAlertBannerKind, { label: string; value: string; note: string } | null> = {
  odometer: null,
  incidents: null,
  tirgus_high_supply: {
    label: "Sludinājuma vecums",
    value: "Ilgi pārdošanā",
    note: "Tirgū virs 200 dienām — iespējama zema likviditāte vai slēpti defekti",
  },
  particulate: {
    label: "Izplūdes cietās daļiņas",
    value: "Paaugstināts līmenis",
    note: "Pēdējā apskatē fiksēts pārsniegums — iespējami izplūdes sistēmas defekti",
  },
  inspection: {
    label: "Tehniskā apskate",
    value: "Termiņš beidzas",
    note: "Nav derīgas apskates vai tās termiņš tuvojas beigām",
  },
};

const MANUAL_CARD_DEFAULT_LABEL: Record<ProvinManualBannerSeverity, string> = {
  grey: "Informācija",
  yellow: "Brīdinājums",
  red: "Svarīgi",
};

/** Īsāks teksts iztiek bez atsevišķas paskaidrojuma rindas — tas kļūst par kartītes vērtību. */
const MANUAL_CARD_VALUE_MAX_CHARS = 42;

function manualSeverityToTone(severity: ProvinManualBannerSeverity): PdfSummaryTileTone {
  if (severity === "red") return "alert";
  if (severity === "yellow") return "warn";
  return "neutral";
}

/** Brīdinājumu, informatīvās un manuālās kartītes — tāds pats formāts kā bāzes plāksnītēm. */
export function buildPdfSummaryBannerTiles(input: {
  manualBanners?: ProvinManualBanner[];
  alertBanners?: ProvinAlertBanner[];
  infoBanners?: ProvinInfoBanner[];
}): PdfSummaryTile[] {
  const out: PdfSummaryTile[] = [];

  for (const b of input.manualBanners ?? []) {
    const text = b.text.trim();
    const explicitValue = (b.value ?? "").trim();
    const value = explicitValue || (text.length <= MANUAL_CARD_VALUE_MAX_CHARS ? text : "");
    const note = value === text ? "" : text;
    out.push({
      id: `manual-${b.id}`,
      label: (b.title ?? "").trim() || MANUAL_CARD_DEFAULT_LABEL[b.severity],
      value,
      note,
      tone: manualSeverityToTone(b.severity),
      wide: value === "",
    });
  }

  for (const b of input.alertBanners ?? []) {
    const copy = ALERT_CARD_COPY[b.kind];
    if (!copy) continue;
    out.push({
      id: `alert-${b.kind}`,
      label: copy.label,
      value: copy.value,
      note: copy.note,
      tone: b.severity === "red" ? "alert" : "warn",
    });
  }

  for (const b of input.infoBanners ?? []) {
    out.push({ id: `info-${b.kind}`, label: b.label, value: b.value, note: b.note, tone: "neutral" });
  }

  return out;
}
