import { NextResponse } from "next/server";
import { appendIrissPdHistory, canRebaseIrissPd, rebaseIrissPd } from "@/lib/iriss-piedavajumi";
import { importIrissPdFromLink, importIrissPdFromStock, type IrissPdImport } from "@/lib/iriss-piedavajumi-create";
import { irissPdImportFromListing } from "@/lib/iriss-piedavajumi-from-listing";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { irissPdLinkErrorLv } from "@/lib/iriss-piedavajumi-sources";
import { createIrissPd, isIrissPdStoreEnabled, listIrissPdRows, readIrissPd, refreshIrissPdExpiries } from "@/lib/iriss-piedavajumi-store";
import { emptyIrissPdClient, emptyIrissPiedavajums, isSafeIrissPdId, type IrissPdClient, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Izsoles detaļu lapa caur releju var aizņemt līdz ~2,5 min.
export const maxDuration = 180;

const noStore = { "Cache-Control": "private, no-store" };

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
}

/** GET - visi piedāvājumi (saraksta rindas). Termiņi pārbaudīti ielādē. */
export async function GET() {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  if (!isIrissPdStoreEnabled()) return fail(503, "store_disabled");
  await refreshIrissPdExpiries(Date.now()).catch(() => 0);
  return NextResponse.json({ ok: true, rows: await listIrissPdRows() }, { headers: noStore });
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
};

function fromImport(imp: IrissPdImport, at: string, by: string) {
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
    };
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
 * POST - jauns piedāvājums:
 *   { kind: "autoparks" | "logistics", carId }  no Autoparka / Loģistikas (autofill + /STOCK bildes)
 *   { kind: "manual" }                    tukšs piedāvājums, visi lauki ar roku
 *   { kind: "link", url, manual? }        no izsoles saites (Auto1 pilnībā; manual - tikai saite, lauki ar roku)
 *   { kind: "listing", listingId }       no Sludinājumiem (auto dati, bildes, pirkuma cena jau ielasīti)
 *   { kind: "rebase", baseId }            «Izveidot jaunu uz šī bāzes» (beidzies/noraidīts)
 *   { kind: "request", client? }          klienta pieprasījums bez auto (statuss «Pieprasīts»)
 * Visiem veidiem (izņemot rebase) var nodot `client` - piesaista klientu un pasūtījumu jau izveidē.
 */
export async function POST(req: Request) {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  if (!isIrissPdStoreEnabled()) return fail(503, "store_disabled");
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail(400, "invalid_json");
  }
  const at = new Date().toISOString();
  const by = gate.actor.name || "Admins";
  const id = crypto.randomUUID();

  let build: ((number: number) => IrissPiedavajums) | null = null;
  let note = "";
  const client = clientFrom(body.client);
  if (body.kind === "autoparks" || body.kind === "logistics") {
    const kind = body.kind;
    const carId = typeof body.carId === "string" ? body.carId.trim() : "";
    if (!/^[\w-]{1,80}$/.test(carId)) return fail(400, "invalid");
    // Nils 28.10: vienam auto drīkst būt vairāki piedāvājumi (agrāk «1 auto = 1 piedāvājums» bloķēja).
    const imp = await importIrissPdFromStock(kind, carId);
    if (!imp) return fail(404, "not_found", { message: kind === "autoparks" ? "Auto Autoparkā nav atrasts." : "Auto Loģistikā nav atrasts." });
    build = fromImport(imp, at, by)(id);
    note = imp.note;
  } else if (body.kind === "link") {
    const url = typeof body.url === "string" ? body.url : "";
    const res = await importIrissPdFromLink(url, { manual: body.manual === true });
    if (!res.ok) {
      const status = res.error === "not_auction_link" ? 400 : 502;
      return fail(status, res.error, { message: irissPdLinkErrorLv(res.error, res.note), source: res.link?.source ?? null });
    }
    build = fromImport(res.data, at, by)(id);
    note = res.data.note;
  } else if (body.kind === "listing") {
    const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
    if (!/^[\w-]{1,80}$/.test(listingId)) return fail(400, "invalid");
    const view = await readIrissListingsLatestViewWithMarketplace().catch(() => null);
    const vehicle = view?.vehicles.find((v) => v.id === listingId) ?? null;
    if (!vehicle) return fail(404, "not_found", { message: "Sludinājums vairs nav atrodams - atjauno sarakstu." });
    const imp = irissPdImportFromListing(vehicle);
    build = fromImport(imp, at, by)(id);
    note = imp.note;
  } else if (body.kind === "rebase") {
    const baseId = typeof body.baseId === "string" ? body.baseId : "";
    if (!isSafeIrissPdId(baseId)) return fail(400, "invalid");
    const base = await readIrissPd(baseId);
    if (!base) return fail(404, "not_found");
    if (!canRebaseIrissPd(base.status)) return fail(409, "not_rebasable", { message: "Jaunu uz bāzes var veidot tikai no beigušā vai noraidītā piedāvājuma." });
    build = (number) => rebaseIrissPd(base, { id, number, at, by });
  } else if (body.kind === "manual") {
    build = (number) =>
      appendIrissPdHistory({ ...emptyIrissPiedavajums(id, at), number, source: "manual" }, { at, by, text: "Izveidots tukšs (aizpilda ar roku)" });
  } else if (body.kind === "request") {
    build = (number) =>
      appendIrissPdHistory({ ...emptyIrissPiedavajums(id, at), number, status: "requested", client }, { at, by, text: "Reģistrēts klienta pieprasījums" });
  } else {
    return fail(400, "invalid_kind");
  }

  const withClient = build;
  const hasClient = Boolean(client.name || client.phone || client.email || client.orderId);
  const created = await createIrissPd(
    hasClient && body.kind !== "rebase" && body.kind !== "request" ? (number) => ({ ...withClient(number), client }) : withClient,
  );
  if (!created.ok) return fail(500, created.error);
  return NextResponse.json({ ok: true, id: created.record.id, note }, { headers: noStore });
}
