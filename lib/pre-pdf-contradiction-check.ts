/**
 * Deterministiska pretrunu pārbaude pirms PDF (galvene, grafiks, CSDD, anomālijas).
 * Tekstu nemaina. Nav maksas modeļa. Integrējas ar KANONISKAJIEM FAKTIEM (PR #272).
 */
import { formatForensicsInt } from "@/lib/admin-ai-mileage-forensics";
import { csddMileageRowHasData, type CsddFormFields } from "@/lib/admin-source-blocks";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  countChartMileageReadings,
  hasActiveRollbackAnomaly,
  selectNewestChartMileageRow,
  type OdometerAnomalyOverride,
} from "@/lib/odometer-anomaly-classify";
import { parseOdometerKm } from "@/lib/unified-mileage";
import {
  collectUnifiedMileageRows,
  prepareUnifiedMileageDisplayRows,
} from "@/lib/unified-mileage";
import { detectTotalLossFromPdfInput, headerMentionsTotalLoss } from "@/lib/total-loss-detect";
import {
  buildPdfReportSummaryTiles,
  type PdfSummaryInput,
  type PdfSummaryTile,
} from "@/lib/pdf-report-summary";
import { countVendorOwnershipChangeEvents } from "@/lib/owner-count-synthesis";
import type { FactCheckFlag } from "@/lib/unit-facts/types";
import { buildVehicleLifecycleEvents, type LifecycleEvent } from "@/lib/vehicle-lifecycle-timeline";

export type PrePdfContradictionInput = {
  summaryInput: PdfSummaryInput;
  tiles?: PdfSummaryTile[];
  overrides?: OdometerAnomalyOverride[] | null;
  lifecycleEvents?: LifecycleEvent[];
};

function flag(
  id: string,
  message: string,
  sentence: string,
  level: FactCheckFlag["level"] = "E",
): FactCheckFlag {
  return { id, kind: "contradiction", level, message, sentence };
}

