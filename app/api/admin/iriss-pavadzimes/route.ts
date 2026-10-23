import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { canSeeWaybillOrders, loadIrissPavadzimesActiveCardData, loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pavadzimes");
  if (!gate.ok) return gate.response;
  try {
    const active = new URL(req.url).searchParams.get("active") === "1";
    const opts = { withOrders: canSeeWaybillOrders(gate.actor) };
    const data = active ? await loadIrissPavadzimesActiveCardData(new Date(), opts) : await loadIrissPavadzimesPageData(new Date(), opts);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "list_failed",
        rows: [],
        pendingParse: 0,
        dropboxConfigured: false,
        dropboxError: e instanceof Error ? e.message : "list_failed",
      },
      { status: 500 },
    );
  }
}
