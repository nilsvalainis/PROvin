/**
 * Admin «Priekšskats» (Nils 26.11): nobraukuma un negadījumu tabulas ar PDF CSS - bez Chromium un bez PDF faila.
 * Ķermenis: tas pats `ClientReportPayload`, ko pasūtījuma lapa padod PDF ģeneratoram (bez foto). Tikai lasa.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  buildReportPreviewDocumentHtml,
  type ClientReportPayload,
  type ReportPreviewTab,
} from "@/lib/client-report-html";

export const runtime = "nodejs";
export const maxDuration = 30;

const TABS = new Set<ReportPreviewTab>(["all", "mileage", "incidents"]);

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = (body ?? {}) as { payload?: unknown; tab?: unknown };
  if (!b.payload || typeof b.payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  // Bez `tab` - visas trīs cilnes vienā atbildē (cilņu pārslēgšana bez jauna pieprasījuma).
  const tabs: ReportPreviewTab[] = TABS.has(b.tab as ReportPreviewTab) ? [b.tab as ReportPreviewTab] : [...TABS];
  try {
    const payload = b.payload as ClientReportPayload;
    const html: Partial<Record<ReportPreviewTab, string>> = {};
    for (const t of tabs) html[t] = buildReportPreviewDocumentHtml(payload, t);
    return NextResponse.json({ html });
  } catch (e) {
    console.error("[report-preview]", e);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
