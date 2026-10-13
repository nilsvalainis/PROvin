/**
 * Neapstrādāto ātro vērtējumu skaits (statuss new | in_progress).
 * Viegls pollingam AdminWorkspaceSwitcher badge.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getListingPeekQueueSnapshot } from "@/lib/listing-peek-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    // Svaigs (nekešots) dokuments un visi ieraksti — nevis instances kešs + 200 limits (žetons lēca).
    const { openCount } = await getListingPeekQueueSnapshot();
    return NextResponse.json({ ok: true, openCount });
  } catch (e) {
    console.error("[admin/listing-peeks/open-count]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
