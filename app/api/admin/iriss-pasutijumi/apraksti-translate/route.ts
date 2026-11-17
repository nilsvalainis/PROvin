import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { translateOfferAprakstiTextLv } from "@/lib/iriss-offer-apraksti-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!getGeminiApiKeyFromEnv()) return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
  if (!raw.trim()) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  try {
    const lv = await translateOfferAprakstiTextLv(raw);
    return NextResponse.json({ lv });
  } catch (e) {
    return NextResponse.json({ error: "translate_failed", detail: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
