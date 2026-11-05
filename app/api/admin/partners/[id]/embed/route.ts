import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { validateB2bPartnerEmbedInput } from "@/lib/b2b-partner-embed";
import { getB2bPartnerById, updateB2bPartner } from "@/lib/b2b-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGE: Record<string, string> = {
  domains: "Ievadiet derīgus domēnus (līdz 5), piem. percunbrauc.lv.",
  logoOnDarkUrl: "Logo tumšam fonam: vajag https saiti.",
  logoOnLightUrl: "Logo gaišam fonam: vajag https saiti.",
};

/** PROVIN Business pogas iestatījumi partnerim: `{ enabled, domains, displayName, logoOnDarkUrl, logoOnLightUrl, buttonTone }`. */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeB2bPartnerId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const partner = await getB2bPartnerById(id);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const v = validateB2bPartnerEmbedInput(raw);
  if (!v.ok) return NextResponse.json({ error: v.error, message: MESSAGE[v.error] }, { status: 400 });

  const result = await updateB2bPartner(partner.id, { businessEmbed: v.embed });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ embed: result.partner.businessEmbed });
}
