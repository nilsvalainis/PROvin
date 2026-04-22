import "server-only";

import { createHash } from "node:crypto";
import { readIrissListingsLatestView, writeIrissListingsRun } from "@/lib/iriss-listings-aggregate-store";
import { detectPlatformFromUrl, scrapeIrissListing } from "@/lib/iriss-listings-adapters";
import { listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";
import type {
  IrissListingAggregateItem,
  IrissListingSourcePlatform,
  IrissListingSyncRunSummary,
  IrissListingSyncStatus,
} from "@/lib/iriss-listings-types";

type ListingSource = {
  orderId: string;
  orderBrandModel: string;
  sourcePlatform: IrissListingSourcePlatform;
  sourceUrl: string;
};

function asCleanUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function buildSourcesFromOrder(row: Awaited<ReturnType<typeof listIrissPasutijumi>>[number]): ListingSource[] {
  const out: ListingSource[] = [];
  const push = (sourcePlatform: IrissListingSourcePlatform, raw: string) => {
    const sourceUrl = asCleanUrl(raw);
    if (!sourceUrl) return;
    out.push({
      orderId: row.id,
      orderBrandModel: row.brandModel,
      sourcePlatform,
      sourceUrl,
    });
  };
  push("mobile", row.listingLinkMobile);
  push("autobid", row.listingLinkAutobid);
  push("openline", row.listingLinkOpenline);
  push("auto1", row.listingLinkAuto1);
  for (const other of row.listingLinksOther) {
    const sourceUrl = asCleanUrl(other);
    if (!sourceUrl) continue;
    out.push({
      orderId: row.id,
      orderBrandModel: row.brandModel,
      sourcePlatform: detectPlatformFromUrl(sourceUrl),
      sourceUrl,
    });
  }
  return out;
}

function dedupeSources(sources: ListingSource[]): ListingSource[] {
  const seen = new Set<string>();
  const out: ListingSource[] = [];
  for (const src of sources) {
    const key = `${src.orderId}|${src.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(src);
  }
  return out;
}

function summarize(statuses: IrissListingSyncStatus[], startedAt: string, finishedAt: string, runId: string): IrissListingSyncRunSummary {
  const n = (s: IrissListingSyncStatus) => statuses.filter((x) => x === s).length;
  return {
    startedAt,
    finishedAt,
    runId,
    totalSources: statuses.length,
    okCount: n("ok"),
    loginRequiredCount: n("login_required"),
    parseFailedCount: n("parse_failed"),
    fetchFailedCount: n("fetch_failed"),
  };
}

function makeItemId(src: ListingSource): string {
  return createHash("sha1").update(src.orderId).update("|").update(src.sourceUrl).digest("hex").slice(0, 20);
}

function mergeWithPreviousSnapshot(
  next: IrissListingAggregateItem,
  prev: IrissListingAggregateItem | null,
): IrissListingAggregateItem {
  if (!prev) return next;
  const usePrevText = next.status !== "ok" || (!next.title && !next.year);
  const usePrevImage = !next.imageUrl;
  const usePrevPrice = !next.pricePrimary && !next.priceSecondary;
  const merged: IrissListingAggregateItem = {
    ...next,
    title: usePrevText ? next.title || prev.title : next.title,
    year: usePrevText ? next.year || prev.year : next.year,
    imageUrl: usePrevImage ? prev.imageUrl : next.imageUrl,
    pricePrimary: usePrevPrice ? prev.pricePrimary : next.pricePrimary,
    priceSecondary: usePrevPrice ? prev.priceSecondary : next.priceSecondary,
  };
  if (next.status !== "ok" && prev.status === "ok") {
    merged.statusNote = merged.statusNote
      ? `${merged.statusNote} Rādām pēdējo veiksmīgo snapshot.`
      : "Rādām pēdējo veiksmīgo snapshot.";
  }
  return merged;
}

export async function runIrissListingsDailySync(): Promise<{
  ok: boolean;
  warnings: string[];
  summary: IrissListingSyncRunSummary;
  items: IrissListingAggregateItem[];
}> {
  const startedAt = new Date().toISOString();
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;
  const warnings: string[] = [];
  const previous = await readIrissListingsLatestView();
  const previousById = new Map((previous?.items ?? []).map((item) => [item.id, item]));
  const rows = await listIrissPasutijumi();
  const allSources = dedupeSources(rows.flatMap(buildSourcesFromOrder));
  const maxSources = Math.max(1, Number.parseInt(process.env.IRISS_LISTINGS_MAX_SOURCES_PER_RUN ?? "800", 10) || 800);
  const sources = allSources.slice(0, maxSources);
  if (allSources.length > sources.length) {
    warnings.push(`Avotu skaits ierobežots: ${sources.length}/${allSources.length}.`);
  }

  const items: IrissListingAggregateItem[] = [];
  for (const [idx, src] of sources.entries()) {
    const scraped = await scrapeIrissListing({
      url: src.sourceUrl,
      platformHint: src.sourcePlatform,
    });
    const aggregatedAt = new Date(Date.now() - idx).toISOString();
    const itemId = makeItemId(src);
    const nextItem: IrissListingAggregateItem = {
      id: itemId,
      aggregatedAt,
      sourcePlatform: src.sourcePlatform,
      sourceUrl: src.sourceUrl,
      sourceDomain: scraped.sourceDomain,
      orderId: src.orderId,
      orderBrandModel: src.orderBrandModel,
      title: scraped.title,
      year: scraped.year,
      imageUrl: scraped.imageUrl,
      pricePrimary: scraped.pricePrimary,
      priceSecondary: scraped.priceSecondary,
      rawSnapshotRef: `${runId}:${scraped.rawSnapshotRef}`,
      status: scraped.status,
      statusNote: scraped.statusNote,
    };
    items.push(mergeWithPreviousSnapshot(nextItem, previousById.get(itemId) ?? null));
  }

  const finishedAt = new Date().toISOString();
  const summary = summarize(
    items.map((i) => i.status),
    startedAt,
    finishedAt,
    runId,
  );

  const write = await writeIrissListingsRun({
    generatedAt: finishedAt,
    runId,
    summary,
    items,
  });
  if (!write.ok) {
    warnings.push(`Saglabāšana neizdevās: ${write.error}`);
  }

  return {
    ok: write.ok,
    warnings,
    summary,
    items,
  };
}
