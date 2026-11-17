import { NextResponse } from "next/server";
import { irissAivarsApiTokenConfigured, verifyIrissAivarsApiToken } from "@/lib/iriss-aivars-api-token";
import { toAivarsWaybillAction } from "@/lib/iriss-waybill-create";
import { aivarsWaybillStatusPayload } from "@/lib/iriss-waybill-requests";
import { readWaybillRequestsDoc } from "@/lib/iriss-waybill-requests-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 07.11 (B762): viena darba statuss Aivaram / automātikai (tikai lasa). Agrāk tāda nebija - Aivars, lai uzzinātu
 * statusu, mēģināja `claim` vēlreiz (409) un neesošus ceļus (404), un rezultātu iesūtīja ~50 min pēc izdošanas.
 * Atcelts darbs -> `cancelled: true`: pirms CSDD «Saglabāt» to vairs neizraksta.
 */
export async function GET(req: Request, ctx: Ctx) {
  if (!irissAivarsApiTokenConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!verifyIrissAivarsApiToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const doc = await readWaybillRequestsDoc();
  const request = doc.requests.find((row) => row.id === id);
  if (!request) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(
    { ok: true, ...aivarsWaybillStatusPayload(request), request: toAivarsWaybillAction(request) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
