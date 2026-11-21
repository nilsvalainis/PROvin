import { NextResponse } from "next/server";
import { loadIrissPdPhoto } from "@/lib/iriss-piedavajumi-photo";
import { resolveIrissPdPhotoIndex } from "@/lib/iriss-piedavajumi-photo-key";
import { readIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Piedāvājuma bilde adminam un darbiniekam ar Pasūtījumiem (?s=full - liela, citādi sīktēls). Adrese netiek atklāta. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id, n } = await params;
  const index = Number.parseInt(n, 10);
  if (!isSafeIrissPdId(id) || !Number.isInteger(index) || index < 0 || index > 99) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const rec = await readIrissPd(id);
  const q = new URL(req.url).searchParams;
  const size = q.get("s") === "full" ? "full" : "thumb";
  // Nils 21.11: ar ?k= - bilde pēc stabila žetona (pēc noņemšanas/pārkārtošanas numurs norāda uz citu bildi).
  const at = rec ? resolveIrissPdPhotoIndex(rec.photos, index, q.get("k")) : -1;
  const photo = rec && at >= 0 ? await loadIrissPdPhoto(rec, at, size) : null;
  if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: { "Content-Type": photo.type, "Cache-Control": q.get("k") || q.get("v") ? "private, max-age=3600" : "private, no-cache", "X-Content-Type-Options": "nosniff" },
  });
}
