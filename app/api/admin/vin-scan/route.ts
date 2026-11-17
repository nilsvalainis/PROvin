import { NextResponse, after } from "next/server";
import { recordSourceOutcomes } from "@/lib/source-health-store";

import { requireIrissSectionApi } from "@/lib/staff-auth";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { canonicalizeListingUrl, isPlausibleListingUrl, isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import { pickReusableVinScanRows, stampVinScanRowById, stampVinScanRows } from "@/lib/vin-scan/source-ttl";
import { mergeVinScanIndicators } from "@/lib/order-vin-scan";
import {
  hasAnyVinScanPlate,
  isValidScanPlate,
  parseVinScanPlates,
} from "@/lib/vin-scan/plates";
import { applyVinScanBrowserResultToSnapshot } from "@/lib/vin-scan/apply-browser-result";
import { logVinScanBrowserImport } from "@/lib/vin-scan/browser-import-log";
import { applyFinlandLinkToIndicators } from "@/lib/vin-scan/finland-link";
import { preferBrowserArchiveImport } from "@/lib/order-vin-scan-browser-html";
import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";
import type { VinScanIndicator } from "@/lib/vin-scan/types";
import { vinScanSourceHealthOutcomes } from "@/lib/vin-scan/source-health-outcomes";
import { overlayVinScanBrowserImports } from "@/lib/vin-scan/browser-import-overlay";
import {
  listVinScanHistory,
  readVinScanBrowserImports,
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
      logVinScanBrowserImport({
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
      logVinScanBrowserImport({
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
    logVinScanBrowserImport({
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
    const csdd = await fetchCsddTechDataCounted(plates.lv, "admin").catch(() => null);
    if (csdd?.found && isValidVin(csdd.data.vin)) vin = normalizeVin(csdd.data.vin);
  }

  const requested = sanitizeVinScanSourceIds(body.sources) ?? defaultVinScanSourceIds();
  const prevRaw = isValidVin(vin) ? await readVinScanSnapshot(vin).catch(() => null) : null;
  const prev = prevRaw && prevRaw.vin === vin ? prevRaw : null;
  const nowMs = Date.now();
  // Katra rinda pēc sava avota TTL (reģistri 7 d / 3 d, izsoļu arhīvi 30 d, sludinājumi 12 h).
  const reusable = prev ? pickReusableVinScanRows(prev.indicators, prev.scannedAt, nowMs, force) : [];
  const cachedIds = new Set(reusable.map((row) => row.id));
  const toScan = requested.filter((id) => !cachedIds.has(id));
  const scanned = stampVinScanRows(
    toScan.length ? await runVinScan({ vin, plates, listingUrl, sourceIds: toScan, ignoreBreaker: force }) : [],
    new Date(nowMs).toISOString(),
    true,
  );
  // Vecās rindas patur savu laiku, citādi jaunais momentuzņēmuma scannedAt tās padarītu "svaigas".
  const base = prev ? stampVinScanRows(prev.indicators, prev.scannedAt) : [];
  const scannedAt = scanned.length ? new Date().toISOString() : prev?.scannedAt || new Date().toISOString();
  // Skenēšana ilgst līdz ~105 s; pa to laiku saglabātie pārlūka importi nav `prev`, tāpēc tos pārlasa tieši pirms rakstīšanas.
  const lateImports = isValidVin(vin) && scanned.length ? await readVinScanBrowserImports(vin).catch(() => []) : [];
  const indicators = applyFinlandLinkToIndicators(
    overlayVinScanBrowserImports(
      preferBrowserArchiveImport(base, mergeVinScanIndicators(base, scanned)),
      scannedAt,
      lateImports,
    ),
    plates,
  );
  after(() => recordSourceOutcomes(vinScanSourceHealthOutcomes(scanned)));
  if (isValidVin(vin) && scanned.length) {
    await writeVinScanSnapshot({ vin, plates, scannedAt, indicators }).catch((err) => {
      console.warn(
        JSON.stringify({
          vinScanStore: true,
          event: "snapshot_write_failed",
          msg: err instanceof Error ? err.message : "write_failed",
        }),
      );
    });
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
