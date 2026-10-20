import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { createLogisticsAuctionSource, normalizeLogisticsAuctionSource } from "@/lib/iriss-logistics-auction-sources";
import {
  getIrissLogisticsStorageState,
  listLogisticsAuctionSources,
  upsertLogisticsAuctionSource,
  writeLogisticsAuctionSources,
} from "@/lib/iriss-logistics-store";
import type { LogisticsAuctionSource } from "@/lib/iriss-logistics-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const storage = getIrissLogisticsStorageState();
  if (!storage.enabled) {
    return NextResponse.json(
      { error: "store_disabled", reason: storage.reason, sources: [] },
      { status: 503, headers: irissLogisticsScopeHeader() },
    );
  }
  const sources = await listLogisticsAuctionSources();
  return NextResponse.json({ ok: true, sources }, { headers: irissLogisticsScopeHeader() });
}

export async function PUT(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const itemsRaw = (body as { items?: unknown; sources?: unknown }).items ?? (body as { sources?: unknown }).sources;
  if (!Array.isArray(itemsRaw)) {
    return NextResponse.json({ error: "items_required" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const items = itemsRaw
    .map((row) => normalizeLogisticsAuctionSource(row))
    .filter((p): p is LogisticsAuctionSource => p !== null);
  await writeLogisticsAuctionSources(items);
  return NextResponse.json({ ok: true, sources: items }, { headers: irissLogisticsScopeHeader() });
}

export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const row = body as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400, headers: irissLogisticsScopeHeader() });
  }
  const created = createLogisticsAuctionSource({
    name,
    url: typeof row.url === "string" ? row.url : "",
    filters: row.filters as { account?: string; status?: string; keywords?: string } | undefined,
    enabled: row.enabled !== false,
  });
  const source = await upsertLogisticsAuctionSource(created);
  return NextResponse.json({ ok: true, source }, { headers: irissLogisticsScopeHeader() });
}
