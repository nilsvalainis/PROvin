import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { releaseTraficomFiRelaySession } from "@/lib/traficom-fi-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: «Atbrīvot sesiju» - Traficom relejs aizver pārlūku un izdzēš profilu. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.action !== "release") return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const out = await releaseTraficomFiRelaySession();
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}
