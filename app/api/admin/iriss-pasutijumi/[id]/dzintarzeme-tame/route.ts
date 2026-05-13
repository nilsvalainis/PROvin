import { NextResponse } from "next/server";

import { generateDzintarzemeTamePdfBytes } from "@/lib/dzintarzeme-tame-pdf";
import { parseDzintarzemeTameBody } from "@/lib/dzintarzeme-tame-calculator";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

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

  const bytes = await generateDzintarzemeTamePdfBytes(parsed.value);
  const pdfCache = "no-store, no-cache, must-revalidate, max-age=0, private" satisfies string;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dzintarzeme-auto-tame.pdf"`,
      "Cache-Control": pdfCache,
      Pragma: "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
