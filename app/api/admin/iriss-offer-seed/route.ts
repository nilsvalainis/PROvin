import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { loadOfferSeed } from "@/lib/iriss-offer-source";
import { offerSourceSection, parseOfferSourceRef } from "@/lib/iriss-stock-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET ?from=autoparks:<id>|logistics:<id> - piedāvājuma formas sākuma lauki + /STOCK bilžu saraksts.
 * Tiesības: Pasūtījumi + (Autoparks pamatdati vai Loģistika). Summas no Autoparka netiek dotas.
 */
export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const ref = parseOfferSourceRef(new URL(req.url).searchParams.get("from"));
  if (!ref) return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  const source = await requireIrissSectionApi(offerSourceSection(ref));
  if (!source.ok) return source.response;
  const seed = await loadOfferSeed(ref).catch((e) => {
    console.error("[iriss-offer-seed]", e instanceof Error ? e.message : e);
    return null;
  });
  if (!seed) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json(seed, { headers: noStore });
}
