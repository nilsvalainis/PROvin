/**
 * Admin Order Copilot — 👍/👎 atgriezeniskā saite. Žurnālā tikai komanda (anonimizēta),
 * darbību tipi, kļūda un laiks; bez vārdiem, e-pastiem, telefoniem un pasūtījuma ID.
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { recordCopilotFeedback } from "@/lib/admin-copilot-chat-store";
import { sanitizeCopilotFeedbackInput } from "@/lib/admin-copilot-helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).sessionId === "string"
      ? ((body as Record<string, unknown>).sessionId as string).trim()
      : "";
  const sessionHash = sessionId
    ? createHash("sha256").update(sessionId).digest("hex").slice(0, 12)
    : "";
  const entry = sanitizeCopilotFeedbackInput(body, { sessionHash });
  if (!entry) return NextResponse.json({ error: "invalid_feedback" }, { status: 400 });

  const stored = await recordCopilotFeedback(entry);
  return NextResponse.json({ ok: true, stored });
}
