import { NextResponse } from "next/server";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { CLIENT_REPORT_LINK_HEADERS } from "@/lib/client-report-link";
import {
  findUsableClientReportLink,
  readClientReportPdfInfo,
  readLatestClientReportPdf,
} from "@/lib/client-report-link-store";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function invalid(status: number): NextResponse {
  return new NextResponse("Saite vairs nav derīga - rakstiet info@provin.lv", {
    status,
    headers: { ...CLIENT_REPORT_LINK_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Klienta atskaites PDF straumēšana pēc tokena. PDF ceļu nosaka serveris no saites ieraksta
 * (pasūtījuma sessionId); pieprasījums ceļu ietekmēt nevar. Tokens netiek žurnālēts.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const ip = getClientIpFromHeaders(req.headers);
  const rl = await checkRateLimit(`client-report-link-pdf:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return invalid(429);

  const { token } = await ctx.params;
  try {
    const found = await findUsableClientReportLink((token ?? "").trim());
    if (!found) return invalid(404);
    const [bytes, info] = await Promise.all([
      readLatestClientReportPdf(found.sessionId),
      readClientReportPdfInfo(found.sessionId),
    ]);
    if (!bytes || bytes.byteLength === 0) return invalid(404);
    const download = new URL(req.url).searchParams.get("dl") === "1";
    const filename = info.filename;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...CLIENT_REPORT_LINK_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[api/atskaite] pdf", e instanceof Error ? e.message.slice(0, 160) : "error");
    return invalid(404);
  }
}
