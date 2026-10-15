import { NextResponse, after } from "next/server";
import { recordSourceOutcomes } from "@/lib/source-health-store";

import { getAdminSession } from "@/lib/admin-auth";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { defaultVinScanSourceIds, VIN_SCAN_TTL_MS } from "@/lib/vin-scan/catalog";
import { vinScanStatusIsCacheable } from "@/lib/vin-scan/health";
import { mergeVinScanIndicators } from "@/lib/order-vin-scan";
import {
  hasAnyVinScanPlate,
  isValidScanPlate,
  parseVinScanPlates,
} from "@/lib/vin-scan/plates";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import { listVinScanHistory, readVinScanSnapshot, vinScanSnapshotFresh, writeVinScanSnapshot } from "@/lib/vin-scan/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("history") === "1") {
    const entries = await listVinScanHistory().catch(() => []);
    return NextResponse.json({ ok: true, entries });
  }
  const vin = normalizeVin(url.searchParams.get("vin") ?? "");
  if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  const snapshot = await readVinScanSnapshot(vin).catch(() => null);
  if (!snapshot) return NextResponse.json({ ok: true, vin, snapshot: null, stale: false });
  return NextResponse.json({
    ok: true,
    vin,
    snapshot,
    stale: !vinScanSnapshotFresh(snapshot),
  });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let vin = normalizeVin(String(body.vin ?? ""));
  const plates = parseVinScanPlates(body.plates);
  const listingUrl = canonicalizeListingUrl(String(body.listingUrl ?? ""));
  if (!isValidVin(vin) && !hasAnyVinScanPlate(plates) && !isPlausibleListingUrl(listingUrl)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const force = body.force === true;
  if (isValidVin(vin) && !force) {
    const cached = await readVinScanSnapshot(vin).catch(() => null);
    if (cached && vinScanSnapshotFresh(cached)) {
      if (isPlausibleListingUrl(listingUrl)) {
        const listing = await runVinScan({ vin, plates, listingUrl, sourceIds: ["listing_history"] });
        const rest = (Array.isArray(cached.indicators) ? cached.indicators : []).filter(
          (row) => row && typeof row === "object" && (row as { id?: unknown }).id !== "listing_history",
        );
        const byId = new Map<string, unknown>();
        for (const row of [...rest, ...listing]) {
          if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
            byId.set((row as { id: string }).id, row);
          }
        }
        const merged = defaultVinScanSourceIds()
          .map((id) => byId.get(id))
          .filter(Boolean) as VinScanIndicator[];
        return NextResponse.json({
          ok: true,
          vin,
          scannedAt: cached.scannedAt,
          indicators: applyFinlandLinkToIndicators(merged, plates),
          cached: true,
        });
      }
      const cachedRows = (Array.isArray(cached.indicators) ? cached.indicators : []) as VinScanIndicator[];
      return NextResponse.json({
        ok: true,
        vin,
        scannedAt: cached.scannedAt,
        indicators: applyFinlandLinkToIndicators(cachedRows, plates),
        cached: true,
      });
    }
  }

  if (!isValidVin(vin) && isValidScanPlate("lv", plates.lv)) {
    const csdd = await fetchCsddTechData(plates.lv).catch(() => null);
    if (csdd?.found && isValidVin(csdd.data.vin)) vin = normalizeVin(csdd.data.vin);
  }

  const requested = sanitizeVinScanSourceIds(body.sources) ?? defaultVinScanSourceIds();
  const prev = isValidVin(vin) ? await readVinScanSnapshot(vin).catch(() => null) : null;
  const prevAge = prev ? Date.now() - Date.parse(prev.scannedAt) : Number.POSITIVE_INFINITY;
  const prevUsable = Boolean(prev && prev.vin === vin && Number.isFinite(prevAge) && prevAge < VIN_SCAN_TTL_MS);
  const cachedIds = new Set(
    (prevUsable && !force ? prev!.indicators : []).filter((row) => vinScanStatusIsCacheable(row.status)).map((row) => row.id),
  );
  const toScan = requested.filter((id) => !cachedIds.has(id));
  const scanned = toScan.length ? await runVinScan({ vin, plates, listingUrl, sourceIds: toScan }) : [];
  const base = prev && prev.vin === vin ? prev.indicators : [];
  const indicators = applyFinlandLinkToIndicators(mergeVinScanIndicators(base, scanned), plates);
  const scannedAt = scanned.length ? new Date().toISOString() : prev?.scannedAt || new Date().toISOString();
  after(() => recordSourceOutcomes(vinScanSourceHealthOutcomes(scanned)));
  if (isValidVin(vin) && scanned.length) {
    await writeVinScanSnapshot({ vin, plates, scannedAt, indicators }).catch(() => undefined);
  }
  return NextResponse.json({
    ok: true,
    vin,
    plates,
    scannedAt,
    indicators,
    cached: false,
  });
}
