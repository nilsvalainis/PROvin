import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import { pickIrissPasutijumsAuditFields } from "@/lib/iriss-pasutijumi-audit-fields";
import {
  IRISS_MAX_OFFER_ATTACHMENTS,
  normalizeIrissDzintarzemeTameDraft,
  parseIrissPasutijumsListStatus,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_STALE_REVISION,
  parseExpectedIrissRevision,
} from "@/lib/iriss-pasutijumi-save-safety";
import {
  deleteIrissPasutijums,
  hydrateIrissPasutijumsImages,
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
/** Vercel: garš JSON + Blob/FS — pagarināts laiks, lai pēc 100% augšupielādes nepazustu ar 504. */
export const maxDuration = 120;

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
      const blobPath = typeof o.blobPath === "string" ? o.blobPath : "";
      const blobUrl = typeof o.blobUrl === "string" ? o.blobUrl : "";
      const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
      const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
      if (!id || !name) return null;
      if (!dataUrl && !blobPath) return null;
      return {
        id,
        name,
        mimeType,
        dataUrl,
        size,
        ...(blobPath ? { blobPath } : {}),
        ...(blobUrl ? { blobUrl } : {}),
      };
    })
    .filter((x): x is IrissOfferAttachment => x !== null)
    .slice(0, IRISS_MAX_OFFER_ATTACHMENTS);
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
        vin: typeof r.vin === "string" ? r.vin : "",
        year: typeof r.year === "string" ? r.year : "",
        mileage: typeof r.mileage === "string" ? r.mileage : "",
        priceGermany: typeof r.priceGermany === "string" ? r.priceGermany : "",
        comment: typeof r.comment === "string" ? r.comment : "",
        firstRegistration: typeof r.firstRegistration === "string" ? r.firstRegistration : "",
        odometerReading: typeof r.odometerReading === "string" ? r.odometerReading : "",
        transmission: typeof r.transmission === "string" ? r.transmission : "",
        location: typeof r.location === "string" ? r.location : "",
        hasFullServiceHistory: Boolean(r.hasFullServiceHistory),
        hasFactoryPaint: Boolean(r.hasFactoryPaint),
        hasNoRustBody: Boolean(r.hasNoRustBody),
        hasSecondWheelSet: Boolean(r.hasSecondWheelSet),
        specialNotes: typeof r.specialNotes === "string" ? r.specialNotes : "",
        visualAssessment: typeof r.visualAssessment === "string" ? r.visualAssessment : "",
        technicalAssessment: typeof r.technicalAssessment === "string" ? r.technicalAssessment : "",
        summary: typeof r.summary === "string" ? r.summary : "",
        carPrice: typeof r.carPrice === "string" ? r.carPrice : "",
        deliveryPrice: typeof r.deliveryPrice === "string" ? r.deliveryPrice : "",
        commissionFee: typeof r.commissionFee === "string" ? r.commissionFee : "",
        offerValidDays: typeof r.offerValidDays === "string" ? r.offerValidDays : "",
        attachments: parseOfferAttachments(r.attachments),
        createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
        updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : "",
      };
    })
    .filter((x): x is IrissOfferRecord => x !== null)
    .slice(0, 30);
}

function parseListStatusBody(v: unknown) {
  return parseIrissPasutijumsListStatus(v);
}

function parseBodyRecord(id: string, body: unknown): IrissPasutijumsRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  const bool = (k: string) => Boolean(o[k]);
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
    pinnedAt: str("pinnedAt"),
    workspaceRevision: parseExpectedIrissRevision(o.workspaceRevision) ?? 0,
    listStatus: parseListStatusBody(o.listStatus),
    clientFirstName: str("clientFirstName"),
    clientLastName: str("clientLastName"),
    phone: str("phone"),
    email: str("email"),
    orderDate: str("orderDate"),
    brandModel: str("brandModel"),
    vin: str("vin"),
    productionYears: str("productionYears"),
    totalBudget: str("totalBudget"),
    engineType: str("engineType"),
    transmission: str("transmission"),
    bodyType: str("bodyType"),
    driveType: str("driveType"),
    seatCount: str("seatCount"),
    maxMileage: str("maxMileage"),
    preferredColors: str("preferredColors"),
    nonPreferredColors: str("nonPreferredColors"),
    interiorFinish: str("interiorFinish"),
    dealLeasingOrCredit: bool("dealLeasingOrCredit"),
    dealClientFinancing100: bool("dealClientFinancing100"),
    dealClientFinancing20: bool("dealClientFinancing20"),
    dealVat21Required: bool("dealVat21Required"),
    dealServiceStartDeposit: bool("dealServiceStartDeposit"),
    dealEkki: bool("dealEkki"),
    equipmentRequired: str("equipmentRequired"),
    equipmentDesired: str("equipmentDesired"),
    notes: str("notes"),
    ...parseIrissPasutijumsListingLinks(o),
    dzintarzemeTameDraft: normalizeIrissDzintarzemeTameDraft(o.dzintarzemeTameDraft),
    offers: parseOffersFromBody(o),
    ...pickIrissPasutijumsAuditFields(o),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const hydrated = await hydrateIrissPasutijumsImages(rec);
  return NextResponse.json({ record: hydrated, workspaceRevision: hydrated.workspaceRevision });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const { id } = await ctx.params;
  try {
    const ok = await getAdminSession();
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[iriss PATCH] req.json failed", { id, ms: Date.now() - t0, err: String(e) });
      return NextResponse.json(
        { error: "invalid_json", detail: e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240) },
        { status: 400 },
      );
    }

    const rec = parseBodyRecord(id, body);
    if (!rec) {
      console.error("[iriss PATCH] invalid_body after parse", { id, ms: Date.now() - t0 });
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const expected =
      parseExpectedIrissRevision(bodyObj.expectedWorkspaceRevision) ??
      parseExpectedIrissRevision(bodyObj.workspaceRevision);

    let w: Awaited<ReturnType<typeof writeIrissPasutijums>>;
    try {
      w = await writeIrissPasutijums(rec, { expectedWorkspaceRevision: expected });
    } catch (e) {
      console.error("[iriss PATCH] writeIrissPasutijums threw", {
        id,
        ms: Date.now() - t0,
        err: String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return NextResponse.json(
        {
          error: "write_threw",
          detail: e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400),
        },
        { status: 500 },
      );
    }

    if (!w.ok) {
      if (w.stale || w.error === IRISS_STALE_REVISION) {
        return NextResponse.json(
          { error: IRISS_STALE_REVISION, record: w.record, workspaceRevision: w.record?.workspaceRevision ?? 0 },
          { status: 409 },
        );
      }
      console.error("[iriss PATCH] write rejected", { id, ms: Date.now() - t0, error: w.error });
      return NextResponse.json({ error: w.error }, { status: 500 });
    }

    const saved = w.record ?? (await readIrissPasutijums(id));
    return NextResponse.json({ ok: true, record: saved, workspaceRevision: saved?.workspaceRevision ?? 0 });
  } catch (e) {
    console.error("[iriss PATCH] unhandled", {
      id,
      ms: Date.now() - t0,
      err: String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      { error: "server_error", detail: e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400) },
      { status: 500 },
    );
  }
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
