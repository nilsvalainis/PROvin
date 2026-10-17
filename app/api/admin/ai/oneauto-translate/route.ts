/**
 * Admin: OneAuto tabulu tulkojums latviešu valodā (Gemini Flash / Gemini).
 */
import { NextResponse } from "next/server";
import { nextJsonBodyWithAiUsage } from "@/lib/admin-ai-route-response";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import {
  ensureDealerServiceWorksLatvian,
  translateOneautoDisplayWithAi,
  translateOneautoWorksWithAi,
} from "@/lib/admin-ai-oneauto-translate";
import { AI_ADMIN_MODEL_TIER_DEFAULT, parseAiModelTier } from "@/lib/ai-admin-model-tier";
import { normalizeAutoRecordsServiceWorkRows } from "@/lib/auto-records-service-works";
import { filledOneautoServiceEvents, parseOneautoDisplay } from "@/lib/oneauto-catalog";

export const maxDuration = 120;
export const runtime = "nodejs";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const scopeRaw = str(b.scope).trim();
  if (scopeRaw === "serviceWorks") {
    try {
      return await nextJsonBodyWithAiUsage(async () => {
        const ensured = await ensureDealerServiceWorksLatvian({
          serviceWorks: normalizeAutoRecordsServiceWorkRows(b.serviceWorks),
          originalTimeline: filledOneautoServiceEvents(
            Array.isArray(b.originalTimeline) ? (b.originalTimeline as never) : [],
          ),
        });
        return ensured;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      console.error("[ai/oneauto-translate] serviceWorks", msg);
      return NextResponse.json({
        serviceWorks: normalizeAutoRecordsServiceWorkRows(b.serviceWorks),
        translatedCount: 0,
        warning: "Dīlera darbu automātiskais tulkojums neizdevās. PDF ģenerēts ar esošajām rindām.",
      });
    }
  }

  if (!hasAnyAdminAiProviderKey()) {
    return NextResponse.json({ error: "missing_ai_key" }, { status: 503 });
  }

  const display = parseOneautoDisplay(b.display);
  try {
    return await nextJsonBodyWithAiUsage(async () => {
      const scope = scopeRaw === "works" ? "works" : "all";
      const next =
        scope === "works"
          ? await translateOneautoWorksWithAi({
              display,
              operatorNotes: str(b.operatorNotes),
              modelTier: AI_ADMIN_MODEL_TIER_DEFAULT,
            })
          : await translateOneautoDisplayWithAi({
              display,
              operatorNotes: str(b.operatorNotes),
              modelTier: str(b.modelTier).trim() ? parseAiModelTier(b.modelTier) : AI_ADMIN_MODEL_TIER_DEFAULT,
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
