import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listingOfferSlug } from "@/lib/iriss-listings-offer";
import { zipListingPhotoUrls } from "@/lib/iriss-listings-photos-zip";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const b = body as { urls?: unknown; title?: unknown; year?: unknown };
  const urls = Array.isArray(b.urls) ? b.urls.filter((u): u is string => typeof u === "string") : [];
  try {
    const zip = await zipListingPhotoUrls(urls);
    const name = `${listingOfferSlug(typeof b.title === "string" ? b.title : "auto", typeof b.year === "string" ? b.year : "") || "auto"}.zip`;
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "zip_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
