import "server-only";

/**
 * Viens VIN SCAN izpildītājs ar kešu: VIN SCAN / «Ātrā pārbaude» lapa (`/api/admin/vin-scan`)
 * un «Ātrie vērtējumi» lieto šo pašu funkciju, to pašu avotu sarakstu un to pašu momentuzņēmumu pēc VIN.
 * Tā jauns avots katalogā automātiski nonāk abās vietās, un userscript (pārlūka) importi redzami abās.
 */

import { preferBrowserArchiveImport } from "@/lib/order-vin-scan-browser-html";
import { mergeVinScanIndicators } from "@/lib/order-vin-scan";
import { defaultVinScanSourceIds, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { overlayVinScanBrowserImports } from "@/lib/vin-scan/browser-import-overlay";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { mergeVinScanPlates, vinScanPlateStaleSourceIds } from "@/lib/vin-scan/plate-cache";
import type { VinScanPlates } from "@/lib/vin-scan/plates";
import { runVinScan } from "@/lib/vin-scan/run";
import { pickReusableVinScanRows, stampVinScanRows } from "@/lib/vin-scan/source-ttl";
import { readVinScanBrowserImports, readVinScanSnapshot, writeVinScanSnapshot } from "@/lib/vin-scan/store";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { isValidVin } from "@/lib/order-field-validation";
import { kfzExactDateDdMmYyyy } from "@/lib/kfzgutachten/kfzgutachten";

export type SharedVinScanInput = {
  vin: string;
  plates: VinScanPlates;
  listingUrl?: string;
  /** Nav norādīts - VIN SCAN noklusējums (`defaultVinScanSourceIds`). */
  sourceIds?: readonly VinScanSourceId[];
  /** true: neņem neko no keša un ignorē circuit breaker. */
  force?: boolean;
  /** Maksas avoti, ko admins skaidri ieķeksēja (sk. `sanitizeVinScanPaidSourceIds`). */
  allowPaid?: readonly string[];
};

export type SharedVinScanResult = {
  vin: string;
  plates: VinScanPlates;
  scannedAt: string;
  indicators: VinScanIndicator[];
  /** Tikai šajā reizē skenētās rindas (avotu veselībai). */
  scanned: VinScanIndicator[];
};

/** DD.MM.YYYY no kfzgutachten.at saites `?vin=…&date=…` (vai ""). */
export function kfzDateFromRowUrl(url: string | null | undefined): string {
  let raw = String(url ?? "");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* paliek kā ir */
  }
  return kfzExactDateDdMmYyyy(/[?&]date=([0-9.]{10})/.exec(raw)?.[1] ?? "");
}

export async function runSharedVinScan(input: SharedVinScanInput): Promise<SharedVinScanResult> {
  const { vin, plates, force = false } = input;
  const listingUrl = input.listingUrl?.trim() ?? "";
  const requested = input.sourceIds ?? defaultVinScanSourceIds();
  const prevRaw = isValidVin(vin) ? await readVinScanSnapshot(vin).catch(() => null) : null;
  const prev = prevRaw && prevRaw.vin === vin ? prevRaw : null;
  const nowMs = Date.now();
  // Numura avotu rindas no cita numura nedrīkst atkārtoti lietot.
  const plateStale = prev ? vinScanPlateStaleSourceIds(prev.plates, plates) : new Set<string>();
  const scanPlates = prev ? mergeVinScanPlates(prev.plates, plates) : plates;
  // Katra rinda pēc sava avota TTL (reģistri 7 d / 3 d, izsoļu arhīvi 30 d, sludinājumi 12 h).
  const reusable = prev
    ? pickReusableVinScanRows(prev.indicators, prev.scannedAt, nowMs, force).filter((row) => !plateStale.has(row.id))
    : [];
  const cachedIds = new Set(reusable.map((row) => row.id));
  const toScan = requested.filter((id) => !cachedIds.has(id));
  // kfzgutachten.at vajag CSDD 1. reģ. datumu. CSDD rinda no keša datumu nenes: ņemam to no iepriekšējās
  // kfz_at saites (`date=`), bet, ja tādas nav, CSDD šoreiz skenē vēlreiz (tas pats bezmaksas pieprasījums).
  const kfzDate = toScan.includes("kfz_at") ? kfzDateFromRowUrl(prev?.indicators.find((row) => row.id === "kfz_at")?.openUrl) : "";
  const csddFound = reusable.some((row) => row.id === "csdd" && row.status === "found");
  if (toScan.includes("kfz_at") && !kfzDate && csddFound && !toScan.includes("csdd") && requested.includes("csdd")) toScan.push("csdd");
  const scanned = stampVinScanRows(
    toScan.length
      ? await runVinScan({
          vin,
          plates: scanPlates,
          listingUrl,
          ...(kfzDate ? { firstRegDate: kfzDate } : {}),
          sourceIds: toScan,
          ignoreBreaker: force,
          allowPaid: input.allowPaid ?? [],
        })
      : [],
    new Date(nowMs).toISOString(),
    true,
  );
  // Vecās rindas patur savu laiku, citādi jaunais momentuzņēmuma scannedAt tās padarītu "svaigas".
  const base = prev
    ? stampVinScanRows(
        prev.indicators.filter((row) => !plateStale.has(row.id)),
        prev.scannedAt,
      )
    : [];
  const scannedAt = scanned.length ? new Date().toISOString() : prev?.scannedAt || new Date().toISOString();
  // Skenēšana ilgst līdz ~105 s; pa to laiku saglabātie pārlūka importi nav `prev`, tāpēc tos pārlasa tieši pirms rakstīšanas.
  const lateImports = isValidVin(vin) && scanned.length ? await readVinScanBrowserImports(vin).catch(() => []) : [];
  const indicators = applyFinlandLinkToIndicators(
    overlayVinScanBrowserImports(
      preferBrowserArchiveImport(base, mergeVinScanIndicators(base, scanned)),
      scannedAt,
      lateImports,
    ),
    scanPlates,
  );
  if (isValidVin(vin) && scanned.length) {
    await writeVinScanSnapshot({ vin, plates: scanPlates, scannedAt, indicators }).catch((err) => {
      console.warn(
        JSON.stringify({
          vinScanStore: true,
          event: "snapshot_write_failed",
          msg: err instanceof Error ? err.message : "write_failed",
        }),
      );
    });
  }
  return { vin, plates: scanPlates, scannedAt, indicators, scanned };
}
