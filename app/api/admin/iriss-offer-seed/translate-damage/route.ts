import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { translateListingDamageLv } from "@/lib/iriss-listings-damage-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStore = { "Cache-Control": "private, no-store" };

/**
 * POST { text } - tulko AUTO1/OPENLANE sludinājuma bojājumu/stāvokļa tekstu latviski
 * (Gemini), lai aizpildītu piedāvājuma Bojājumu pakāpe + Vizuālais novērtējums laukus,
 * kad piedāvājums veidots no izsoles sludinājuma (Pasūtījuma istaba). Tiesības - tāpat kā
 * citiem piedāvājuma veidošanas maršrutiem (GET /api/admin/iriss-offer-seed): "pasutijumi".
 */
export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!hasAnyAdminAiProviderKey()) return NextResponse.json({ error: "missing_ai_key" }, { status: 503, headers: noStore });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const raw = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
  if (!raw.trim()) return NextResponse.json({ lv: "" }, { headers: noStore });
  try {
    const lv = await translateListingDamageLv(raw);
    return NextResponse.json({ lv }, { headers: noStore });
  } catch (e) {
    return NextResponse.json(
      { error: "translate_failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 502, headers: noStore },
    );
  }
}
