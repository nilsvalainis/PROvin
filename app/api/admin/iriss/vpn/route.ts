import { NextResponse } from "next/server";
import { ttrVpnStatus } from "@/lib/iriss-ttr-control";
import { readTtrControlDoc, requestTtrVpnStopStored } from "@/lib/iriss-ttr-control-store";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/** Servera (Hetzner) VPN stāvoklis pavadzīmju lapai. Tikai administratoram - darbinieks saņem 403. */
export async function GET() {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  try {
    return NextResponse.json({ ok: true, status: ttrVpnStatus(await readTtrControlDoc()) }, NO_STORE);
  } catch (err) {
    console.error("[iriss-vpn] status_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās nolasīt VPN stāvokli." }, { status: 500, ...NO_STORE });
  }
}

/** "Man vajag VPN": serveris atslēdz savu VPN nākamajā pārbaudē (~10 s). */
export async function POST(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  let body: { action?: unknown };
  try {
    body = (await req.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400, ...NO_STORE });
  }
  if (body.action !== "stop") {
    return NextResponse.json({ error: "Nederīga darbība" }, { status: 400, ...NO_STORE });
  }
  const by = "env-admin";
  try {
    const doc = await requestTtrVpnStopStored(by);
    return NextResponse.json({ ok: true, status: ttrVpnStatus(doc) }, NO_STORE);
  } catch (err) {
    console.error("[iriss-vpn] stop_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Neizdevās nosūtīt VPN atslēgšanu." }, { status: 500, ...NO_STORE });
  }
}
