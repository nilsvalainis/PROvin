import { NextResponse } from "next/server";
import { summarizeCspReport } from "@/lib/csp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 16_384;

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(len) && len > MAX_BYTES) {
    return new NextResponse(null, { status: 204 });
  }
  let body: unknown = null;
  try {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const summary = summarizeCspReport(body);
  if (summary) {
    console.info("[csp-report]", summary.violatedDirective, summary.blockedUri, summary.documentHost);
  }
  return new NextResponse(null, { status: 204 });
}
