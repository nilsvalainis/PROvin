import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { loadAdminGlobalSearch } from "@/lib/admin-global-search-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const groups = await loadAdminGlobalSearch(q);
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[admin/search]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
