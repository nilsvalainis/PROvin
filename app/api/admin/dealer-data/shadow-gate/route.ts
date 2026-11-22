/**
 * Ēnu režīms: kvalitātes pārbaude vēlreiz («Pārbaudīt vēlreiz», sūtīšanas forma, pēc servera PDF).
 * POST { sessionId, trigger?, pdf?: { pathname, filename } } - tikai spriedums darba ierakstā; NEKO nesūta.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { runDealerShadowGate } from "@/lib/dealer-shadow-gate-run";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import { isReportPdfPathname, reportPdfPathPrefix } from "@/lib/report-pdf-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIGGERS = ["manual", "send_dialog", "pdf"] as const;

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const o = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sessionId = String(o.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const trigger = TRIGGERS.find((t) => t === o.trigger) ?? "manual";

  let pdf: { filename: string; at: string } | null = null;
  const rawPdf = o.pdf && typeof o.pdf === "object" ? (o.pdf as Record<string, unknown>) : null;
  if (rawPdf) {
    const pathname = String(rawPdf.pathname ?? "").trim();
    // Tikai šī pasūtījuma servera PDF (tas pats ceļš, ko sūtīšana pievieno e-pastam).
    if (!isReportPdfPathname(sessionId, pathname, ".pdf")) {
      return NextResponse.json({ error: "invalid_pdf_path" }, { status: 400 });
    }
    const filename = pathname.slice(reportPdfPathPrefix(sessionId).length).replace(/^\d+-/, "").slice(0, 160);
    pdf = { filename, at: new Date().toISOString() };
  }

  const job = (await runDealerShadowGate(sessionId, { trigger, pdf })) ?? (await readDealerDataJob(sessionId));
  return NextResponse.json({ ok: Boolean(job?.shadowGate), job });
}
