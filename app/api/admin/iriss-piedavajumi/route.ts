import { NextResponse } from "next/server";
import { appendIrissPdHistory, canRebaseIrissPd, rebaseIrissPd } from "@/lib/iriss-piedavajumi";
import { importIrissPdFromLink, importIrissPdFromStock, type IrissPdImport } from "@/lib/iriss-piedavajumi-create";
import { irissPdImportFromListing, irissPdMergeListingWithLink } from "@/lib/iriss-piedavajumi-from-listing";
import { irissPdFactsFromAuto1, irissPdFactsFromAutoparks } from "@/lib/iriss-piedavajumi-facts";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { detectIrissPdLink, irissPdLinkErrorLv } from "@/lib/iriss-piedavajumi-sources";
import { findRecentDuplicateIrissPd, irissPdCreateIdentityKey, type IrissPdCreateIdentity } from "@/lib/iriss-piedavajumi-list-display";
import { irissPdListingRef } from "@/lib/iriss-piedavajumi-from-listing";
import { createIrissPd, isIrissPdStoreEnabled, listIrissPdRows, readIrissPd, refreshIrissPdExpiries } from "@/lib/iriss-piedavajumi-store";
import { emptyIrissPdClient, emptyIrissPiedavajums, isSafeIrissPdId, type IrissPdClient, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { irissPdFromLegacyOffer } from "@/lib/iriss-piedavajumi-from-legacy";
import { irissPdRowsForViewer, irissPdViewerCanUseStock, irissPdViewerFromActor, type IrissPdViewer } from "@/lib/iriss-piedavajumi-staff";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Izsoles detaļu lapa caur releju var aizņemt līdz ~2,5 min.
export const maxDuration = 180;

const noStore = { "Cache-Control": "private, no-store" };

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
}

/**
 * GET - visi piedāvājumi (saraksta rindas). Termiņi pārbaudīti ielādē.
 * P4: darbinieks (Pasūtījumi) saņem rindas bez avota saites un izsoles numura.
 */
export async function GET() {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!isIrissPdStoreEnabled()) return fail(503, "store_disabled");
  await refreshIrissPdExpiries(Date.now()).catch(() => 0);
  const viewer = irissPdViewerFromActor(gate.actor);
  return NextResponse.json({ ok: true, rows: irissPdRowsForViewer(await listIrissPdRows(), viewer) }, { headers: noStore });
}

type Body = {
  kind?: unknown;
  carId?: unknown;
  listingId?: unknown;
  url?: unknown;
  manual?: unknown;
  baseId?: unknown;
  status?: unknown;
  client?: unknown;
  orderId?: unknown;
  offerId?: unknown;
};

function fromImport(imp: IrissPdImport, at: string, viewer: IrissPdViewer) {
  const by = viewer.name;
  return (id: string) => (number: number): IrissPiedavajums => {
    const rec: IrissPiedavajums = {
      ...emptyIrissPiedavajums(id, at),
      number,
      source: imp.source,
      sourceRef: imp.sourceRef,
      sourceUrl: imp.sourceUrl,
      sourceKey: imp.sourceKey,
      importedFieldCount: imp.fieldCount,
      vehicle: imp.vehicle,
      photos: imp.photos,
      price: imp.price,
      purchasePrice: imp.purchasePrice,
      auto1: imp.auto1,
      auto1ImportedAt: imp.auto1 ? at : "",
      createdById: viewer.id,
      createdByName: viewer.name,
    };
    // Nils 30.10: Novērtējums klientam - fakti no izsoles (atslēgas, serviss, TA, avārija, krāsojums).
    if (imp.auto1) rec.content = { ...rec.content, facts: irissPdFactsFromAuto1(imp.auto1, rec.content.facts) };
    // 20.11: no Autoparka - atslēgu skaits un otrais riteņu komplekts (Pamatdati).
    if (imp.stockFacts) rec.content = { ...rec.content, facts: irissPdFactsFromAutoparks(imp.stockFacts, rec.content.facts) };
    return appendIrissPdHistory(rec, { at, by: imp.fieldCount ? "Sistēma" : by, text: imp.historyText });
  };
}

