import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readDealerCheck } from "@/lib/dealer-check-store";
import { dealerCheckToOemHtml } from "@/lib/dealer-check-run";
import { buildDealerCheckLvHtml, isSafeDealerCheckId } from "@/lib/dealer-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const kind = url.searchParams.get("kind") === "raw" ? "raw" : "lv";
  if (!isSafeDealerCheckId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const record = await readDealerCheck(id);
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const html = kind === "raw" ? dealerCheckToOemHtml(record) : buildDealerCheckLvHtml(record);
  return NextResponse.json({ ok: true, html, kind, vin: record.vin });
}
