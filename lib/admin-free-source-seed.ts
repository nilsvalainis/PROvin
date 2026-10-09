import "server-only";

import { applySsLvAdifyAutofill, shouldAutofillSsLvListing } from "@/lib/admin-ss-lv-adify-autofill";
import {
  applyNordicRegistryFetches,
  registrySeedNeeded,
  type NordicRegistryFetchBundle,
  type NordicRegistrySeedKey,
} from "@/lib/admin-denmark-registry-seed-apply";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { hasCaptchaSolverKey } from "@/lib/captcha-solver";
import { applyCsddTechDataToBlock, csddTechSeedNeeded } from "@/lib/csdd-tech-data-apply";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { fetchListingPriceHistory } from "@/lib/listing-price-history";
import { fetchListingAiSnapshot, formatListingSnapshotForPasteField } from "@/lib/listing-scrape";
import { isPlaceholderVin, isValidVin, isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { fetchVinSource } from "@/lib/vin-sources";
import type { VinSourceFetchResult } from "@/lib/vin-sources/types";

/**
 * Bezmaksas avotu ielase (sludinājuma vēsture, CSDD API, DK / EE / SE reģistri) vienam avotu bloku
 * komplektam. Neko nesaglabā: to dara izsaucējs (apmaksāts pasūtījums vai ātrais vērtējums).
 * Aizpilda tikai tukšus blokus; operatora ievadītais netiek pārrakstīts.
 * Ja klients norādīja numurzīmi, VIN ņem no CSDD atbildes un ar to ielasa ārzemju reģistrus.
 */

export type FreeSourceSeedParts = {
  listing?: string;
  csdd?: string;
  tjekbil?: string;
  mnt_ee?: string;
  lkf_ee?: string;
  carinfo?: string;
};

export type FreeSourceSeedOutcome = {
  blocks: WorkspaceSourceBlocks;
  parts: FreeSourceSeedParts;
  changed: boolean;
  listingFilled: boolean;
  /** VIN pēc CSDD (ja klients deva numurzīmi), citādi normalizētais ievadītais VIN. */
  resolvedVin: string;
};

function nordicReason(result: VinSourceFetchResult | undefined, needed: boolean, noSolver = false): string | undefined {
  if (!needed) return "skip";
  if (noSolver) return "no_solver";
  if (!result) return "error";
  return result.found ? "filled" : "not_found";
}

async function settle<T>(label: string, job: Promise<T>): Promise<T | null> {
  try {
    return await job;
  } catch (err) {
    console.error(`[free-source-seed] ${label}:`, err);
    return null;
  }
}

function usableVin(raw: string): string {
  const v = normalizeVin(raw);
  return v && isValidVin(v) && !isPlaceholderVin(v) ? v : "";
}

export async function computeFreeSourceSeed(
  baseline: WorkspaceSourceBlocks,
  opts: { vin?: string | null; listingUrl?: string | null },
): Promise<FreeSourceSeedOutcome> {
  let blocks = baseline;
  const listingUrl = opts.listingUrl?.trim() ?? "";
  const nr1 = normalizeVin(opts.vin ?? "");
  let nordicVin = usableVin(nr1);
  const csddNr = nr1 && isValidVinOrPlate(nr1) && !isPlaceholderVin(nr1) ? nr1 : "";

  const listingPasteEmpty = !String(blocks.listing_analysis.listingPasteRaw ?? "").trim();
  const doListing =
    listingUrl.length > 0 && (shouldAutofillSsLvListing(listingUrl, blocks.tirgus) || listingPasteEmpty);
  const doCsdd = Boolean(csddNr) && csddTechSeedNeeded(blocks.csdd);
  const solver = hasCaptchaSolverKey();

  const parts: FreeSourceSeedParts = {};
  if (!listingUrl) parts.listing = "no_listing_url";
  else if (!doListing) parts.listing = "skip";
  if (!csddNr) parts.csdd = nr1 ? "skip" : "no_vin";
  else if (!doCsdd) parts.csdd = "skip";

  const nordicNeed = (vin: string): Record<NordicRegistrySeedKey, boolean> => ({
    tjekbil: Boolean(vin) && registrySeedNeeded(blocks.tjekbil),
    mnt_ee: Boolean(vin) && registrySeedNeeded(blocks.mnt_ee),
    lkf_ee: Boolean(vin) && registrySeedNeeded(blocks.lkf_ee),
    carinfo: Boolean(vin) && registrySeedNeeded(blocks.carinfo),
  });

  const runNordic = async (vin: string, need: Record<NordicRegistrySeedKey, boolean>) => {
    const [tjekbil, mnt, lkf, carinfo] = await Promise.all([
      need.tjekbil ? settle("tjekbil", fetchVinSource("tjekbil", vin)) : Promise.resolve(null),
      need.mnt_ee && solver ? settle("mnt_ee", fetchVinSource("mnt_ee", vin)) : Promise.resolve(null),
      need.lkf_ee && solver ? settle("lkf_ee", fetchVinSource("lkf_ee", vin)) : Promise.resolve(null),
      need.carinfo ? settle("carinfo", fetchVinSource("carinfo", vin)) : Promise.resolve(null),
    ]);
    return { tjekbil, mnt, lkf, carinfo };
  };

  let need = nordicNeed(nordicVin);
  const [listingPair, csddRes, nordicFirst] = await Promise.all([
    doListing
      ? settle(
          "listing",
          Promise.all([fetchListingPriceHistory(listingUrl), fetchListingAiSnapshot(listingUrl).catch(() => null)]),
        )
      : Promise.resolve(null),
    doCsdd ? settle("csdd", fetchCsddTechData(csddNr)) : Promise.resolve(null),
    nordicVin ? runNordic(nordicVin, need) : Promise.resolve(null),
  ]);

  let listingFilled = false;
  if (doListing) {
    if (!listingPair) {
      parts.listing = "error";
    } else {
      const scrape = listingPair[1];
      const nextTirgus = shouldAutofillSsLvListing(listingUrl, blocks.tirgus)
        ? applySsLvAdifyAutofill(blocks.tirgus, listingUrl, listingPair[0], scrape)
        : null;
      if (nextTirgus) {
        blocks = { ...blocks, tirgus: nextTirgus };
        listingFilled = true;
        parts.listing = "filled";
      }
      const pasteText = scrape ? formatListingSnapshotForPasteField(scrape) : "";
      if (listingPasteEmpty && pasteText) {
        blocks = { ...blocks, listing_analysis: { ...blocks.listing_analysis, listingPasteRaw: pasteText } };
        listingFilled = true;
        if (parts.listing !== "filled") parts.listing = "paste";
      } else if (!nextTirgus && parts.listing !== "filled") {
        parts.listing = "no_adify_data";
      }
    }
  }

  let csddFilled = false;
  if (doCsdd) {
    if (!csddRes) {
      parts.csdd = "error";
    } else if (!csddRes.found) {
      parts.csdd = csddRes.message || "not_found";
    } else {
      const nextCsdd = applyCsddTechDataToBlock(blocks.csdd, csddRes.data);
      if (nextCsdd) {
        blocks = { ...blocks, csdd: nextCsdd };
        csddFilled = true;
        parts.csdd = "filled";
      } else {
        parts.csdd = "skip";
      }
    }
  }

  // Numurzīme → VIN no CSDD → ārzemju reģistri otrajā solī.
  let nordicResults = nordicFirst;
  if (!nordicVin) {
    const fromCsdd = usableVin(
      (csddRes && csddRes.found ? csddRes.data.vin : "") || blocks.csdd.registry?.data.vin || blocks.csdd.vin || "",
    );
    if (fromCsdd) {
      nordicVin = fromCsdd;
      need = nordicNeed(nordicVin);
      nordicResults = await runNordic(nordicVin, need);
    }
  }

  if (!nordicVin) {
    for (const k of ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const) parts[k] = nr1 ? "skip" : "no_vin";
  }

  const bundle: NordicRegistryFetchBundle = {
    tjekbil: nordicResults?.tjekbil ?? undefined,
    mnt_ee: nordicResults?.mnt ?? undefined,
    lkf_ee: nordicResults?.lkf ?? undefined,
    carinfo: nordicResults?.carinfo ?? undefined,
  };
  const nordic = applyNordicRegistryFetches(blocks, bundle);
  blocks = nordic.blocks;

  if (nordicVin) {
    parts.tjekbil = nordicReason(nordicResults?.tjekbil ?? undefined, need.tjekbil);
    parts.mnt_ee = nordicReason(nordicResults?.mnt ?? undefined, need.mnt_ee, need.mnt_ee && !solver);
    parts.lkf_ee = nordicReason(nordicResults?.lkf ?? undefined, need.lkf_ee, need.lkf_ee && !solver);
    parts.carinfo = nordicReason(nordicResults?.carinfo ?? undefined, need.carinfo);
  }

  return {
    blocks,
    parts,
    changed: listingFilled || csddFilled || nordic.applied.length > 0,
    listingFilled,
    resolvedVin: nordicVin || (isValidVin(nr1) ? nr1 : ""),
  };
}
