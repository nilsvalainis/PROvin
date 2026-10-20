import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { isSafeIrissPasutijumsId, readIrissGeneratedDocumentBytes, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id, docId } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id) || !docId?.trim()) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = await readIrissGeneratedDocumentBytes(rec, docId.trim());
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ascii = file.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return new NextResponse(Uint8Array.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
