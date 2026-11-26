import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getDropboxClient } from "@/lib/dropbox-client";
import { downloadOrderDropboxFile } from "@/lib/order-dropbox";
import { provOrdersDropboxRoot } from "@/lib/ltab-dropbox";
import { isInsideDropboxFolder } from "@/lib/iriss-autoparks-dropbox-path";
import { readTraficomFiAutoStatus } from "@/lib/traficom-fi-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: Traficom bezmaksas PDF no pasūtījuma Dropbox mapes (caur serveri, bez publiskas saites). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readTraficomFiAutoStatus(sessionId);
  const path = status?.pdf?.dropboxPath ?? "";
  if (!path || !isInsideDropboxFolder(path, provOrdersDropboxRoot())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const client = getDropboxClient();
  if (!client) return NextResponse.json({ error: "dropbox_not_configured" }, { status: 503 });
  try {
    const got = await downloadOrderDropboxFile(client, sessionId, path);
    if (!got) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const bytes = got.bytes;
    const name = (status?.pdf?.name || "Traficom FI.pdf").replace(/[^\w .-]+/g, "_");
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
