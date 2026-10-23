import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getDropboxClient } from "@/lib/dropbox-client";
import { provOrdersDropboxRoot } from "@/lib/ltab-dropbox";
import { isInsideDropboxFolder } from "@/lib/iriss-autoparks-dropbox-path";
import { readLtabAutoStatus } from "@/lib/ltab-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: oriģinālais LTAB PDF no pasūtījuma Dropbox mapes (caur serveri, bez publiskas saites). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readLtabAutoStatus(sessionId);
  const path = status?.pdf?.dropboxPath ?? "";
  if (!path || !isInsideDropboxFolder(path, provOrdersDropboxRoot())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const client = getDropboxClient();
  if (!client) return NextResponse.json({ error: "dropbox_not_configured" }, { status: 503 });
  try {
    const { bytes } = await client.download(path);
    const name = (status?.pdf?.name || "LTAB.pdf").replace(/[^\w .-]+/g, "_");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${name}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "dropbox_download_failed" }, { status: 502 });
  }
}
