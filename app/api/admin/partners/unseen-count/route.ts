/**
 * Jauno (vēl neatvērto) B2B partneru skaits.
 * Viegls pollingam AdminSidebarNav badge.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { countUnseenB2bPartners } from "@/lib/b2b-partner-account";
import { listB2bPartners } from "@/lib/b2b-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const partners = await listB2bPartners();
    const unseenCount = countUnseenB2bPartners(partners);
    return NextResponse.json({ ok: true, unseenCount });
  } catch (e) {
    console.error("[admin/partners/unseen-count]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
