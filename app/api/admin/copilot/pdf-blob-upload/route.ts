/**
 * Klienta augšupielāde uz Vercel Blob avotu PDF failiem (Copilot čats un avotu bloku augšupielāde).
 * Vajadzīgs tikai tāpēc, ka lieli PDF neiekļaujas Vercel funkcijas pieprasījuma ķermenī.
 */
import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken, handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getAdminSession } from "@/lib/admin-auth";
import {
  isSafeAdminOrderId,
  SOURCE_PDF_BLOB_CLIENT_TOKEN_ACTION,
  sourcePdfBlobPathPrefix,
} from "@/lib/admin-source-pdf-blob-constants";
import { PDF_MAX_FILE_BYTES } from "@/lib/pdf-api-limits";
import { readBlobReadWriteTokenFromEnv } from "@/lib/vercel-blob-rw-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BLOB_DISABLED_MESSAGE =
  "BLOB_READ_WRITE_TOKEN nav iestatīts vai nav derīgs — PDF, kas lielāki par ~3 MB, nevar nonākt serverī. Vercel → Storage → Blob → Connect, Environment Variables (Production), tad Redeploy.";

function blobTokenOptions() {
  return {
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: PDF_MAX_FILE_BYTES,
    addRandomSuffix: false as const,
  };
}

function invalidSessionOrPath(sessionId: string, pathname: string): string | null {
  if (!isSafeAdminOrderId(sessionId)) return "Nederīgs pasūtījuma id Blob ceļam.";
  if (!pathname.startsWith(`${sourcePdfBlobPathPrefix(sessionId)}/`)) {
    return "Nederīgs Blob ceļš šim pasūtījumam.";
  }
  return null;
}

/** Vai lielos PDF vispār var augšupielādēt (UI pārbauda pirms faila izvēles). */
export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: Boolean(readBlobReadWriteTokenFromEnv()) });
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const rec = raw as Record<string, unknown>;

  if (rec.action === SOURCE_PDF_BLOB_CLIENT_TOKEN_ACTION) {
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
      console.error("[api/admin/copilot/pdf-blob-upload] client-token", e);
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

  if (body.type === "blob.generate-client-token" && !(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/copilot/pdf-blob-upload]", e);
    return NextResponse.json({ error: "handle_upload_failed", message }, { status: 400 });
  }
}
