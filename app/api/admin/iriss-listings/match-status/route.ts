import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseListingMatchPatches } from "@/lib/iriss-listing-match";
import { patchIrissListingMatchStatus } from "@/lib/iriss-listing-match-store";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patches = parseListingMatchPatches(body);
  if (patches.length === 0) return NextResponse.json({ error: "invalid_patch" }, { status: 400 });

  const next = await patchIrissListingMatchStatus(patches, new Date().toISOString());
  if (!next) return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  return NextResponse.json({ ok: true, unseenCount: next.unseenCount });
}