/** Klients nav obligāts (Nils 27.10); ja nāk no pasūtījuma - vārds, kontakti un pasūtījuma saite. */
function clientFrom(raw: unknown): IrissPdClient {
  const c = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...emptyIrissPdClient(),
    name: typeof c.name === "string" ? c.name.trim().slice(0, 120) : "",
    phone: typeof c.phone === "string" ? c.phone.trim().slice(0, 40) : "",
    email: typeof c.email === "string" ? c.email.trim().slice(0, 160) : "",
    orderId: isSafeIrissPdId(c.orderId) ? c.orderId : "",
  };
}

/**
 * Dubultklikšķis / atkārtots POST: tas pats sludinājums (vai izsoles saite) + tas pats pasūtījums.
 * Vienā instancē - kopīgs solījums; starp instancēm - indeksā svaigs melnraksts/nosūtīts (N minūtes).
 */
const inFlightCreates = new Map<string, Promise<Response>>();

function createIdentity(body: Body, client: IrissPdClient): IrissPdCreateIdentity | null {
  if (body.kind === "listing") {
    const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
    return listingId ? { sourceRef: irissPdListingRef(listingId), source: "", sourceKey: "", orderId: client.orderId } : null;
  }
  if (body.kind === "link") {
    const link = detectIrissPdLink(typeof body.url === "string" ? body.url : "");
    return link ? { sourceRef: "", source: link.source, sourceKey: link.key, orderId: client.orderId } : null;
  }
  return null;
}

/**
 * POST - jauns piedāvājums:
 *   { kind: "autoparks" | "logistics", carId }  no Autoparka / Loģistikas (autofill + /STOCK bildes)
 *   { kind: "manual" }                    tukšs piedāvājums, visi lauki ar roku
 *   { kind: "link", url, manual? }        no izsoles saites (Auto1 pilnībā; manual - tikai saite, lauki ar roku)
 *   { kind: "listing", listingId }       no Sludinājumiem (auto dati, bildes, pirkuma cena jau ielasīti)
 *   { kind: "rebase", baseId }            «Izveidot jaunu uz šī bāzes» (beidzies/noraidīts)
 *   { kind: "request", client? }          klienta pieprasījums bez auto (statuss «Pieprasīts»)
 *   { kind: "legacy", orderId, offerId }  P4: «Jauns PD uz šī bāzes» no vecā /p/ piedāvājuma (vecais netiek mainīts)
 * Visiem veidiem (izņemot rebase, legacy) var nodot `client` - piesaista klientu un pasūtījumu jau izveidē.
 * P4: darbinieks (Pasūtījumi) var veidot; Autoparks / Loģistika tikai ar attiecīgo sadaļu. Veidotājs tiek saglabāts.
 */
export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const viewer = irissPdViewerFromActor(gate.actor);
  if (!isIrissPdStoreEnabled()) return fail(503, "store_disabled");
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail(400, "invalid_json");
  }
  const identity = createIdentity(body, clientFrom(body.client));
  if (!identity) return createPd(body, viewer);
  // Darbiniekam dublikāts tikai paša veidotais (citu PD viņš var tikai skatīt).
  const dupRows = (await listIrissPdRows().catch(() => [])).filter((r) => viewer.kind === "admin" || r.createdById === viewer.id);
  const existing = findRecentDuplicateIrissPd(dupRows, identity, Date.now());
  if (existing) return NextResponse.json({ ok: true, id: existing, existing: true, note: "" }, { headers: noStore });
  const key = `${viewer.id}|${irissPdCreateIdentityKey(identity)}`;
  const pending = inFlightCreates.get(key);
  if (pending) return (await pending).clone();
  const run = createPd(body, viewer);
  inFlightCreates.set(key, run);
  try {
    return (await run).clone();
  } finally {
    inFlightCreates.delete(key);
  }
}

