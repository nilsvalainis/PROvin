import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listAffectedClientReports } from "@/lib/affected-client-reports-list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Admin: klientu PDF kopš PR #277 (18.10.2026 00:29 Rīga) ar vidējām summām / kļūdainu pilnīgo zaudējumu. */
export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const scanPdf = url.searchParams.get("scanPdf") !== "0";
  const scanDraft = url.searchParams.get("scanDraft") !== "0";

  try {
    const report = await listAffectedClientReports({ scanPdf, scanDraft });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin affected-client-reports]", e);
    return NextResponse.json({ error: "list_failed", message }, { status: 500 });
  }
}
