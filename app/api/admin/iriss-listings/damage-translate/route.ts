import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { classifyListingDamage } from "@/lib/iriss-listings-damage";
import { translateListingDamageLv } from "@/lib/iriss-listings-damage-translate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasAnyAdminAiProviderKey()) return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
  const classified = classifyListingDamage(raw);
  try {
    const lv = raw.trim() ? await translateListingDamageLv(raw) : "";
    return NextResponse.json({ lv, status: classified.status, cats: classified.cats.map((c) => c.name) });
  } catch (e) {
    return NextResponse.json({ error: "translate_failed", detail: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
