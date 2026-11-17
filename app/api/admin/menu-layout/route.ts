import { NextResponse } from "next/server";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import {
  menuLayoutUserKey,
  readMenuLayout,
  sanitizeMenuLayout,
  writeMenuLayout,
  type MenuWorkspace,
} from "@/lib/admin-menu-layout-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function wsOf(v: string | null): MenuWorkspace | null {
  return v === "iriss" || v === "pro" ? v : null;
}

/** ?ws=iriss|pro → šī lietotāja izkārtojums vai null. */
export async function GET(req: Request) {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ws = wsOf(new URL(req.url).searchParams.get("ws"));
  if (!ws) return NextResponse.json({ error: "invalid_ws" }, { status: 400 });
  const layout = await readMenuLayout(menuLayoutUserKey(actor), ws).catch(() => null);
  return NextResponse.json({ layout });
}

/** { ws, layout } saglabā izkārtojumu. */
export async function PUT(req: Request) {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { ws?: unknown; layout?: unknown } | null;
  const ws = wsOf(typeof body?.ws === "string" ? body.ws : null);
  const layout = sanitizeMenuLayout(body?.layout);
  if (!ws || !layout) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  await writeMenuLayout(menuLayoutUserKey(actor), ws, layout);
  return NextResponse.json({ ok: true });
}
