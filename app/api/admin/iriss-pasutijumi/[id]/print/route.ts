import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" });
  const html = buildIrissPasutijumsPrintHtml(rec, dateFmt.format(new Date()));
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
