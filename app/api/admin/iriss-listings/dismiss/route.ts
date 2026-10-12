import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readIrissListingsDismissed, writeIrissListingsDismissed } from "@/lib/iriss-listings-aggregate-store";
import { applyListingDismissPatches, parseDismissPatches } from "@/lib/iriss-listings-dismiss";

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

  const patches = parseDismissPatches(body);
  if (patches.length === 0) return NextResponse.json({ error: "invalid_patch" }, { status: 400 });

  const current = await readIrissListingsDismissed();
  const at = new Date().toISOString();
  const entries = applyListingDismissPatches(current.entries, patches, at);
  const write = await writeIrissListingsDismissed({ version: 1, updatedAt: at, entries });
  if (!write.ok) {
    return NextResponse.json({ error: write.error }, { status: write.error === "store_disabled" ? 503 : 500 });
  }
  return NextResponse.json({ ok: true, dismissed: entries });
}
