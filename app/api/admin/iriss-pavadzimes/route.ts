import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { loadIrissPavadzimesPageData } from "@/lib/iriss-pavadzimes-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await loadIrissPavadzimesPageData();
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
