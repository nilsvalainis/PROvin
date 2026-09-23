/**
 * Klienta atskaites (PDF) dinamiskā satura tulkošana EN / DE / RU.
 * Statisko "apvalku" (virsraksti, tabulu galviņas) tulko lib/client-report-i18n.ts
 * bez AI, tieši pārlūkā ģenerējot HTML — šis maršruts aptver TIKAI pasūtījumam
 * specifisko brīvo tekstu (✨ komentāri, avotu piezīmes).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { nextJsonBodyWithAiUsage } from "@/lib/admin-ai-route-response";
import { translateClientReportTexts } from "@/lib/client-report-translate";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";

export const maxDuration = 60;
export const runtime = "nodejs";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!hasAnyAdminAiProviderKey()) {
    return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const sessionId = str(b.sessionId).trim();
  if (!sessionId) return NextResponse.json({ error: "missing_session" }, { status: 400 });

  const lang = str(b.lang).trim();
  if (lang !== "en" && lang !== "ru" && lang !== "de") {
    return NextResponse.json({ error: "invalid_lang" }, { status: 400 });
  }

  const texts = b.texts;
  if (!texts || typeof texts !== "object" || Array.isArray(texts)) {
    return NextResponse.json({ error: "missing_texts" }, { status: 400 });
  }
  const textMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(texts as Record<string, unknown>)) {
    if (typeof v === "string") textMap[k] = v;
  }

  const guard = await assertAiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const modelTier = parseAiModelTier(b.modelTier ?? "gemini-flash");

  return nextJsonBodyWithAiUsage(async () => {
    const result = await translateClientReportTexts(textMap, lang, modelTier);
    return { ok: true, texts: result.texts, missingKeys: result.missingKeys };
  });
}
