import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { moveVendorArchiveGroup } from "@/lib/vendor-archive-photos-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Admin: viena klikšķa pārvietošana - foto grupa «Sludinājuma vēsture» <-> izsoļu portālu arhīvs.
 * Atgriež abus blokus; klients tos ieliek kā Copilot patch (vecās bildes kļūst par kapakmeņiem).
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  const to = body.to === "cc_vin" || body.to === "tirgus" ? body.to : null;
  if (!groupId || !to) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  let sourceBlocks: WorkspaceSourceBlocks;
  try {
    sourceBlocks = mergeSourceBlocksWithDefaults((body.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>);
  } catch {
    return NextResponse.json({ error: "missing_source_blocks" }, { status: 400 });
  }
  try {
    const res = await moveVendorArchiveGroup({ sessionId, groupId, to, sourceBlocks });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "group_not_found" ? 404 : 409 });
    return NextResponse.json({
      ok: true,
      moved: res.moved,
      patchedSourceBlocks: { tirgus: res.tirgus, cc_vin: res.cc_vin },
      changedKeys: ["tirgus", "cc_vin"],
    });
  } catch (e) {
    console.error("[admin/vendor-archive-photos/move] failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "move_failed" }, { status: 502 });
  }
}
