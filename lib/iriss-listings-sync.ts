import "server-only";

import { createHash } from "node:crypto";
import { writeIrissListingsRun } from "@/lib/iriss-listings-aggregate-store";
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

export async function runIrissListingsDailySync(): Promise<{
  ok: boolean;
  warnings: string[];
  summary: IrissListingSyncRunSummary;
  items: IrissListingAggregateItem[];
}> {
  const startedAt = new Date().toISOString();
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;
  const warnings: string[] = [];
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
    items.push({
      id: makeItemId(src),
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
    });
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
