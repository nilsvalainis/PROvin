/**
 * P4 (Nils 20.11, 3A): vecais /p/ piedāvājums pasūtījumā paliek tikai lasīšanai; poga «Jauns PD uz šī bāzes»
 * izveido jauno PD ar vecā datiem (auto, klients, bildes, cenu daļas, apraksti). Vecais ieraksts netiek mainīts.
 * Tīra loģika - route nolasa pasūtījumu un saglabā rezultātu.
 */

import { appendIrissPdHistory, irissPdEurDigits, irissPdTotalFromParts } from "@/lib/iriss-piedavajumi";
import {
  IRISS_PD_MAX_HIGHLIGHTS,
  IRISS_PD_MAX_PHOTOS,
  emptyIrissPiedavajums,
  type IrissPdPhoto,
  type IrissPdSource,
  type IrissPiedavajums,
} from "@/lib/iriss-piedavajumi-types";
import type { IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const IMAGE_MIME_RE = /^image\/(jpeg|png|webp|gif|avif)$/i;

/** Bagātinātā teksta laukiem (HTML) - vienkāršs teksts PD laukiem. */
export function irissPdPlainFromHtml(html: string): string {
  return (html ?? "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 4000);
}

function legacySource(offer: IrissOfferRecord): { source: IrissPdSource; sourceRef: string } {
  const ref = (offer.sourceRef ?? "").trim();
  const m = /^(autoparks|logistics):[\w-]{1,80}$/.exec(ref);
  if (m) return { source: m[1] as IrissPdSource, sourceRef: ref };
  const p = offer.auctionPlatform.toLowerCase();
  const source: IrissPdSource = p.includes("auto1")
    ? "auto1"
    : p.includes("autobid")
      ? "autobid"
      : p.includes("openlane") || p.includes("adesa")
        ? "openlane"
        : p.includes("ecarstrade")
          ? "ecarstrade"
          : p.includes("mobile")
            ? "mobilede"
            : "manual";
  return { source, sourceRef: "" };
}

function legacyPhotos(orderId: string, offer: IrissOfferRecord): IrissPdPhoto[] {
  const atts = offer.attachments.filter((a) => IMAGE_MIME_RE.test(a.mimeType.split(";")[0]?.trim() ?? ""));
  // Vāks pirmais (kā vecajā PDF).
  const cover = offer.coverAttachmentId ? atts.findIndex((a) => a.id === offer.coverAttachmentId) : -1;
  const ordered = cover > 0 ? [atts[cover]!, ...atts.filter((_, i) => i !== cover)] : atts;
  return ordered
    .filter((a) => /^[\w-]{1,80}$/.test(a.id))
    .slice(0, IRISS_PD_MAX_PHOTOS)
    .map((a) => ({ kind: "order" as const, orderId, offerId: offer.id, attId: a.id }));
}

/** Vecā /p/ piedāvājuma dati -> jauns PD melnraksts (termiņš jāieliek no jauna). */
export function irissPdFromLegacyOffer(
  order: Pick<IrissPasutijumsRecord, "id" | "clientFirstName" | "clientLastName" | "phone" | "email">,
  offer: IrissOfferRecord,
  input: { id: string; number: number; at: string; by: string; byId: string },
): IrissPiedavajums {
  const { source, sourceRef } = legacySource(offer);
  const purchasePrice = irissPdEurDigits(offer.carPrice || offer.priceGermany || "");
  const logisticsCost = irissPdEurDigits(offer.deliveryPrice || "");
  const commission = irissPdEurDigits(offer.commissionFee || "");
  const parts = irissPdTotalFromParts(purchasePrice, logisticsCost, commission);
  const price = parts > 0 ? String(parts) : irissPdEurDigits(offer.estimatedTotalPrice || "");
  const highlights = [...new Set(offer.equipmentHighlights.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean))]
    .map((x) => x.slice(0, 80))
    .slice(0, IRISS_PD_MAX_HIGHLIGHTS);
  const base = emptyIrissPiedavajums(input.id, input.at);
  const note = [irissPdPlainFromHtml(offer.specialNotes), irissPdPlainFromHtml(offer.summary || offer.comment)].filter(Boolean).join("\n");
  const rec: IrissPiedavajums = {
    ...base,
    number: input.number,
    source,
    sourceRef,
    // Avots (izsoles numurs) paliek iekšējs - darbinieks to neredz (maskēšana API).
    sourceKey: offer.auctionStockNumber.trim().slice(0, 80),
    purchasePrice,
    logisticsCost,
    commission,
    price,
    vehicle: {
      ...base.vehicle,
      title: (offer.brandModel || offer.title).trim().slice(0, 200),
      vin: (offer.vin ?? "").trim().toUpperCase().slice(0, 40),
      year: (offer.year ?? "").trim().slice(0, 20),
      firstRegistration: (offer.firstRegistration ?? "").trim().slice(0, 40),
      mileageKm: irissPdEurDigits(offer.odometerReading || offer.mileage || ""),
      fuel: (offer.fuel ?? "").trim().slice(0, 80),
      transmission: (offer.transmission ?? "").trim().slice(0, 80),
      powerKw: (offer.powerKw ?? "").trim().slice(0, 40),
      engine: (offer.engineDisplacement ?? "").trim().slice(0, 80),
      color: (offer.color ?? "").trim().slice(0, 80),
      body: (offer.bodyTypeOffer ?? "").trim().slice(0, 80),
      location: (offer.location ?? "").trim().slice(0, 120),
    },
    client: {
      name: `${order.clientFirstName ?? ""} ${order.clientLastName ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 120),
      phone: (order.phone ?? "").trim().slice(0, 40),
      email: (order.email ?? "").trim().slice(0, 160),
      orderId: order.id,
    },
    photos: legacyPhotos(order.id, offer),
    content: {
      ...base.content,
      highlights,
      visual: irissPdPlainFromHtml(offer.visualAssessment),
      technical: irissPdPlainFromHtml(offer.technicalAssessment),
      note,
    },
    createdById: input.byId,
    createdByName: input.by,
  };
  return appendIrissPdHistory(rec, { at: input.at, by: input.by, text: `Izveidots uz vecā piedāvājuma bāzes («${(offer.title || "Piedāvājums").slice(0, 60)}»)` });
}
