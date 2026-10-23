import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { readOfferSourcePhoto } from "@/lib/iriss-offer-source";
import { isSafeDropboxFileId, offerSourceSection, parseOfferSourceRef } from "@/lib/iriss-stock-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auto /STOCK bilde piedāvājuma formai (pirms saglabāšanas). Pasūtījumu tiesība + Autoparks/Loģistika tiesība.
 * Id tiek pārbaudīts pret šī auto mapes sarakstu; Dropbox saites pārlūkam netiek dotas.
 */
export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const ref = parseOfferSourceRef(url.searchParams.get("from"));
  const id = url.searchParams.get("id");
  const size = url.searchParams.get("s") === "full" ? "full" : "thumb";
  if (!ref || !isSafeDropboxFileId(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const source = await requireIrissSectionApi(offerSourceSection(ref));
  if (!source.ok) return source.response;
  const bytes = await readOfferSourcePhoto(ref, id, size).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
