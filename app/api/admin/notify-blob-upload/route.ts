import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken, handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/admin-auth";
import {
  isSafeNotifyOrderId,
  NOTIFY_BLOB_ALLOWED_CONTENT_TYPES,
  NOTIFY_BLOB_CLIENT_TOKEN_ACTION,
  notifyPortfolioPathPrefix,
} from "@/lib/admin-notify-blob-constants";
import { NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES } from "@/lib/notify-report-email-limits";
import { readBlobReadWriteTokenFromEnv } from "@/lib/vercel-blob-rw-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BLOB_DISABLED_MESSAGE =
  "BLOB_READ_WRITE_TOKEN nav iestatīts vai nav derīgs — lielus portfeļa PDF nevar augšupielādēt caur Blob. Vercel → Storage → Blob → Connect, Environment Variables (Production), tad Redeploy.";

function blobTokenOptions() {
  return {
    allowedContentTypes: [...NOTIFY_BLOB_ALLOWED_CONTENT_TYPES],
    maximumSizeInBytes: NOTIFY_REPORT_MAX_ATTACHMENTS_BYTES,
    addRandomSuffix: false as const,
  };
}

function invalidSessionOrPath(sessionId: string, pathname: string): string | null {
  if (!isSafeNotifyOrderId(sessionId)) return "Nederīgs pasūtījuma id Blob ceļam.";
  const needPrefix = `${notifyPortfolioPathPrefix(sessionId)}/`;
  if (!pathname.startsWith(needPrefix)) return "Nederīgs Blob ceļš šim pasūtījumam.";
  return null;
}

/** Vai pieejama klienta augšupielāde uz Blob (apiņot Vercel ~4.5 MB API route multipart limitu). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: Boolean(readBlobReadWriteTokenFromEnv()) });
}

/**
 * 1) `{ action: "client-token", pathname, sessionId }` — admin sesija + lasāma JSON kļūda.
 * 2) Vercel Blob `handleUpload` (vecais SDK `upload()` ceļš) paliek kā rezerve.
 */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const rec = raw as Record<string, unknown>;

  if (rec.action === NOTIFY_BLOB_CLIENT_TOKEN_ACTION) {
    if (!(await getAdminSession())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const token = readBlobReadWriteTokenFromEnv();
    if (!token) {
      return NextResponse.json({ error: "blob_disabled", message: BLOB_DISABLED_MESSAGE }, { status: 503 });
    }
    const pathname = typeof rec.pathname === "string" ? rec.pathname.trim() : "";
    const sessionId = typeof rec.sessionId === "string" ? rec.sessionId.trim() : "";
    const pathErr = invalidSessionOrPath(sessionId, pathname);
    if (pathErr) {
      return NextResponse.json({ error: "invalid_pathname", message: pathErr }, { status: 400 });
    }
    try {
      const clientToken = await generateClientTokenFromReadWriteToken({
        token,
        pathname,
        ...blobTokenOptions(),
        validUntil: Date.now() + 60 * 60 * 1000,
      });
      return NextResponse.json({ clientToken });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[api/admin/notify-blob-upload] client-token", e);
      const invalidToken = /Invalid .*BLOB_READ_WRITE_TOKEN|Invalid `token`/i.test(msg);
      return NextResponse.json(
        {
          error: invalidToken ? "blob_token_invalid" : "token_failed",
          message: invalidToken
            ? BLOB_DISABLED_MESSAGE
            : "Neizdevās izveidot Blob augšupielādes atļauju. Pārbaudi BLOB_READ_WRITE_TOKEN un Redeploy.",
        },
        { status: invalidToken ? 503 : 400 },
      );
    }
  }

  if (typeof rec.type !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = raw as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    if (!(await getAdminSession())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const token = readBlobReadWriteTokenFromEnv();
  if (!token) {
    return NextResponse.json({ error: "blob_disabled", message: BLOB_DISABLED_MESSAGE }, { status: 503 });
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
        const pathErr = invalidSessionOrPath(sessionId, pathname);
        if (pathErr) throw new Error(pathErr);
        return {
          ...blobTokenOptions(),
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