async function createPd(body: Body, viewer: IrissPdViewer): Promise<Response> {
  const at = new Date().toISOString();
  const by = viewer.name;
  const owned = (rec: IrissPiedavajums): IrissPiedavajums => ({ ...rec, createdById: viewer.id, createdByName: viewer.name });
  const id = crypto.randomUUID();

  let build: ((number: number) => IrissPiedavajums) | null = null;
  let note = "";
  const client = clientFrom(body.client);
  if (body.kind === "autoparks" || body.kind === "logistics") {
    const kind = body.kind;
    const carId = typeof body.carId === "string" ? body.carId.trim() : "";
    if (!/^[\w-]{1,80}$/.test(carId)) return fail(400, "invalid");
    if (!irissPdViewerCanUseStock(viewer, kind)) return fail(403, "forbidden", { message: kind === "autoparks" ? "Nav Autoparka tiesību." : "Nav Loģistikas tiesību." });
    // Nils 28.10: vienam auto drīkst būt vairāki piedāvājumi (agrāk «1 auto = 1 piedāvājums» bloķēja).
    const imp = await importIrissPdFromStock(kind, carId);
    if (!imp) return fail(404, "not_found", { message: kind === "autoparks" ? "Auto Autoparkā nav atrasts." : "Auto Loģistikā nav atrasts." });
    build = fromImport(imp, at, viewer)(id);
    note = imp.note;
  } else if (body.kind === "link") {
    const url = typeof body.url === "string" ? body.url : "";
    const res = await importIrissPdFromLink(url, { manual: body.manual === true });
    if (!res.ok) {
      const status = res.error === "not_auction_link" ? 400 : 502;
      return fail(status, res.error, { message: irissPdLinkErrorLv(res.error, res.note), source: res.link?.source ?? null });
    }
    build = fromImport(res.data, at, viewer)(id);
    note = res.data.note;
  } else if (body.kind === "listing") {
    const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
    if (!/^[\w-]{1,80}$/.test(listingId)) return fail(400, "invalid");
    const view = await readIrissListingsLatestViewWithMarketplace().catch(() => null);
    const vehicle = view?.vehicles.find((v) => v.id === listingId) ?? null;
    if (!vehicle) return fail(404, "not_found", { message: "Sludinājums vairs nav atrodams - atjauno sarakstu." });
    const fromListing = irissPdImportFromListing(vehicle);
    // Nils 20.11: tā pati ielase kā Piedāvājumu sadaļā (izsoles detaļu lapa caur releju, visi Auto1 bloki).
    // Ja saite nav nolasāma (stub avots, relejs nepieejams) - kā līdz šim, tikai sludinājuma dati.
    const linkRes = fromListing.sourceUrl ? await importIrissPdFromLink(fromListing.sourceUrl).catch(() => null) : null;
    const imp = linkRes?.ok && linkRes.data.fieldCount > 0 ? irissPdMergeListingWithLink(fromListing, linkRes.data) : fromListing;
    build = fromImport(imp, at, viewer)(id);
    note = imp.note;
  } else if (body.kind === "rebase") {
    const baseId = typeof body.baseId === "string" ? body.baseId : "";
    if (!isSafeIrissPdId(baseId)) return fail(400, "invalid");
    const base = await readIrissPd(baseId);
    if (!base) return fail(404, "not_found");
    if (!canRebaseIrissPd(base.status)) return fail(409, "not_rebasable", { message: "Jaunu uz bāzes var veidot tikai no beigušā vai noraidītā piedāvājuma." });
    build = (number) => rebaseIrissPd(base, { id, number, at, by, byId: viewer.id });
  } else if (body.kind === "legacy") {
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    const offerId = typeof body.offerId === "string" ? body.offerId : "";
    if (!isSafeIrissPasutijumsId(orderId) || !/^[\w-]{1,80}$/.test(offerId)) return fail(400, "invalid");
    const order = await readIrissPasutijums(orderId).catch(() => null);
    const offer = order?.offers.find((o) => o.id === offerId) ?? null;
    if (!order || !offer) return fail(404, "not_found", { message: "Vecais piedāvājums nav atrasts." });
    build = (number) => irissPdFromLegacyOffer(order, offer, { id, number, at, by, byId: viewer.id });
  } else if (body.kind === "manual") {
    build = (number) =>
      appendIrissPdHistory(owned({ ...emptyIrissPiedavajums(id, at), number, source: "manual" }), { at, by, text: "Izveidots tukšs (aizpilda ar roku)" });
  } else if (body.kind === "request") {
    build = (number) =>
      appendIrissPdHistory(owned({ ...emptyIrissPiedavajums(id, at), number, status: "requested", client }), { at, by, text: "Reģistrēts klienta pieprasījums" });
  } else {
    return fail(400, "invalid_kind");
  }

  const withClient = build;
  const hasClient = Boolean(client.name || client.phone || client.email || client.orderId);
  const created = await createIrissPd(
    hasClient && body.kind !== "rebase" && body.kind !== "request" && body.kind !== "legacy" ? (number) => ({ ...withClient(number), client }) : withClient,
  );
  if (!created.ok) return fail(500, created.error);
  return NextResponse.json({ ok: true, id: created.record.id, note }, { headers: noStore });
}
