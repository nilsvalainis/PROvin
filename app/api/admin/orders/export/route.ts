import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  buildOrdersBackupJsonString,
  buildOrdersBackupZipBuffer,
  ordersBackupFilename,
} from "@/lib/admin-orders-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Liels Stripe saraksts + ZIP — Vercel Hobby: pēc vajadzības palielināt Pro plānā. */
export const maxDuration = 60;

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "zip";
  const filename = ordersBackupFilename(format);

  try {
    if (format === "json") {
      const body = await buildOrdersBackupJsonString();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const buffer = await buildOrdersBackupZipBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin orders export]", e);
    return NextResponse.json({ error: "export_failed", message }, { status: 500 });
  }
}
