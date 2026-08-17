import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  buildIrissOrdersBackupJsonString,
  buildIrissOrdersBackupZipBuffer,
  buildIrissPasutijumiListPdfBuffer,
  irissOrdersBackupFilename,
} from "@/lib/admin-iriss-pasutijumi-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function parseFormat(raw: string | null): "zip" | "json" | "pdf" {
  if (raw === "json") return "json";
  if (raw === "pdf") return "pdf";
  return "zip";
}

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = parseFormat(url.searchParams.get("format"));
  const filename = irissOrdersBackupFilename(format);

  try {
    if (format === "json") {
      const body = await buildIrissOrdersBackupJsonString();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "pdf") {
      const bytes = await buildIrissPasutijumiListPdfBuffer();
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const buffer = await buildIrissOrdersBackupZipBuffer();
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
    console.error("[admin iriss export]", e);
    return NextResponse.json({ error: "export_failed", message }, { status: 500 });
  }
}
