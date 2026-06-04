import "server-only";

import {
  autoRecordsBlockToPlainText,
  csddFormToPlainText,
  mergeSourceBlocksWithDefaults,
  tirgusFormToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  formatIrissListingsForGemini,
  pickIrissListingComps,
} from "@/lib/iriss-listings-gemini-filter";
import { readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import {
  fetchListingAiSnapshot,
  formatListingAiSnapshotForGemini,
  type ListingAiSnapshot,
} from "@/lib/listing-scrape";
import {
  outvinBundleHasStructuredContent,
  outvinDealerServiceRowHasData,
} from "@/lib/outvin-data-bundle";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";
import {
  outvinDealerReportHasContent,
  outvinDealerReportToPlainText,
} from "@/lib/outvin-dealer-types";

function extractMarketSearchHints(
  blocks: WorkspaceSourceBlocks,
  listingSnapshot: ListingAiSnapshot | null,
): string {
  const parts: string[] = [];
  const csdd = blocks.csdd;
  if (csdd.makeModel.trim()) parts.push(csdd.makeModel.trim());
  if (csdd.registrationNumber.trim()) parts.push(csdd.registrationNumber.trim());
  if (listingSnapshot?.ok && listingSnapshot.pageTitle?.trim()) {
    parts.push(listingSnapshot.pageTitle.trim());
  }
  for (const { label, value } of listingSnapshot?.options ?? []) {
    if (/marka|modelis|model/i.test(label) && value.trim()) parts.push(value.trim());
  }
  return parts.join(" ");
}

function formatOutvinAuctionContext(blocks: WorkspaceSourceBlocks): string {
  const ar = blocks.auto_records;
  const lines: string[] = [];
  const bundle = ar.outvin ?? getAutoRecordsOutvinBundle(ar);
  const report =
    ar.outvinReport && outvinDealerReportHasContent(ar.outvinReport)
      ? ar.outvinReport
      : bundle && outvinBundleHasStructuredContent(bundle)
        ? outvinBundleToDealerReport(bundle)
        : undefined;

  if (report && outvinDealerReportHasContent(report)) {
    lines.push("### Oficiālā dīlera / Outvin dati", outvinDealerReportToPlainText(report));
  }

  const us = bundle?.usCarfax;
  if (us && (us.auctionData.trim() || us.importDate.trim() || us.registeredDamage.trim())) {
    lines.push(
      "### ASV / izsoļu konteksts (Outvin)",
      [
        us.importDate.trim() ? `Importa datums: ${us.importDate.trim()}` : "",
        us.registeredDamage.trim() ? `Bojājumi: ${us.registeredDamage.trim()}` : "",
        us.auctionData.trim() ? `Izsoles dati: ${us.auctionData.trim()}` : "",
        us.usOdometer.trim() ? `ASV odometrs: ${us.usOdometer.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const euRows = (bundle?.europeanRegisters ?? []).filter(
    (r) => r.country.trim() || r.date.trim() || r.registerType.trim() || r.details.trim(),
  );
  if (euRows.length > 0) {
    lines.push("### Eiropas reģistri (Outvin)");
    for (const r of euRows) {
      lines.push(
        `- ${[r.date.trim(), r.country.trim(), r.registerType.trim(), r.details.trim()].filter(Boolean).join(" | ")}`,
      );
    }
  }

  const dealerLog = (bundle?.dealerServiceLog ?? []).filter(outvinDealerServiceRowHasData);
  if (dealerLog.length > 0) {
    lines.push("### Dīlera servisa žurnāls (Outvin)");
    for (const r of dealerLog.slice(0, 12)) {
      lines.push(`- ${r.date.trim()} | ${r.odometer.trim()} | ${r.country.trim()}`);
    }
  }

  const arPlain = autoRecordsBlockToPlainText(ar).trim();
  if (arPlain && lines.length === 0) {
    lines.push("### AUTO RECORDS", arPlain.slice(0, 6000));
  }

  return lines.join("\n\n");
}

/** ss.lv + IRISS EU izsoles + Outvin + admin tirgus lauki — Gemini tirgus/cenu analīzei. */
export async function buildMarketAnalysisGeminiContext(opts: {
  listingUrl?: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
}): Promise<{ text: string; listingSnapshot: ListingAiSnapshot | null }> {
  const blocks = mergeSourceBlocksWithDefaults(opts.sourceBlocks);
  const parts: string[] = [];

  let listingSnapshot: ListingAiSnapshot | null = null;
  const url = opts.listingUrl?.trim() ?? "";
  if (url) {
    listingSnapshot = await fetchListingAiSnapshot(url);
    parts.push(formatListingAiSnapshotForGemini(listingSnapshot));
  }

  const tirgusPlain = tirgusFormToPlainText(blocks.tirgus).trim();
  if (tirgusPlain) {
    parts.push(`### Tirgus dati (admin / TirgusDati.lv pārbaude)\n${tirgusPlain}`);
  }

  const outvinBlock = formatOutvinAuctionContext(blocks);
  if (outvinBlock.trim()) parts.push(outvinBlock);

  const csddPlain = csddFormToPlainText(blocks.csdd).trim();
  if (csddPlain) {
    parts.push(`### CSDD (īss konteksts)\n${csddPlain.slice(0, 4000)}`);
  }

  try {
    const latest = await readIrissListingsLatestView();
    if (latest?.items?.length) {
      const hints = extractMarketSearchHints(blocks, listingSnapshot);
      const comps = pickIrissListingComps(latest.items, hints);
      parts.push(formatIrissListingsForGemini(comps));
      if (latest.summary) {
        parts.push(
          `IRISS sinhronizācija: ${latest.summary.okCount}/${latest.summary.totalSources} avoti OK · ģenerēts ${latest.generatedAt}`,
        );
      }
    } else {
      parts.push(
        "### Eiropas izsoļu / wholesale portāli (IRISS)\nNav saglabātu salīdzinājumu — palaid IRISS → Sludinājumi → sinhronizāciju (Mobile.de, Autobid, OpenLane, AUTO1).",
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    parts.push(`### IRISS salīdzinājumi\nNeizdevās nolasīt agregātu: ${msg}`);
  }

  return { text: parts.filter(Boolean).join("\n\n"), listingSnapshot };
}
