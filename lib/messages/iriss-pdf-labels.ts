import { renderTemplateString } from "@/lib/messages/render-template";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

function bodyFor(id: string, doc?: MessageTemplatesDoc | null): string {
  const def = getMessageTemplateDef(id);
  if (!def) return "";
  const o = doc?.overrides[id];
  return o?.body ?? def.body;
}

/** Viena PDF etiķete vai virsraksts ar opciju mainīgajiem. */
export function irissPdfLabel(id: string, vars: Record<string, string> = {}, doc?: MessageTemplatesDoc | null): string {
  const raw = bodyFor(id, doc);
  if (!raw) return "";
  return renderTemplateString(raw, vars);
}

export type IrissOfferPdfLabels = {
  heroSub: (date: string) => string;
  secClient: string;
  secBasic: string;
  secEvalMarks: string;
  secSpecial: string;
  secVisual: string;
  secVisualDetail: string;
  secTechnical: string;
  secTechnicalDetail: string;
  secSummary: string;
  secPricing: string;
  secPhotos: string;
  kvClient: string;
  kvPhone: string;
  kvEmail: string;
  tileYear: string;
  tileOdometer: string;
  tileTransmission: string;
  tileLocation: string;
  checkServiceHistory: string;
  checkFactoryPaint: string;
  checkNoRust: string;
  checkSecondWheels: string;
  priceCar: string;
  priceDelivery: string;
  priceCommission: string;
  priceTotal: string;
  priceValidDays: string;
};

export type IrissOrderPdfLabels = {
  heroSub: (date: string) => string;
  secClient: string;
  secVehicle: string;
  secDeal: string;
  secEquipment: string;
  secNotes: string;
  kvFirstName: string;
  kvLastName: string;
  kvPhone: string;
  kvEmail: string;
  kvOrderDate: string;
  equipRequired: string;
  equipDesired: string;
};

export function resolveIrissOfferPdfLabels(doc?: MessageTemplatesDoc | null): IrissOfferPdfLabels {
  const L = (id: string, vars: Record<string, string> = {}) => irissPdfLabel(id, vars, doc);
  return {
    heroSub: (date) => L("iriss.pdf.offer.hero_sub", { date }),
    secClient: L("iriss.pdf.shared.sec.client"),
    secBasic: L("iriss.pdf.offer.sec.basic"),
    secEvalMarks: L("iriss.pdf.offer.sec.eval_marks"),
    secSpecial: L("iriss.pdf.offer.sec.special"),
    secVisual: L("iriss.pdf.offer.sec.visual"),
    secVisualDetail: L("iriss.pdf.offer.sec.visual_detail"),
    secTechnical: L("iriss.pdf.offer.sec.technical"),
    secTechnicalDetail: L("iriss.pdf.offer.sec.technical_detail"),
    secSummary: L("iriss.pdf.offer.sec.summary"),
    secPricing: L("iriss.pdf.offer.sec.pricing"),
    secPhotos: L("iriss.pdf.offer.sec.photos"),
    kvClient: L("iriss.pdf.offer.kv.client"),
    kvPhone: L("iriss.pdf.shared.kv.phone"),
    kvEmail: L("iriss.pdf.shared.kv.email"),
    tileYear: L("iriss.pdf.offer.tile.year"),
    tileOdometer: L("iriss.pdf.offer.tile.odometer"),
    tileTransmission: L("iriss.pdf.offer.tile.transmission"),
    tileLocation: L("iriss.pdf.offer.tile.location"),
    checkServiceHistory: L("iriss.pdf.offer.check.service_history"),
    checkFactoryPaint: L("iriss.pdf.offer.check.factory_paint"),
    checkNoRust: L("iriss.pdf.offer.check.no_rust"),
    checkSecondWheels: L("iriss.pdf.offer.check.second_wheels"),
    priceCar: L("iriss.pdf.offer.price.car"),
    priceDelivery: L("iriss.pdf.offer.price.delivery"),
    priceCommission: L("iriss.pdf.offer.price.commission"),
    priceTotal: L("iriss.pdf.offer.price.total"),
    priceValidDays: L("iriss.pdf.offer.price.valid_days"),
  };
}

export function resolveIrissOrderPdfLabels(doc?: MessageTemplatesDoc | null): IrissOrderPdfLabels {
  const L = (id: string, vars: Record<string, string> = {}) => irissPdfLabel(id, vars, doc);
  return {
    heroSub: (date) => L("iriss.pdf.order.hero_sub", { date }),
    secClient: L("iriss.pdf.shared.sec.client"),
    secVehicle: L("iriss.pdf.order.sec.vehicle"),
    secDeal: L("iriss.pdf.order.sec.deal"),
    secEquipment: L("iriss.pdf.order.sec.equipment"),
    secNotes: L("iriss.pdf.order.sec.notes"),
    kvFirstName: L("iriss.pdf.order.kv.first_name"),
    kvLastName: L("iriss.pdf.order.kv.last_name"),
    kvPhone: L("iriss.pdf.shared.kv.phone"),
    kvEmail: L("iriss.pdf.shared.kv.email"),
    kvOrderDate: L("iriss.pdf.order.kv.order_date"),
    equipRequired: L("iriss.pdf.order.equip.required"),
    equipDesired: L("iriss.pdf.order.equip.desired"),
  };
}
