import { NextResponse, after } from "next/server";
import { recordSourceOutcomes } from "@/lib/source-health-store";

import { requireIrissSectionApi } from "@/lib/staff-auth";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import { stampVinScanRowById } from "@/lib/vin-scan/source-ttl";
import {
  hasAnyVinScanPlate,
  isValidScanPlate,
  parseVinScanPlates,
} from "@/lib/vin-scan/plates";
import { applyVinScanBrowserResultToSnapshot } from "@/lib/vin-scan/apply-browser-result";
import { trackVinScanBrowserImport } from "@/lib/vin-scan/monitor-store";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { runVinScan, sanitizeVinScanPaidSourceIds, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import { vinScanPlateStaleSourceIds } from "@/lib/vin-scan/plate-cache";
import { runSharedVinScan } from "@/lib/vin-scan/shared-scan";
import {
  listVinScanHistory,
  readVinScanSnapshot,
  vinScanSnapshotFresh,
  writeVinScanBrowserImport,
  writeVinScanSnapshot,
} from "@/lib/vin-scan/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;
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
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;

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

  const br = body.browserResult as Record<string, unknown> | undefined;
  if (br && typeof br === "object") {
    if (!isValidVin(vin)) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
    const existing = await readVinScanSnapshot(vin).catch(() => null);
    const pageUrl =
      (typeof br.finalUrl === "string" && br.finalUrl.trim()) ||
      (typeof br.pageUrl === "string" ? br.pageUrl : "");
    const html = typeof br.html === "string" ? br.html : "";
    const httpStatus = typeof br.httpStatus === "number" && Number.isFinite(br.httpStatus) ? br.httpStatus : undefined;
    const sourceId = typeof br.id === "string" ? br.id : "";
    const applied = applyVinScanBrowserResultToSnapshot({
      snapshot: existing,
      vin,
      plates,
      browserResult: {
        id: sourceId,
        status: typeof br.status === "string" ? br.status : "",
        summary: typeof br.summary === "string" ? br.summary : "",
        html,
        pageUrl,
        ...(httpStatus != null ? { httpStatus } : {}),
      },
    });
    const importedAt = new Date().toISOString();
    if (applied.ok) {
      // Importētā rinda ir svaiga; pārējās patur savu vecumu (momentuzņēmuma scannedAt nemainās).
      applied.snapshot = {
        ...applied.snapshot,
        indicators: stampVinScanRowById(applied.snapshot.indicators, sourceId, importedAt),
      };
    }
    if (!applied.ok) {
      trackVinScanBrowserImport({
        route: "vin-scan",
        event: "import_rejected",
        error: applied.error,
        id: sourceId,
        httpStatus,
        pageUrl,
        html,
      });
      return NextResponse.json({ error: applied.error }, { status: 400 });
    }
    // Vispirms savā atslēgā: momentuzņēmumu var pārrakstīt skenēšana, kas vēl rit, vai paralēls cita avota imports.
    const importedRow = applied.snapshot.indicators.find((row) => row.id === sourceId);
    if (importedRow) {
      await writeVinScanBrowserImport(vin, importedRow, importedAt).catch((err) => {
        console.warn(
          JSON.stringify({
            vinScanStore: true,
            event: "browser_import_write_failed",
            msg: err instanceof Error ? err.message : "write_failed",
          }),
        );
      });
    }
    try {
      await writeVinScanSnapshot(applied.snapshot);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "write_failed";
      trackVinScanBrowserImport({
        route: "vin-scan",
        event: "snapshot_write_failed",
        error: msg,
        id: sourceId,
        httpStatus,
        pageUrl,
        html,
      });
      return NextResponse.json({ error: "write_failed" }, { status: 500 });
    }
    trackVinScanBrowserImport({
      route: "vin-scan",
      event: "import_saved",
      id: sourceId,
      httpStatus,
      pageUrl,
      html,
    });
    return NextResponse.json({
      ok: true,
      vin,
      plates: applied.snapshot.plates,
      scannedAt: applied.snapshot.scannedAt,
      indicators: applyFinlandLinkToIndicators(applied.snapshot.indicators, plates),
      cached: false,
    });
  }

  const force = body.force === true;
  // Maksas avots (JoJ) tikai adminam un tikai tad, ja «Ātrā pārbaude» lapā tas ieķeksēts.
  const paidAllowed = gate.actor?.kind === "admin" ? sanitizeVinScanPaidSourceIds(body.paidSources) : [];
  const requestedExplicit = sanitizeVinScanSourceIds(body.sources, paidAllowed);
  if (isValidVin(vin) && !force) {
    const cached = await readVinScanSnapshot(vin).catch(() => null);
    const cachedIds = new Set(
      (cached && Array.isArray(cached.indicators) ? cached.indicators : [])
        .map((row) => (row && typeof row === "object" ? (row as { id?: unknown }).id : null))
        .filter((id): id is string => typeof id === "string"),
    );
    // Ja prasīts avots, kura kešā nav (piem. TheCarApi vai JoJ), ejam uz skenēšanu zemāk (tur svaigās rindas paliek).
    const cacheCoversRequest = !requestedExplicit || requestedExplicit.every((id) => cachedIds.has(id));
    // Jauns vai cits numurs (NL/LT/UK/SE) -> numura avotu kešs neder, ejam uz skenēšanu zemāk.
    if (
      cached &&
      cacheCoversRequest &&
      vinScanSnapshotFresh(cached) &&
      vinScanPlateStaleSourceIds(cached.plates, plates).size === 0
    ) {
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
    const csdd = await fetchCsddTechDataCounted(plates.lv, "admin").catch(() => null);
    if (csdd?.found && isValidVin(csdd.data.vin)) vin = normalizeVin(csdd.data.vin);
  }

  // Tas pats izpildītājs kā «Ātrajiem vērtējumiem» (lib/vin-scan/shared-scan.ts).
  const { plates: scanPlates, scannedAt, indicators, scanned } = await runSharedVinScan({
    vin,
    plates,
    listingUrl,
    sourceIds: requestedExplicit ?? defaultVinScanSourceIds(),
    force,
    allowPaid: paidAllowed,
  });
  after(() => recordSourceOutcomes(vinScanSourceHealthOutcomes(scanned)));
  return NextResponse.json({
    ok: true,
    vin,
    plates: scanPlates,
    scannedAt,
    indicators,
    cached: false,
  });
}
