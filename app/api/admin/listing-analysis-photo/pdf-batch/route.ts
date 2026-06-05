/**
 * PDF: visu sludinājuma analīzes fotogrāfiju base64 no ilgtermiņa glabātuves (Blob / disks).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  collectListingAnalysisPhotoIdsFromWorkspace,
  readListingAnalysisPhotosForPdf,
} from "@/lib/admin-listing-analysis-photo-store";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { isListingAnalysisPhotoId } from "@/lib/listing-analysis-photo-types";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";

export const maxDuration = 60;
export const runtime = "nodejs";

type BodyShape = {
  sessionId?: unknown;
  photoIds?: unknown;
};

export async function POST(req: Request) {
  try {
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

    const b = body as BodyShape;
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }

    const order = await getCheckoutSessionDetail(sessionId);
    if (!order || order.checkoutLine === "provin_select") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    let preferredOrder: string[] = [];
    if (Array.isArray(b.photoIds)) {
      preferredOrder = b.photoIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => isListingAnalysisPhotoId(id));
    }

    if (preferredOrder.length === 0) {
      const draft = await readOrderDraft(sessionId);
      preferredOrder = [...collectListingAnalysisPhotoIdsFromWorkspace(draft?.workspace ?? null)];
    }

    const { dataUrls, missing } = await readListingAnalysisPhotosForPdf(sessionId, preferredOrder);
    return NextResponse.json({
      ok: true,
      dataUrls,
      missing,
      count: Object.keys(dataUrls).length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[listing-analysis-photo/pdf-batch]", msg);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
