/**
 * Dīlera PDF: atlasīto bilžu base64 (no jebkuras pasūtījuma galerijas), saspiestas, ar blur, ja atzīmēts.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { hidePhotoWatermarksFromCcVinWorkspace } from "@/lib/admin-photo-watermark";
import { dealerPhotoSrc, DEALER_PHOTOS_MAX } from "@/lib/dealer-photos";
import { readDealerPhotosForPdf } from "@/lib/dealer-photos-server";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => null)) as { sessionId?: unknown; items?: unknown } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    const items = (Array.isArray(body?.items) ? body.items : [])
      .map((x) => {
        const o = (x ?? {}) as { id?: unknown; blur?: unknown };
        return { id: typeof o.id === "string" ? o.id.trim() : "", blur: o.blur === true };
      })
      .filter((x) => dealerPhotoSrc(x.id))
      .slice(0, DEALER_PHOTOS_MAX);
    if (items.length === 0) return NextResponse.json({ ok: true, dataUrls: {}, missing: [] });

    const order = await getCheckoutSessionDetail(sessionId);
    if (!order || order.checkoutLine === "provin_select") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const draft = await readOrderDraft(sessionId);
    const { dataUrls, missing } = await readDealerPhotosForPdf({
      sessionId,
      items,
      coverCcVinWatermark: hidePhotoWatermarksFromCcVinWorkspace(draft?.workspace ?? null),
    });
    return NextResponse.json({ ok: true, dataUrls, missing });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dealer-photos/pdf-batch]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
