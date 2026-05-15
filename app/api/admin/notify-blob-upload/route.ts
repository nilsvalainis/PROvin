import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeStripeCheckoutSessionId, notifyPortfolioPathPrefix } from "@/lib/admin-notify-blob-constants";
import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function blobRwToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

/** Vai pieejama klienta augšupielāde uz Blob (apiņot Vercel ~4.5 MB API route multipart limitu). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: Boolean(blobRwToken()) });
}

/**
 * Vercel Blob `handleUpload` — tokena ģenerēšanai jābūt admin sesijai; `upload-completed` apstiprina paraksts.
 */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = raw as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    if (!(await getAdminSession())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const token = blobRwToken();
  if (!token) {
    return NextResponse.json(
      {
        error: "blob_disabled",
        message:
          "BLOB_READ_WRITE_TOKEN nav iestatīts — lielus portfeļa PDF nevar augšupielādēt caur Blob. Vercel → Environment Variables (vai lokāli .env.local).",
      },
      { status: 503 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let sessionId = "";
        if (clientPayload) {
          try {
            const o = JSON.parse(clientPayload) as { sessionId?: unknown };
            if (typeof o.sessionId === "string") sessionId = o.sessionId.trim();
          } catch {
            /* ignore */
          }
        }
        if (!isSafeStripeCheckoutSessionId(sessionId)) {
          throw new Error("Invalid clientPayload.sessionId");
        }
        const needPrefix = `${notifyPortfolioPathPrefix(sessionId)}/`;
        if (!pathname.startsWith(needPrefix)) {
          throw new Error("Invalid pathname prefix for notify portfolio upload");
        }
        return {
          allowedContentTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES,
          tokenPayload: clientPayload,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/notify-blob-upload]", e);
    return NextResponse.json({ error: "handle_upload_failed", message: msg }, { status: 400 });
  }
}