function parseKmFromDisplay(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sameDayMs(a: string, b: string): boolean {
  const ma = parseDotOrIsoDateToMs(a);
  const mb = parseDotOrIsoDateToMs(b);
  if (ma <= 0 || mb <= 0) return false;
  const da = new Date(ma);
  const db = new Date(mb);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

export function csddMileageOnSameDate(csdd: CsddFormFields | null | undefined, date: string): string {
  if (!csdd || !date.trim()) return "";
  for (const r of csdd.mileageHistory ?? []) {
    if (!csddMileageRowHasData(r)) continue;
    if (sameDayMs(r.date, date) && r.odometer.trim()) return r.odometer.trim();
  }
  return "";
}

function mileageRowsFromInput(input: PdfSummaryInput) {
  return prepareUnifiedMileageDisplayRows(
    collectUnifiedMileageRows({
      csddForm: input.csddForm ?? undefined,
      autoRecordsBlock: input.autoRecordsBlock ?? undefined,
      oneautoBlock: input.oneautoBlock ?? undefined,
      ccVinBlock: input.ccVinBlock ?? null,
      asvBlock: input.asvBlock ?? null,
      manualVendorBlocks: input.manualVendorBlocks ?? undefined,
      citiAvotiBlock: input.citiAvoti ?? null,
      tirgusForm: input.tirgusForm ?? null,
      listingUrl: input.listingUrl ?? null,
    }),
  );
}

/**
 * C1-C4, C8, C9 un rollback pret galveni. Operatoram rāda pirms PDF.
 */
export function checkPrePdfContradictions(input: PrePdfContradictionInput): FactCheckFlag[] {
  const tiles = input.tiles ?? buildPdfReportSummaryTiles(input.summaryInput);
  const rows = mileageRowsFromInput(input.summaryInput);
  const flags: FactCheckFlag[] = [];
  const mileageTile = tiles.find((t) => t.id === "mileage");
  const incidentsTile = tiles.find((t) => t.id === "incidents");
  const ownersTile = tiles.find((t) => t.id === "owners");

  const chartCount = countChartMileageReadings(rows);
  const headerCountMatch = mileageTile?.note.match(/(\d+)\s+ierakst/);
  const headerCount = headerCountMatch ? Number(headerCountMatch[1]) : null;
  if (mileageTile && headerCount != null && chartCount > 0 && headerCount !== chartCount) {
    flags.push(
      flag(
        "c1_header_count",
        `Galvenes ierakstu skaits (${headerCount}) nesakrīt ar grafika punktiem (${chartCount}).`,
        mileageTile.note,
      ),
    );
  }

  const activeRollback = hasActiveRollbackAnomaly(rows, input.overrides);
  if (mileageTile && /bez pretrunām/i.test(mileageTile.note) && activeRollback) {
    flags.push(
      flag(
        "c2_rollback_clean_header",
        "Galvenē ir „bez pretrunām”, bet datos ir nobraukuma kritums.",
        mileageTile.note,
      ),
    );
  }

  const newest = selectNewestChartMileageRow(rows);
  const headerKm = mileageTile ? parseKmFromDisplay(mileageTile.value) : null;
  const lastKm = newest ? parseOdometerKm(newest.odometer) : null;
  if (mileageTile && headerKm != null && lastKm != null && Math.abs(headerKm - lastKm) > 500) {
    flags.push(
      flag(
        "c3_header_km",
        `Galvenes nobraukums (${formatForensicsInt(headerKm)} km) nav pēdējais grafika punkts (${formatForensicsInt(lastKm)} km).`,
        mileageTile.value,
      ),
    );
  }

  const events =
    input.lifecycleEvents ??
    buildVehicleLifecycleEvents({
      csddForm: input.summaryInput.csddForm,
      autoRecordsBlock: input.summaryInput.autoRecordsBlock,
      oneautoBlock: input.summaryInput.oneautoBlock,
      ccVinBlock: input.summaryInput.ccVinBlock,
      asvBlock: input.summaryInput.asvBlock,
      manualVendorBlocks: input.summaryInput.manualVendorBlocks,
      manualLtabBlock: input.summaryInput.manualLtabBlock,
      citiAvoti: input.summaryInput.citiAvoti,
      tirgusForm: input.summaryInput.tirgusForm,
      listingUrl: input.summaryInput.listingUrl,
    });
  for (const e of events) {
    if (e.kind !== "inspection" || !e.sources.includes("CSDD")) continue;
    const csddKm = parseOdometerKm(csddMileageOnSameDate(input.summaryInput.csddForm, e.date));
    const eventKm = parseOdometerKm(e.odometer);
    if (csddKm != null && eventKm != null && Math.abs(csddKm - eventKm) > 50) {
      flags.push(
        flag(
          "c4_timeline_ta_km",
          `Laika līnijas TA ${e.date} rāda ${formatForensicsInt(eventKm)} km, CSDD nobraukuma vēsturē tajā datumā ${formatForensicsInt(csddKm)} km.`,
          `${e.date} ${e.title} ${e.odometer}`,
        ),
      );
    }
  }

  const classified = applyOdometerAnomalyOverrides(classifyOdometerAnomalies(rows), input.overrides);
  for (const a of classified) {
    const level: FactCheckFlag["level"] = a.class === "rollback" ? "E" : "W";
    flags.push({
      id: `odo_${a.class}_${a.sourceOrder}`,
      kind: "contradiction",
      level,
      message: `${a.labelLv}: ${formatForensicsInt(a.fromKm)} km (${a.fromDate}) → ${formatForensicsInt(a.toKm)} km (${a.toDate}), kritums ${formatForensicsInt(a.dropKm)} km.`,
      sentence: `${a.toDate} ${formatForensicsInt(a.toKm)} km`,
    });
  }

  const loss = detectTotalLossFromPdfInput(input.summaryInput);
  const incidentsBlob = incidentsTile ? `${incidentsTile.value} ${incidentsTile.note}` : "";
  if (loss.found && incidentsTile && !headerMentionsTotalLoss(incidentsBlob)) {
    flags.push(
      flag(
        "c8_total_loss",
        "Avotos ir pilnīgs zaudējums / bojāeja, bet kopsavilkuma kartītē tas nav norādīts.",
        incidentsTile.value || "Negadījumi",
      ),
    );
  }

  const changeCount = countVendorOwnershipChangeEvents(input.summaryInput.manualVendorBlocks);
  const lvEvents = (input.summaryInput.csddForm?.ownerRegistrationEvents ?? []).filter(
    (r) => r.date.trim() || r.label.trim(),
  ).length;
  if (ownersTile && /nav ierakstu/i.test(ownersTile.value) && (changeCount > 0 || lvEvents > 0)) {
    flags.push(
      flag(
        "c9_owners_empty",
        "Īpašnieku kartīte rāda „Nav ierakstu”, lai gan datos ir reģistrāciju maiņas.",
        ownersTile.value,
      ),
    );
  }

  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "E" ? -1 : 1));
  return flags;
}
