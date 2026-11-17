import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeAdminOrderId } from "@/lib/admin-source-pdf-blob-constants";
import { REPORT_PDF_MAX_HTML_BYTES, reportPdfPathPrefix } from "@/lib/report-pdf-constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Klienta augšupielāde: atskaites HTML uz privātu Blob pirms servera PDF (izmēģinājums). */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = raw as HandleUploadBody;
  if (body.type === "blob.generate-client-token" && !(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "blob_disabled" }, { status: 503 });
  try {
    const json = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let sessionId = "";
        try {
          const o = JSON.parse(clientPayload ?? "{}") as { sessionId?: unknown };
          if (typeof o.sessionId === "string") sessionId = o.sessionId.trim();
        } catch {
          /* ignore */
        }
        if (!isSafeAdminOrderId(sessionId) || !pathname.startsWith(reportPdfPathPrefix(sessionId)) || !pathname.endsWith(".html")) {
          throw new Error("Invalid report-pdf upload path");
        }
        return {
          allowedContentTypes: ["text/html"],
          maximumSizeInBytes: REPORT_PDF_MAX_HTML_BYTES,
          tokenPayload: clientPayload,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: "handle_upload_failed", message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
