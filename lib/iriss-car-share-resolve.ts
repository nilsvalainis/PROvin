import "server-only";

import { AUTOPARKS_STATUS_SHORT_LV, autoparksCarTitle } from "@/lib/iriss-autoparks";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";
import {
  autoparksSaitesHref,
  buildIrissCarShareAdminView,
  formatPasutijumsSaitesSubtitle,
  formatSaitesDotLine,
  logistikaSaitesHref,
  logisticsSaitesCity,
  logisticsSaitesStatusShort,
  pasutijumsSaitesHref,
  saitesCrossLinkTitle,
  type IrissSaitesCrossLink,
  type IrissSaitesView,
} from "@/lib/iriss-car-share";
import { getPublicSiteOrigin } from "@/lib/site-url";
import {
  ensureIrissCarShare,
  readIrissCarShareByKeys,
  irissCarShareStatusOf,
  markIrissCarShareSent,
  type IrissCarShareRecord,
} from "@/lib/iriss-car-share-store";
import { findLogisticsOrderByVin, getLogisticsOrder } from "@/lib/iriss-logistics-store";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { listIrissPasutijumi, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { isIrissPasutijumsWorkingStatus } from "@/lib/iriss-pasutijumi-types";
import { parseOfferSourceRef } from "@/lib/iriss-stock-photos";

export type IrissCarShareFrom = "autoparks" | "logistics";

type Resolved = {
  autoparksCarId: string;
  logisticsOrderId: string;
  vin: string;
  vehicle: string;
  phone: string;
  clientName: string;
  offerTitle: string;
  pasutijumsId: string;
  autoparksStatus: string;
  logisticsSubtitle: string;
};

function cityOf(order: LogisticsOrder | null): string {
  if (!order) return "";
  return logisticsSaitesCity(order.pickupAddress, order.pickupSnapshot?.city);
}

async function findPasutijums(opts: { vin: string; autoparksCarId: string; logisticsOrderId: string }) {
  const rows = await listIrissPasutijumi().catch(() => []);
  const vin = opts.vin.trim().toUpperCase();
  const byVin = vin
    ? rows.filter((r) => r.vin.trim().toUpperCase() === vin)
    : [];
  const picked =
    byVin.find((r) => isIrissPasutijumsWorkingStatus(r.listStatus)) ??
    byVin.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
    null;
  if (!picked) return { id: "", clientName: "", phone: "", offerTitle: "" };
  const rec = await readIrissPasutijums(picked.id).catch(() => null);
  let offerTitle = "";
  if (rec?.offers.length) {
    const fromSource = rec.offers.find((o) => {
      const ref = parseOfferSourceRef(o.sourceRef);
      return (
        (ref?.kind === "autoparks" && ref.id === opts.autoparksCarId) ||
        (ref?.kind === "logistics" && ref.id === opts.logisticsOrderId)
      );
    });
    offerTitle = (fromSource ?? rec.offers[rec.offers.length - 1])?.title ?? "";
  }
  return {
    id: picked.id,
    clientName: picked.clientFirstName.trim(),
    phone: picked.phone.trim(),
    offerTitle: offerTitle.trim() || "Piedāvājums 1",
  };
}

async function resolveEntities(from: IrissCarShareFrom, id: string): Promise<Resolved | null> {
  if (from === "autoparks") {
    const found = await readAutoparksV2Car(id).catch(() => null);
    if (!found) return null;
    const car = found.car;
    const logistics =
      (car.orderId ? await getLogisticsOrder(car.orderId).catch(() => null) : null) ??
      (car.vin ? await findLogisticsOrderByVin(car.vin).catch(() => null) : null);
    const pas = await findPasutijums({
      vin: car.vin,
      autoparksCarId: car.id,
      logisticsOrderId: logistics?.id ?? car.orderId,
    });
    return {
      autoparksCarId: car.id,
      logisticsOrderId: logistics?.id ?? car.orderId,
      vin: car.vin,
      vehicle: autoparksCarTitle(car),
      phone: pas.phone,
      clientName: pas.clientName,
      offerTitle: pas.offerTitle,
      pasutijumsId: pas.id,
      autoparksStatus: AUTOPARKS_STATUS_SHORT_LV[car.status],
      logisticsSubtitle: formatSaitesDotLine([
        logistics ? logisticsSaitesStatusShort(logistics.status, "Ceļā") : "",
        cityOf(logistics) || car.location.split(",")[0]?.trim() || "",
      ]),
    };
  }
  const order = await getLogisticsOrder(id).catch(() => null);
  if (!order) return null;
  const state = await readAutoparksState().catch(() => null);
  const car =
    state?.cars.find((c) => c.orderId === order.id) ??
    (order.vin ? state?.cars.find((c) => c.vin && c.vin === order.vin.toUpperCase()) : undefined);
  const pas = await findPasutijums({
    vin: order.vin,
    autoparksCarId: car?.id ?? "",
    logisticsOrderId: order.id,
  });
  return {
    autoparksCarId: car?.id ?? "",
    logisticsOrderId: order.id,
    vin: order.vin,
    vehicle: (order.title || `${order.make} ${order.model}`).replace(/\s+/g, " ").trim(),
    phone: pas.phone,
    clientName: pas.clientName,
    offerTitle: pas.offerTitle,
    pasutijumsId: pas.id,
    autoparksStatus: car ? AUTOPARKS_STATUS_SHORT_LV[car.status] : "",
    logisticsSubtitle: formatSaitesDotLine([
      logisticsSaitesStatusShort(order.status, "Ceļā"),
      cityOf(order),
    ]),
  };
}

function crossLinks(from: IrissCarShareFrom, ctx: Resolved): IrissSaitesCrossLink[] {
  const out: IrissSaitesCrossLink[] = [];
  if (from !== "logistics" && ctx.logisticsOrderId) {
    out.push({
      kind: "logistika",
      href: logistikaSaitesHref(ctx.logisticsOrderId),
      title: saitesCrossLinkTitle("logistika"),
      subtitle: ctx.logisticsSubtitle,
    });
  }
  if (from !== "autoparks" && ctx.autoparksCarId) {
    out.push({
      kind: "autoparks",
      href: autoparksSaitesHref(ctx.autoparksCarId),
      title: saitesCrossLinkTitle("autoparks"),
      subtitle: formatSaitesDotLine([ctx.autoparksStatus, "auto istaba"]),
    });
  }
  if (ctx.pasutijumsId) {
    out.push({
      kind: "pasutijums",
      href: pasutijumsSaitesHref(ctx.pasutijumsId),
      title: saitesCrossLinkTitle("pasutijums"),
      subtitle: formatPasutijumsSaitesSubtitle(ctx.clientName, ctx.offerTitle),
    });
  }
  return out;
}

function shareView(rec: IrissCarShareRecord, origin: string, nowMs: number) {
  return buildIrissCarShareAdminView({
    token: rec.token,
    status: irissCarShareStatusOf(rec),
    origin,
    clientName: rec.clientName,
    sentAt: rec.sentAt,
    channel: rec.sentChannel || undefined,
    nowMs,
  });
}

/**
 * Saišu bloks. Publisko auto saiti /a/ veido TIKAI ar pogu "Izveidot saiti klientam" (`create: true`,
 * Nils 27.10); kartītes atvēršana saiti tikai nolasa. WhatsApp sūtīšana to izveido, ja vēl nav.
 */
export async function loadIrissSaitesView(
  from: IrissCarShareFrom,
  id: string,
  opts: { create?: boolean } = {},
): Promise<{ view: IrissSaitesView; vehicle: string } | null> {
  const ctx = await resolveEntities(from, id);
  if (!ctx) return null;
  let rec = null as Awaited<ReturnType<typeof ensureIrissCarShare>> | null;
  const keys = { autoparksCarId: ctx.autoparksCarId, logisticsOrderId: ctx.logisticsOrderId, vin: ctx.vin };
  try {
    rec = opts.create ? await ensureIrissCarShare({ ...keys, clientName: ctx.clientName }) : await readIrissCarShareByKeys(keys);
  } catch {
    rec = null;
  }
  return {
    vehicle: ctx.vehicle,
    view: {
      crossLinks: crossLinks(from, ctx),
      share: rec ? shareView(rec, getPublicSiteOrigin(), Date.now()) : null,
      phone: ctx.phone,
    },
  };
}

export async function sendIrissSaitesWhatsApp(
  from: IrissCarShareFrom,
  id: string,
  actorName: string,
): Promise<{ view: IrissSaitesView; vehicle: string } | null> {
  const loaded = await loadIrissSaitesView(from, id, { create: true });
  if (!loaded?.view.share) return loaded;
  const rec = await markIrissCarShareSent({
    token: loaded.view.share.token,
    actorName,
    channel: "whatsapp",
  });
  if (!rec) return loaded;
  return {
    vehicle: loaded.vehicle,
    view: {
      ...loaded.view,
      share: shareView(rec, getPublicSiteOrigin(), Date.now()),
    },
  };
}
