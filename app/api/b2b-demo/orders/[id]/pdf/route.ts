import { NextResponse } from "next/server";
import { requireB2bDemoActor } from "@/lib/b2b-demo-api";
import { isSafeB2bDemoOrderId } from "@/lib/b2b-demo-ids";
import { buildB2bDemoOrderPrintHtml } from "@/lib/b2b-demo-order-pdf-html";
import { buildB2bDemoOrderPdfBytes } from "@/lib/b2b-demo-order-pdf";
import { getB2bDemoTenantOrder, readB2bDemoTenantSettings } from "@/lib/b2b-demo-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeB2bDemoOrderId(id)) return NextResponse.json({ error: "Nederīgs pasūtījums." }, { status: 400 });
  const tenantId = gate.actor.session.tenantId;
  const order = await getB2bDemoTenantOrder(tenantId, id);
  if (!order) return NextResponse.json({ error: "Pasūtījums nav atrasts." }, { status: 404 });
  const settings = await readB2bDemoTenantSettings(tenantId);
  if (!settings) return NextResponse.json({ error: "Iestatījumi nav atrasti." }, { status: 404 });
  const generatedAt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());
  const opts = { tenantName: gate.actor.tenant.name, generatedAt };
  const url = new URL(req.url);
  const cache = "no-store, no-cache, must-revalidate, max-age=0, private";
  if (url.searchParams.get("format") === "html") {
    const html = buildB2bDemoOrderPrintHtml(order, settings, opts);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache, "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const bytes = await buildB2bDemoOrderPdfBytes(order, settings, opts);
  const inline = url.searchParams.get("inline") === "1" || url.searchParams.get("view") === "1";
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="pasutijums.pdf"`,
      "Cache-Control": cache,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
