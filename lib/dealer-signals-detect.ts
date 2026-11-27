/**
 * «Signāli ārpus dīlera datiem» - tīra noteikšana no pasūtījuma workspace datiem.
 * Atgriež tikai tipus (viens uz tipu neatkarīgi no avotu skaita); teksti - `lib/dealer-signals.ts`.
 * Avotu nosaukumi, skaitļi un datumi ārā netiek doti.
 */

import {
  mergeSourceBlocksWithDefaults,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { DEALER_SIGNAL_KINDS, type DealerSignalKind } from "@/lib/dealer-signals-persist";
import type { SourceIssue } from "@/lib/source-consistency";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";

export type DealerSignalsDetectInput = {
  sourceBlocks: WorkspaceSourceBlocks | null | undefined;
  /** `checkSourceConsistency` rezultāts (ar admina atzīmēm - noraidītie ir `info`). */
  sourceIssues?: readonly Pick<SourceIssue, "kind" | "severity">[] | null;
};

/** Ārvalstu reģistri (lkf.ee - apdrošināšana, tā nonāk negadījumos). */
const FOREIGN_REGISTRY_KEYS = ["tjekbil", "finnik", "mnt_ee", "carinfo", "traficom_fi"] as const;

function filled(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "" && v.trim() !== "-";
}

/** Rinda ar faktu (datums + km vai notikums); tikai valsts / izcelsme neskaitās. */
function registryRowHasFact(row: { date?: string; odometer?: string; event?: string }): boolean {
  return filled(row.date) && (filled(row.odometer) || filled(row.event));
}

/**
 * Nobraukums: dīlera pret reģistru (#1305, ne «info») vai kritisks kritums starp avotiem.
 * Parastie «warn» kritumi (pārrakstīšanās, sludinājums, zema ticamība) netiek skaitīti.
 */
export function hasMileageMismatchSignal(issues: DealerSignalsDetectInput["sourceIssues"]): boolean {
  return (issues ?? []).some(
    (i) =>
      (i.kind === "dealer_registry_mileage" && i.severity !== "info") ||
      (i.kind === "mileage_drop" && i.severity === "critical"),
  );
}

/** Negadījumi: jebkurš avots ar negadījuma rindu (tā pati atlase kā kopējā negadījumu tabulā). */
export function hasIncidentSignal(blocks: WorkspaceSourceBlocks): boolean {
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab, { csdd: blocks.csdd }),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  });
  return rows.length > 0;
}

/** Izsoļu fotogrāfijas: izsoļu arhīva bildes vai izsoļu ierakstu (TheCarApi) bildes. */
export function hasAuctionPhotoSignal(blocks: WorkspaceSourceBlocks): boolean {
  const cc = blocks.cc_vin;
  if ((cc.photos ?? []).length > 0) return true;
  if ((cc.photoGroups ?? []).some((g) => (g.photos ?? []).length > 0)) return true;
  return (cc.thecarapiRecords ?? []).some((r) => (r.photos ?? []).length > 0 || (r.photoUrls ?? []).some((u) => u.trim() !== ""));
}

/** Citas valsts reģistrs: kādā ārvalstu reģistrā ir nobraukuma vai hronoloģijas ieraksts. */
export function hasForeignRegistrySignal(blocks: WorkspaceSourceBlocks): boolean {
  return FOREIGN_REGISTRY_KEYS.some((k) => {
    const b = blocks[k];
    return (b.mileage ?? []).some(registryRowHasFact) || (b.timeline ?? []).some(registryRowHasFact);
  });
}

/** Atrastie signālu tipi kanoniskā secībā. Viena pārbaude ar dīvainiem datiem neaptur pārējās. */
export function detectDealerSignals(input: DealerSignalsDetectInput): DealerSignalKind[] {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks ?? {});
  const checks: Record<DealerSignalKind, () => boolean> = {
    mileage_mismatch: () => hasMileageMismatchSignal(input.sourceIssues),
    incidents: () => hasIncidentSignal(blocks),
    auction_photos: () => hasAuctionPhotoSignal(blocks),
    foreign_registry: () => hasForeignRegistrySignal(blocks),
  };
  return DEALER_SIGNAL_KINDS.filter((k) => {
    try {
      return checks[k]();
    } catch {
      return false;
    }
  });
}
