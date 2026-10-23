import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { readGoogleContactsConfig } from "@/lib/google-contacts";
import { maybeSyncGoogleContact } from "@/lib/iriss-google-contact-sync";
import { normalizeGeneratedDocuments } from "@/lib/iriss-generated-documents";
import { parseIrissPasutijumsListingLinks } from "@/lib/iriss-listing-link-lists";
import { parseIrissDealWorkflowStatus } from "@/lib/iriss-order-overview-view";
import { pickIrissPasutijumsAuditFields } from "@/lib/iriss-pasutijumi-audit-fields";
import { parseIrissOffersFromBody } from "@/lib/iriss-pasutijumi-body";
import {
  normalizeIrissDzintarzemeTameDraft,
  parseIrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_STALE_REVISION,
  parseExpectedIrissRevision,
} from "@/lib/iriss-pasutijumi-save-safety";
import {
  deleteIrissPasutijums,
  hydrateIrissOfferImageThumbs,
  hydrateIrissPasutijumsImages,
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
/** Vercel: garš JSON + Blob/FS — pagarināts laiks, lai pēc 100% augšupielādes nepazustu ar 504. */
export const maxDuration = 120;

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
    modelExtension: str("modelExtension"),
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
    powerKw: str("powerKw"),
    damageTolerance: str("damageTolerance"),
    preferredCountries: str("preferredCountries"),
    clientFinancingPercent: (() => {
      const raw = o.clientFinancingPercent;
      const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
    })(),
    dealLeasingOrCredit: bool("dealLeasingOrCredit"),
    dealClientFinancing100: bool("dealClientFinancing100"),
    dealClientFinancing20: bool("dealClientFinancing20"),
    dealVat21Required: bool("dealVat21Required"),
    dealServiceStartDeposit: bool("dealServiceStartDeposit"),
    dealEkki: bool("dealEkki"),
    ...(parseIrissDealWorkflowStatus(o.dealWorkflowStatus)
      ? { dealWorkflowStatus: parseIrissDealWorkflowStatus(o.dealWorkflowStatus) }
      : {}),
    equipmentRequired: str("equipmentRequired"),
    equipmentDesired: str("equipmentDesired"),
    agentNotes: str("agentNotes"),
    notes: str("notes"),
    internalNotes: str("internalNotes"),
    ...parseIrissPasutijumsListingLinks(o),
    ...(o.ecarstradeLinksManual === true ? { ecarstradeLinksManual: true } : {}),
    dzintarzemeTameDraft: normalizeIrissDzintarzemeTameDraft(o.dzintarzemeTameDraft),
    offers: parseIrissOffersFromBody(o),
    generatedDocuments: normalizeGeneratedDocuments(o.generatedDocuments),
    ...pickIrissPasutijumsAuditFields(o),
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const thumbsOnly = new URL(req.url).searchParams.get("images") === "thumbs";
  const hydrated = thumbsOnly ? await hydrateIrissOfferImageThumbs(rec) : await hydrateIrissPasutijumsImages(rec);
  return NextResponse.json({
    record: hydrated,
    workspaceRevision: hydrated.workspaceRevision,
    googleContactsConfigured: Boolean(readGoogleContactsConfig()),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const { id } = await ctx.params;
  try {
    const gate = await requireIrissSectionApi("pasutijumi");
    if (!gate.ok) return gate.response;
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

    const previous = await readIrissPasutijums(id);

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

    const saved = await maybeSyncGoogleContact(w.record ?? previous, previous);
    return NextResponse.json({
      ok: true,
      record: saved,
      workspaceRevision: saved?.workspaceRevision ?? 0,
      googleContactsConfigured: Boolean(readGoogleContactsConfig()),
    });
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
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const d = await deleteIrissPasutijums(id);
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
