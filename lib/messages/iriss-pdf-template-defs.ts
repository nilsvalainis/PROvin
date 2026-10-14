import type { MessageTemplateDef } from "@/lib/messages/types";

function label(id: string, group: string, title: string, body: string, vars: MessageTemplateDef["vars"] = []): MessageTemplateDef {
  return { id, channel: "iriss", group, title, body, vars };
}

/** IRISS drukas PDF statiskie virsraksti un etiķetes (inventāra D2). */
export const IRISS_PDF_TEMPLATE_DEFS: MessageTemplateDef[] = [
  label(
    "iriss.pdf.offer.hero_sub",
    "PDF piedāvājums",
    "Virsraksta apakšrinda",
    "{{date}} · Auto pārbaude / piedāvājums",
    [{ key: "date", label: "Datums/laiks", sample: "2026-04-22 14:30", required: true }],
  ),
  label("iriss.pdf.shared.sec.client", "PDF kopīgi", "Sadaļa: klienta dati", "Klienta dati"),
  label("iriss.pdf.offer.sec.basic", "PDF piedāvājums", "Sadaļa: pamatinformācija", "Pamatinformācija"),
  label("iriss.pdf.offer.sec.eval_marks", "PDF piedāvājums", "Sadaļa: novērtējuma atzīmes", "Novērtējuma atzīmes"),
  label("iriss.pdf.offer.sec.special", "PDF piedāvājums", "Sadaļa: īpašas atzīmes", "Īpašas atzīmes"),
  label("iriss.pdf.offer.sec.visual", "PDF piedāvājums", "Sadaļa: vizuālais novērtējums", "Vizuālais novērtējums"),
  label(
    "iriss.pdf.offer.sec.visual_detail",
    "PDF piedāvājums",
    "Sadaļa: vizuālais apraksts",
    "Detalizēts apraksts (vizuālais)",
  ),
  label("iriss.pdf.offer.sec.technical", "PDF piedāvājums", "Sadaļa: tehniskais novērtējums", "Tehniskais novērtējums"),
  label(
    "iriss.pdf.offer.sec.technical_detail",
    "PDF piedāvājums",
    "Sadaļa: tehniskais apraksts",
    "Detalizēts apraksts (tehniskais)",
  ),
  label("iriss.pdf.offer.sec.summary", "PDF piedāvājums", "Sadaļa: kopsavilkums", "Kopsavilkums"),
  label("iriss.pdf.offer.sec.pricing", "PDF piedāvājums", "Sadaļa: cenas", "Cenas un piedāvājums"),
  label("iriss.pdf.offer.sec.photos", "PDF piedāvājums", "Sadaļa: fotogrāfijas", "Fotogrāfijas"),
  label("iriss.pdf.offer.kv.client", "PDF piedāvājums", "KV: klients", "Klients"),
  label("iriss.pdf.shared.kv.phone", "PDF kopīgi", "KV: tālrunis", "Tālrunis"),
  label("iriss.pdf.shared.kv.email", "PDF kopīgi", "KV: e-pasts", "E-pasts"),
  label("iriss.pdf.offer.tile.year", "PDF piedāvājums", "Lauks: gads", "Gads"),
  label("iriss.pdf.offer.tile.odometer", "PDF piedāvājums", "Lauks: nobraukums", "Nobraukums"),
  label("iriss.pdf.offer.tile.transmission", "PDF piedāvājums", "Lauks: transmisija", "Transmisija"),
  label("iriss.pdf.offer.tile.location", "PDF piedāvājums", "Lauks: atrašanās vieta", "Atrašanās vieta"),
  label(
    "iriss.pdf.offer.check.service_history",
    "PDF piedāvājums",
    "Atzīme: servisa vēsture",
    "Vēsture (pilna servisa vēsture)",
  ),
  label("iriss.pdf.offer.check.factory_paint", "PDF piedāvājums", "Atzīme: krāsojums", "Krāsojums (rūpnīcas krāsa)"),
  label("iriss.pdf.offer.check.no_rust", "PDF piedāvājums", "Atzīme: rūsa", "Rūsa (virsbūve bez rūsas)"),
  label("iriss.pdf.offer.check.second_wheels", "PDF piedāvājums", "Atzīme: riteņi", "Otrs riteņu komplekts"),
  label("iriss.pdf.offer.price.car", "PDF piedāvājums", "Cena: auto", "Automašīnas cena"),
  label("iriss.pdf.offer.price.delivery", "PDF piedāvājums", "Cena: piegāde", "Piegādes cena"),
  label("iriss.pdf.offer.price.commission", "PDF piedāvājums", "Cena: komisija", "Komisijas maksa"),
  label("iriss.pdf.offer.price.total", "PDF piedāvājums", "Cena: kopā", "Kopā"),
  label("iriss.pdf.offer.price.valid_days", "PDF piedāvājums", "Cena: derīgums", "Piedāvājums spēkā (dienas)"),
  label(
    "iriss.pdf.order.hero_sub",
    "PDF pasūtījums",
    "Virsraksta apakšrinda",
    "{{date}} · IRISS pasūtījums",
    [{ key: "date", label: "Datums/laiks", sample: "2026-04-22 14:30", required: true }],
  ),
  label("iriss.pdf.order.sec.vehicle", "PDF pasūtījums", "Sadaļa: specifikācija", "Transportlīdzekļa specifikācija"),
  label("iriss.pdf.order.sec.deal", "PDF pasūtījums", "Sadaļa: darījuma detaļas", "Darījuma detaļas"),
  label("iriss.pdf.order.sec.equipment", "PDF pasūtījums", "Sadaļa: aprīkojums", "Aprīkojums"),
  label("iriss.pdf.order.sec.notes", "PDF pasūtījums", "Sadaļa: piezīmes", "Piezīmes"),
  label("iriss.pdf.order.kv.first_name", "PDF pasūtījums", "KV: vārds", "Vārds"),
  label("iriss.pdf.order.kv.last_name", "PDF pasūtījums", "KV: uzvārds", "Uzvārds"),
  label("iriss.pdf.order.kv.order_date", "PDF pasūtījums", "KV: pasūtījuma datums", "Pasūtījuma datums"),
  label("iriss.pdf.order.equip.required", "PDF pasūtījums", "Aprīkojums: obligāts", "Obligātās prasības"),
  label("iriss.pdf.order.equip.desired", "PDF pasūtījums", "Aprīkojums: vēlams", "Vēlamās prasības"),
];

export const IRISS_PDF_TEMPLATE_IDS = IRISS_PDF_TEMPLATE_DEFS.map((d) => d.id);
