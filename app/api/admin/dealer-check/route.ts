import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getOneautoApiConfig } from "@/lib/oneauto-api";
import { currentDealerCheckCreatorId } from "@/lib/dealer-check-actor";
import {
  dealerCheckListToCsv,
  dealerCheckVisibleTo,
  filterDealerCheckList,
  parseDealerCheckCsddSnapshot,
  type DealerCheckListFilter,
} from "@/lib/dealer-check-history";
import {
  addDealerCheckCost,
  commitDealerCheckLoad,
  deleteDealerCheck,
  listDealerCheckEntries,
  patchDealerCheck,
  readDealerCheckByVin,
  readDealerCheckLedgerMonth,
  readOwnedDealerCheck,
} from "@/lib/dealer-check-store";
import { generateDealerCheckComments, runDealerCheck } from "@/lib/dealer-check-run";
import {
  dealerCheckHasHttp206,
  formatDealerCheckLedgerBar,
  isDealerCheckTemplateId,
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

function listFilterFromUrl(url: URL): DealerCheckListFilter {
  const template = url.searchParams.get("template");
  const status = url.searchParams.get("status");
  const ordered = url.searchParams.get("ordered");
  return {
    vin: url.searchParams.get("vin") ?? "",
    plate: url.searchParams.get("plate") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
    template: isDealerCheckTemplateId(template) ? template : "all",
    status: status === "open" || status === "converted" ? status : "all",
    ordered: ordered === "yes" || ordered === "no" ? ordered : "all",
  };
}

export async function GET(req: Request) {
  if (!(await getAdminSession())) return unauthorized();
  const url = new URL(req.url);
  const creator = await currentDealerCheckCreatorId();
  const entries = await listDealerCheckEntries(creator);
  if (url.searchParams.get("format") === "csv") {
    const csv = dealerCheckListToCsv(filterDealerCheckList(entries, listFilterFromUrl(url)));
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"dilera-parbaudes.csv\"",
      },
    });
  }
  const ledger = await ledgerPayload();
  const id = url.searchParams.get("id") ?? "";
  const vin = parseDealerCheckSearchVin(url.searchParams.get("vin"));
  if (id && isSafeDealerCheckId(id)) {
    const record = await readOwnedDealerCheck(id, creator);
    return NextResponse.json({ ok: true, record, entries, ...ledger });
  }
  if (vin) {
    const found = await readDealerCheckByVin(vin);
    const record = found && dealerCheckVisibleTo(found, creator) ? found : null;
    return NextResponse.json({ ok: true, record, entries, ...ledger });
  }
  return NextResponse.json({ ok: true, record: null, entries, ...ledger });
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
    const clientSnapshot = parseDealerCheckCsddSnapshot(o.csdd);
    if (clientSnapshot) result.record.csddSnapshot = clientSnapshot;
    // Katrs Ielādēt ir jauns OneAuto zvans (klients kešo nē). Vietējā maksa tikai ok rezultātiem.
    // 24h brīdinājums ir pasūtījuma OneAuto joslā, ne šajā lapā. Nesaglabājam 206 / tukšu / kļūdu.
    const creator = await currentDealerCheckCreatorId();
    const saved = await commitDealerCheckLoad(result.record, creator);
    const month = await addDealerCheckCost(result.record.template, result.record.chargedCents);
    const entries = await listDealerCheckEntries(creator);
    return NextResponse.json({
      ok: true,
      record: saved.record,
      stored: saved.stored,
      durable: saved.durable,
      entries,
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
  const creator = await currentDealerCheckCreatorId();
  if (o.generateComments === true) {
    const current = await readOwnedDealerCheck(id, creator);
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
  const owned = await readOwnedDealerCheck(id, creator);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
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
  const creator = await currentDealerCheckCreatorId();
  const owned = await readOwnedDealerCheck(id, creator);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const deleted = await deleteDealerCheck(id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ledger = await ledgerPayload();
  return NextResponse.json({ ok: true, deleted: true, ...ledger });
}
