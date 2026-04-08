/**
 * Sludinājuma ievades analīze → „Pārdošanas sludinājuma konteksts” (Google Gemini).
 * Atslēga tikai serverī: `process.env.GEMINI_API_KEY`.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  analyzeListingPasteForSalesContextWithGemini,
  getGeminiApiKeyFromEnv,
} from "@/lib/admin-ai-polish-lv";

export const maxDuration = 60;

export async function POST(req: Request) {
  console.log(
    "Serveris mēģina lietot atslēgu:",
    process.env.GEMINI_API_KEY ? "Atrasta" : "Nav atrasta",
  );

  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = getGeminiApiKeyFromEnv();
  if (!apiKey) {
    return NextResponse.json({ error: "missing_gemini_key" }, { status: 503 });
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
  const text = typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  try {
    const analyzed = await analyzeListingPasteForSalesContextWithGemini(text, apiKey);
    return NextResponse.json({ text: analyzed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "analysis_failed", detail: msg }, { status: 502 });
  }
}
