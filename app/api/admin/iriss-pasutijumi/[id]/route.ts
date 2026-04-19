import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
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

function parseBodyRecord(id: string, body: unknown): IrissPasutijumsRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
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
