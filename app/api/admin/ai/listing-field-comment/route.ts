/**
 * Admin: AI — sludinājuma analīzes lauku komentāri (fotogrāfijas / pārdošanas konteksts).
 */
import { NextResponse } from "next/server";
import { nextJsonWithAiUsage } from "@/lib/admin-ai-route-response";

import { getAdminSession } from "@/lib/admin-auth";
import { assertAiAllowedForSession } from "@/lib/admin-ai-demo-guard";
import { hasAnyAdminAiProviderKey } from "@/lib/admin-ai-dispatch";
import {
  generateListingFieldCommentWithAi,
  isAiListingCommentField,
} from "@/lib/admin-ai-listing-field";
import { mergeSourceBlocksFromBody } from "@/lib/admin-ai-api-body";
import { parseAiModelTier } from "@/lib/ai-admin-model-tier";

export const maxDuration = 90;
export const runtime = "nodejs";

type BodyShape = {
  sessionId?: unknown;
  field?: unknown;
  vin?: unknown;
  listingUrl?: unknown;
  customerName?: unknown;
  notes?: unknown;
  sourceBlocks?: unknown;
  internalComment?: unknown;
  mileageComment?: unknown;
  iriss?: unknown;
  apskatesPlāns?: unknown;
  tehniskoRiskuAnalize?: unknown;
  cenasAtbilstiba?: unknown;
  operatorNotes?: unknown;
  existingDraftPlain?: unknown;
  modelTier?: unknown;
};

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

  const b = body as BodyShape;
  const sessionId = str(b.sessionId).trim();
  const fieldRaw = str(b.field).trim();
  if (!isAiListingCommentField(fieldRaw)) {
    return NextResponse.json({ error: "invalid_field" }, { status: 400 });
  }

  const guard = await assertAiAllowedForSession(sessionId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error, ...(guard.detail ? { detail: guard.detail } : {}) },
      { status: guard.status },
    );
  }

  try {
    return nextJsonWithAiUsage(() => generateListingFieldCommentWithAi({
      sessionId,
      field: fieldRaw,
      vin: str(b.vin).trim() || null,
      listingUrl: str(b.listingUrl).trim() || null,
      customerName: str(b.customerName).trim() || null,
      notes: str(b.notes).trim() || null,
      sourceBlocks: mergeSourceBlocksFromBody(b),
      internalComment: str(b.internalComment),
      mileageComment: str(b.mileageComment),
      irissSummary: str(b.iriss),
      inspectionPlan: str(b.apskatesPlāns),
      technicalRiskAnalysis: str(b.tehniskoRiskuAnalize),
      priceFit: str(b.cenasAtbilstiba),
      operatorNotes: str(b.operatorNotes),
      existingDraftPlain: str(b.existingDraftPlain).trim() || undefined,
      modelTier: parseAiModelTier(b.modelTier),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg === "missing_listing_paste" || msg === "missing_photo_context") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[ai/listing-field-comment]", fieldRaw, msg);
    return NextResponse.json({ error: "generation_failed", detail: msg }, { status: 502 });
  }
}
