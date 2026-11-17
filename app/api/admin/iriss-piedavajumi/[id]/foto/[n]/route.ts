import { NextResponse } from "next/server";
import { loadIrissPdPhoto } from "@/lib/iriss-piedavajumi-photo";
import { readIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Piedāvājuma bilde adminam (?s=full - liela, citādi sīktēls). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  const { id, n } = await params;
  const index = Number.parseInt(n, 10);
  if (!isSafeIrissPdId(id) || !Number.isInteger(index) || index < 0 || index > 99) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const rec = await readIrissPd(id);
  const size = new URL(req.url).searchParams.get("s") === "full" ? "full" : "thumb";
  const photo = rec ? await loadIrissPdPhoto(rec, index, size) : null;
  if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
