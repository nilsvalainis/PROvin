import { NextResponse } from "next/server";
import { adminActorLabel } from "@/lib/admin-auth";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { parseListingMatchPatches } from "@/lib/iriss-listing-match";
import { patchIrissListingMatchStatus } from "@/lib/iriss-listing-match-store";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function PATCH(req: Request) {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patches = parseListingMatchPatches(body);
  if (patches.length === 0) return NextResponse.json({ error: "invalid_patch" }, { status: 400 });

  const next = await patchIrissListingMatchStatus(patches, new Date().toISOString(), { by: adminActorLabel() });
  if (!next) return NextResponse.json({ error: "store_disabled" }, { status: 503 });
  return NextResponse.json({ ok: true, unseenCount: next.unseenCount });
}
