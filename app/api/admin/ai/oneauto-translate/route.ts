/**
 * Admin: OneAuto tabulu tulkojums latviešu valodā (Gemini Flash / Gemini).
 */
import { NextResponse } from "next/server";
import { nextJsonBodyWithAiUsage } from "@/lib/admin-ai-route-response";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import {
  translateOneautoDisplayWithAi,
  translateOneautoWorksWithAi,
} from "@/lib/admin-ai-oneauto-translate";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";
import { parseOneautoDisplay } from "@/lib/oneauto-catalog";

export const maxDuration = 120;
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
  const guard = await assertAiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  const display = parseOneautoDisplay(b.display);
  try {
    return await nextJsonBodyWithAiUsage(async () => {
      const scope = str(b.scope).trim() === "works" ? "works" : "all";
      const next =
        scope === "works"
          ? await translateOneautoWorksWithAi({
              display,
              operatorNotes: str(b.operatorNotes),
              modelTier: str(b.modelTier).trim() ? parseAiModelTier(b.modelTier) : "gemini-flash",
            })
          : await translateOneautoDisplayWithAi({
              display,
              operatorNotes: str(b.operatorNotes),
              modelTier: str(b.modelTier).trim() ? parseAiModelTier(b.modelTier) : "gemini-flash",
            });
      return { display: next };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "empty_source_data") {
      return NextResponse.json({ error: "empty_source_data" }, { status: 400 });
    }
    console.error("[ai/oneauto-translate]", msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
