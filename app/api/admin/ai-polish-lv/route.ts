import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { polishLatvianTextWithOpenAi } from "@/lib/admin-ai-polish-lv";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    const polished = await polishLatvianTextWithOpenAi(text);
    return NextResponse.json({ text: polished });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_openai_key") {
      return NextResponse.json({ error: "missing_openai_key" }, { status: 503 });
    }
    return NextResponse.json({ error: "polish_failed", detail: msg }, { status: 502 });
  }
}
