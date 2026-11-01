import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getOneautoApiConfig } from "@/lib/oneauto-api";
import {
  addDealerCheckCost,
  deleteDealerCheck,
  isDealerCheckStoreEnabled,
  patchDealerCheck,
  readDealerCheck,
  readDealerCheckByVin,
  readDealerCheckLedgerMonth,
  writeDealerCheck,
} from "@/lib/dealer-check-store";
import { generateDealerCheckComments, runDealerCheck } from "@/lib/dealer-check-run";
import {
  dealerCheckHasHttp206,
  formatDealerCheckLedgerBar,
  isSafeDealerCheckId,
  parseDealerCheckSearchVin,
} from "@/lib/dealer-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function ledgerPayload() {
  const month = await readDealerCheckLedgerMonth();
  return { month, bar: formatDealerCheckLedgerBar(month) };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return unauthorized();
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const vin = parseDealerCheckSearchVin(url.searchParams.get("vin"));
  const ledger = await ledgerPayload();
  if (id && isSafeDealerCheckId(id)) {
    const record = await readDealerCheck(id);
    return NextResponse.json({ ok: true, record, ...ledger });
  }
  if (vin) {
    const record = await readDealerCheckByVin(vin);
    return NextResponse.json({ ok: true, record, ...ledger });
  }
  return NextResponse.json({ ok: true, record: null, ...ledger });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return unauthorized();
  if (!getOneautoApiConfig()) {
    return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  try {
    const result = await runDealerCheck({
      vin: typeof o.vin === "string" ? o.vin : "",
      plate: typeof o.plate === "string" ? o.plate : "",
      template: o.template,
      products: o.products,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const stored = isDealerCheckStoreEnabled() ? await writeDealerCheck(result.record) : false;
    const month = await addDealerCheckCost(result.record.template, result.record.chargedCents);
    return NextResponse.json({
      ok: true,
      record: result.record,
      stored,
      month,
      bar: formatDealerCheckLedgerBar(month),
      http206: dealerCheckHasHttp206(result.record.results),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_oneauto_credentials") {
      return NextResponse.json({ error: "missing_oneauto_credentials" }, { status: 503 });
    }
    console.error("[admin/dealer-check]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const id = typeof o.id === "string" ? o.id : "";
  if (!isSafeDealerCheckId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  if (o.generateComments === true) {
    const current = await readDealerCheck(id);
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const comments = await generateDealerCheckComments(current);
    const record = await patchDealerCheck(id, { comments });
    return NextResponse.json({ ok: true, record });
  }
  const comments =
    o.comments && typeof o.comments === "object"
      ? {
          serviceHistory: String((o.comments as { serviceHistory?: unknown }).serviceHistory ?? ""),
          oilIntervals: String((o.comments as { oilIntervals?: unknown }).oilIntervals ?? ""),
        }
      : undefined;
  const record = await patchDealerCheck(id, {
    ...(comments ? { comments } : {}),
    saved: o.saved === true ? true : undefined,
  });
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, record });
}

export async function DELETE(req: Request) {
  if (!(await getAdminSession())) return unauthorized();
  const url = new URL(req.url);
  let id = url.searchParams.get("id") ?? "";
  if (!id) {
    try {
      const body = (await req.json()) as { id?: string };
      id = body.id ?? "";
    } catch {
      /* query */
    }
  }
  if (!isSafeDealerCheckId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const deleted = await deleteDealerCheck(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ledger = await ledgerPayload();
  return NextResponse.json({ ok: true, deleted: true, ...ledger });
}
