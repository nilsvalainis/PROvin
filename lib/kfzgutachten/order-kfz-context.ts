/**
 * Pasūtījuma (klienta un manuālā) bloki -> VIN SCAN v4 Austrijas §57a konteksts:
 * precīzs 1. reģ. datums (tā pati ķēde kā Citi avoti «Austrija»), CSDD iepriekšējā valsts, jau ielasītās apskates.
 */
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { findKfzAtSectionIndex, readKfzAtStore } from "@/lib/kfzgutachten/apply-citi";
import { resolveKfzFirstRegistration } from "@/lib/kfzgutachten/first-registration";

export type OrderVinScanKfzContext = {
  previousCountry: string;
  firstRegDate: string;
  orderId: string;
  listingUrl: string;
  listed: number;
};

export function orderVinScanKfzContext(
  blocks: WorkspaceSourceBlocks,
  sessionId: string,
  listingUrl?: string | null,
): OrderVinScanKfzContext {
  let firstRegDate = "";
  try {
    firstRegDate = resolveKfzFirstRegistration(blocks, { listingUrl }).date;
  } catch {
    firstRegDate = "";
  }
  const idx = findKfzAtSectionIndex(blocks.citi_avoti);
  const store = idx >= 0 ? readKfzAtStore(blocks.citi_avoti.sections[idx]) : null;
  return {
    previousCountry: String(blocks.csdd?.previousRegistrationCountry ?? ""),
    firstRegDate,
    orderId: sessionId,
    listingUrl: listingUrl ?? "",
    listed: (store?.list.length ?? 0) + (store?.reports.length ?? 0),
  };
}
