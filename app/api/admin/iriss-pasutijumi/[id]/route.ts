import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import type { IrissOfferAttachment, IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import {
  deleteIrissPasutijums,
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

function parseOtherFromBody(o: Record<string, unknown>): string[] {
  const v = o.listingLinksOther;
  if (!Array.isArray(v)) return [""];
  return v.map((x) => (typeof x === "string" ? x : "")).slice(0, 20);
}

function parseOfferAttachments(raw: unknown): IrissOfferAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const name = typeof o.name === "string" ? o.name : "";
      const mimeType = typeof o.mimeType === "string" ? o.mimeType : "";
      const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
      const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
      const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
      if (!id || !name || !dataUrl) return null;
      return { id, name, mimeType, dataUrl, size };
    })
    .filter((x): x is IrissOfferAttachment => x !== null)
    .slice(0, 12);
}

function parseOffersFromBody(o: Record<string, unknown>): IrissOfferRecord[] {
  const v = o.offers;
  if (!Array.isArray(v)) return [];
  return v
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : "";
      if (!id) return null;
      return {
        id,
        title: typeof r.title === "string" ? r.title : `Piedāvājums ${idx + 1}`,
        brandModel: typeof r.brandModel === "string" ? r.brandModel : "",
        year: typeof r.year === "string" ? r.year : "",
        mileage: typeof r.mileage === "string" ? r.mileage : "",
        priceGermany: typeof r.priceGermany === "string" ? r.priceGermany : "",
        comment: typeof r.comment === "string" ? r.comment : "",
        attachments: parseOfferAttachments(r.attachments),
        createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
        updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
      };
    })
    .filter((x): x is IrissOfferRecord => x !== null)
    .slice(0, 30);
}

function parseBodyRecord(id: string, body: unknown): IrissPasutijumsRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
    pinnedAt: str("pinnedAt"),
    clientFirstName: str("clientFirstName"),
    clientLastName: str("clientLastName"),
    phone: str("phone"),
    email: str("email"),
    orderDate: str("orderDate"),
    brandModel: str("brandModel"),
    productionYears: str("productionYears"),
    totalBudget: str("totalBudget"),
    engineType: str("engineType"),
    transmission: str("transmission"),
    maxMileage: str("maxMileage"),
    preferredColors: str("preferredColors"),
    nonPreferredColors: str("nonPreferredColors"),
    interiorFinish: str("interiorFinish"),
    equipmentRequired: str("equipmentRequired"),
    equipmentDesired: str("equipmentDesired"),
    notes: str("notes"),
    listingLinkMobile: str("listingLinkMobile"),
    listingLinkAutobid: str("listingLinkAutobid"),
    listingLinkOpenline: str("listingLinkOpenline"),
    listingLinkAuto1: str("listingLinkAuto1"),
    listingLinksOther: parseOtherFromBody(o),
    offers: parseOffersFromBody(o),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ record: rec });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = parseBodyRecord(id, body);
  if (!rec) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const w = await writeIrissPasutijums(rec);
  if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
  const saved = await readIrissPasutijums(id);
  return NextResponse.json({ ok: true, record: saved });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const d = await deleteIrissPasutijums(id);
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
