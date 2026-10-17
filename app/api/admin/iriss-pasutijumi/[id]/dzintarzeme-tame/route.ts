import { NextResponse } from "next/server";

import { generateDzintarzemeTamePdfBytes } from "@/lib/dzintarzeme-tame-pdf";
import { parseDzintarzemeTameBody } from "@/lib/dzintarzeme-tame-calculator";
import { parseIrissAdvanceAmount } from "@/lib/iriss-advance";
import { generatedDocumentResponseHeader } from "@/lib/iriss-generated-documents";
import { readIrissTameCommissionSettings } from "@/lib/iriss-tame-commission-store";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeIrissPasutijumsId, readIrissPasutijums, storeIrissGeneratedPdf } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseDzintarzemeTameBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const rates = await readIrissTameCommissionSettings();
  const bytes = await generateDzintarzemeTamePdfBytes(parsed.value, rates, {
    advancePaidEur: parseIrissAdvanceAmount(rec.advance?.amount ?? ""),
  });
  const pdfCache = "no-store, no-cache, must-revalidate, max-age=0, private" satisfies string;
  const date = new Date().toISOString().slice(0, 10);
  const tameName = `dzintarzeme-auto-tame-${date}.pdf`;
  let storedHeader: Record<string, string> = {};
  try {
    const stored = await storeIrissGeneratedPdf({
      orderId: rec.id,
      kind: "cost_estimate",
      name: tameName,
      bytes,
    });
    if (stored) storedHeader = generatedDocumentResponseHeader(stored.document, stored.workspaceRevision);
  } catch (e) {
    console.error("[iriss tame store]", e instanceof Error ? e.message : e);
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${tameName}"`,
      "Cache-Control": pdfCache,
      Pragma: "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      ...storedHeader,
    },
  });
}
