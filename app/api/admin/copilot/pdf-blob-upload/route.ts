/**
 * Klienta augšupielāde uz Vercel Blob avotu PDF failiem (Copilot čats un avotu bloku augšupielāde).
 * Vajadzīgs tikai tāpēc, ka lieli PDF neiekļaujas Vercel funkcijas pieprasījuma ķermenī.
 */
import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getAdminSession } from "@/lib/admin-auth";
import {
  isSafeAdminOrderId,
  sourcePdfBlobPathPrefix,
} from "@/lib/admin-source-pdf-blob-constants";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function blobRwToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

/** Vai lielos PDF vispār var augšupielādēt (UI pārbauda pirms faila izvēles). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: Boolean(blobRwToken()) });
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = raw as HandleUploadBody;

  if (body.type === "blob.generate-client-token" && !(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = blobRwToken();
  if (!token) {
    return NextResponse.json(
      {
        error: "blob_disabled",
        message:
          "BLOB_READ_WRITE_TOKEN nav iestatīts — PDF, kas lielāki par ~3 MB, nevar nonākt serverī. Vercel → Environment Variables (vai lokāli .env.local).",
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
        if (!isSafeAdminOrderId(sessionId)) throw new Error("Invalid clientPayload.sessionId");
        if (!pathname.startsWith(`${sourcePdfBlobPathPrefix(sessionId)}/`)) {
          throw new Error("Invalid pathname prefix for source PDF upload");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: PDF_MAX_FILE_BYTES,
          tokenPayload: clientPayload,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/copilot/pdf-blob-upload]", e);
    return NextResponse.json({ error: "handle_upload_failed", message }, { status: 400 });
  }
}
