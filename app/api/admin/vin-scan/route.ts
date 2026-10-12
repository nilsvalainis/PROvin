import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import {
  hasAnyVinScanPlate,
  isValidScanPlate,
  parseVinScanPlates,
} from "@/lib/vin-scan/plates";
import { runVinScan, sanitizeVinScanSourceIds } from "@/lib/vin-scan/run";
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
  if (!isValidVin(vin) && !hasAnyVinScanPlate(plates)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const force = body.force === true;
  if (isValidVin(vin) && !force) {
    const cached = await readVinScanSnapshot(vin).catch(() => null);
    if (cached && vinScanSnapshotFresh(cached)) {
      return NextResponse.json({ ok: true, vin, scannedAt: cached.scannedAt, indicators: cached.indicators, cached: true });
    }
  }

  if (!isValidVin(vin) && isValidScanPlate("lv", plates.lv)) {
    const csdd = await fetchCsddTechData(plates.lv).catch(() => null);
    if (csdd?.found && isValidVin(csdd.data.vin)) vin = normalizeVin(csdd.data.vin);
  }

  const requested = sanitizeVinScanSourceIds(body.sources) ?? defaultVinScanSourceIds();
  const indicators = await runVinScan({ vin, plates, sourceIds: requested });
  const scannedAt = new Date().toISOString();
  if (isValidVin(vin)) {
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
