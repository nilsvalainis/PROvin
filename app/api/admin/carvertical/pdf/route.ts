import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { readCarverticalAutoStatus, readCarverticalPdf } from "@/lib/carvertical-auto-store";
import { getDropboxClient } from "@/lib/dropbox-client";
import { downloadOrderDropboxFile } from "@/lib/order-dropbox";
import { isInsideDropboxFolder } from "@/lib/iriss-autoparks-dropbox-path";
import { provOrdersDropboxRoot } from "@/lib/ltab-dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: fonā saņemtais CarVertical PDF (caur serveri, bez publiskas saites). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readCarverticalAutoStatus(sessionId);
  if (!status?.pdf) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let bytes = status.pdf.blobPath ? await readCarverticalPdf(sessionId) : null;
  const path = status.pdf.dropboxPath ?? "";
  if (!bytes && path && isInsideDropboxFolder(path, provOrdersDropboxRoot())) {
    const client = getDropboxClient();
    if (client) {
      try {
        bytes = (await downloadOrderDropboxFile(client, sessionId, path))?.bytes ?? null;
      } catch {
        bytes = null;
      }
    }
  }
  if (!bytes) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const name = status.pdf.name.replace(/[^\w .-]+/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
