import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  isCostSourceId,
  resolveCostMonth,
  type CostLimitSource,
  type CostSourceId,
} from "@/lib/admin-costs";
import { loadCostDashboard } from "@/lib/admin-costs-load";
import { upsertCostLimit, upsertCostSnapshot } from "@/lib/admin-costs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const month = resolveCostMonth(url.searchParams.get("m") ?? url.searchParams.get("month"));
  const { dashboard, alerts } = await loadCostDashboard(month);
  return NextResponse.json({ ok: true, dashboard, alerts });
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sourceRaw = String(body.source ?? "").trim();
  if (!isCostSourceId(sourceRaw)) {
    return NextResponse.json({ error: "unknown_source" }, { status: 400 });
  }
  const source: CostSourceId = sourceRaw;
  const month = resolveCostMonth(typeof body.month === "string" ? body.month : null);
  const usd = numOrNull(body.usd);
  const units = numOrNull(body.units) ?? 0;
  const limitUsd = body.limitUsd === undefined ? undefined : numOrNull(body.limitUsd);
  const limitUnits = body.limitUnits === undefined ? undefined : numOrNull(body.limitUnits);
  const hard = body.hard === true;
  const sourceOfLimit: CostLimitSource = body.sourceOfLimit === "account" || body.sourceOfLimit === "budget" ? body.sourceOfLimit : "manual";

  if (usd == null) {
    return NextResponse.json({ error: "usd_required" }, { status: 400 });
  }

  await upsertCostSnapshot({
    source,
    sku: typeof body.sku === "string" ? body.sku.trim() : "",
    period: month,
    usd,
    units,
    fetchedAt: new Date().toISOString(),
    origin: "manual",
  });

  if (limitUsd !== undefined || limitUnits !== undefined) {
    await upsertCostLimit({
      source,
      sku: typeof body.sku === "string" ? body.sku.trim() : "",
      period: "month",
      limitUsd: limitUsd ?? null,
      limitUnits: limitUnits ?? null,
      hard,
      sourceOfLimit,
      readAt: new Date().toISOString(),
    });
  }

  const { dashboard, alerts } = await loadCostDashboard(month);
  return NextResponse.json({ ok: true, dashboard, alerts });
}
