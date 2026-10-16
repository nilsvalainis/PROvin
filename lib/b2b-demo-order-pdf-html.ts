import { B2B_DEMO_DEAL_DETAIL_OPTIONS, type B2bDemoOffer, type B2bDemoOrder, type B2bDemoSettings } from "@/lib/b2b-demo-types";
import { b2bDemoClientDisplayName } from "@/lib/b2b-demo-orders";
import {
  b2bDemoVatModeLabel,
  formatB2bDemoMoney,
  resolveB2bDemoOfferPricing,
  type B2bDemoOfferPricing,
} from "@/lib/b2b-demo-order-pricing";
import { assertSameTenant } from "@/lib/b2b-demo-isolation";

const ACCENT = "#F26522";
const INK = "#111827";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type B2bDemoPdfParty = {
  companyName: string;
  companyReg: string;
  vatNumber: string;
  bank: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  footerText: string;
  termsText: string;
  depositText: string;
};

export type B2bDemoPdfKv = { label: string; value: string };

export type B2bDemoOrderPdfModel = {
  tenantId: string;
  kind: "order" | "offer";
  title: string;
  generatedAt: string;
  party: B2bDemoPdfParty;
  client: B2bDemoPdfKv[];
  vehicle: B2bDemoPdfKv[];
  deal: string[];
  equipment: B2bDemoPdfKv[];
  notes: string;
  checks: { label: string; on: boolean }[];
  assessments: B2bDemoPdfKv[];
  pricing: B2bDemoOfferPricing | null;
};

function partyFromSettings(settings: B2bDemoSettings, tenantName: string): B2bDemoPdfParty {
  return {
    companyName: settings.companyName.trim() || tenantName.trim(),
    companyReg: settings.companyReg.trim(),
    vatNumber: settings.vatNumber.trim(),
    bank: settings.bank.trim(),
    address: settings.address.trim(),
    phone: settings.phone.trim(),
    email: settings.email.trim(),
    logoUrl: settings.logoUrl.trim(),
    footerText: settings.pdfFooterText.trim(),
    termsText: settings.pdfTermsText.trim(),
    depositText: settings.pdfDepositText.trim(),
  };
}

function kv(label: string, value: string): B2bDemoPdfKv | null {
  const v = value.trim();
  if (!v) return null;
  return { label, value: v };
}

function collect(rows: Array<B2bDemoPdfKv | null>): B2bDemoPdfKv[] {
  return rows.filter((row): row is B2bDemoPdfKv => Boolean(row));
}

export function buildB2bDemoOrderPdfModel(
  order: B2bDemoOrder,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): B2bDemoOrderPdfModel {
  assertSameTenant(order, settings.tenantId);
  const party = partyFromSettings(settings, opts.tenantName);
  return {
    tenantId: settings.tenantId,
    kind: "order",
    title: order.brandModel.trim() || "Pasūtījums",
    generatedAt: opts.generatedAt,
    party,
    client: collect([
      kv("Klients", b2bDemoClientDisplayName(order)),
      kv("Tālrunis", order.phone),
      kv("E-pasts", order.email),
      kv("Pasūtījuma datums", order.orderDate),
    ]),
    vehicle: collect([
      kv("Marka / modelis", order.brandModel),
      kv("VIN", order.vin),
      kv("Ražošanas gadi", order.productionYears),
      kv("Kopējais budžets", order.totalBudget),
      kv("Dzinēja tips", order.engineType),
      kv("Ātrumkārba", order.transmission),
      kv("Virsbūves tips", order.bodyType),
      kv("Piedziņas tips", order.driveType),
      kv("Sēdvietu skaits", order.seatCount),
      kv("Maks. nobraukums", order.maxMileage),
      kv("Vēlamās krāsas", order.preferredColors),
      kv("Nevēlamās krāsas", order.nonPreferredColors),
      kv("Salona apdare", order.interiorFinish),
    ]),
    deal: B2B_DEMO_DEAL_DETAIL_OPTIONS.filter((opt) => Boolean(order[opt.key])).map((opt) => opt.label),
    equipment: collect([
      kv("Obligātās prasības", order.equipmentRequired),
      kv("Vēlamās prasības", order.equipmentDesired),
    ]),
    notes: order.note.trim(),
    checks: [],
    assessments: [],
    pricing: null,
  };
}

export function buildB2bDemoOfferPdfModel(
  order: B2bDemoOrder,
  offer: B2bDemoOffer,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): B2bDemoOrderPdfModel {
  const base = buildB2bDemoOrderPdfModel(order, settings, opts);
  const pricing = resolveB2bDemoOfferPricing(order, offer, settings);
  return {
    ...base,
    kind: "offer",
    title: offer.brandModel.trim() || offer.title.trim() || "Piedāvājums",
    vehicle: collect([
      kv("Marka / modelis", offer.brandModel || order.brandModel),
      kv("VIN", offer.vin || order.vin),
      kv("Pirmā reģistrācija", offer.firstRegistration),
      kv("Nobraukums", offer.odometerReading),
      kv("Ātrumkārba", offer.transmission),
      kv("Atrašanās vieta", offer.location),
    ]),
    checks: [
      { label: "Pilna servisa vēsture", on: offer.hasFullServiceHistory },
      { label: "Rūpnīcas krāsojums", on: offer.hasFactoryPaint },
      { label: "Virsbūve bez rūsas", on: offer.hasNoRustBody },
      { label: "Otrs riteņu komplekts", on: offer.hasSecondWheelSet },
    ],
    assessments: collect([
      kv("Īpašas atzīmes", offer.specialNotes),
      kv("Vizuālais novērtējums", offer.visualAssessment),
      kv("Tehniskais novērtējums", offer.technicalAssessment),
      kv("Kopsavilkums", offer.summary),
    ]),
    pricing,
  };
}

function rowHtml(row: B2bDemoPdfKv): string {
  return `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`;
}

function tableHtml(rows: B2bDemoPdfKv[]): string {
  if (rows.length === 0) return "";
  return `<table class="kv">${rows.map(rowHtml).join("")}</table>`;
}

function blockHtml(title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

function partyFooterHtml(party: B2bDemoPdfParty): string {
  const lines = [
    party.companyName,
    party.companyReg ? `Reģ. nr.: ${party.companyReg}` : "",
    party.vatNumber ? `PVN: ${party.vatNumber}` : "",
    party.address,
    party.phone,
    party.email,
    party.bank,
    party.footerText,
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `<footer>${lines.map((line) => `<p>${esc(line)}</p>`).join("")}</footer>`;
}

function pricingHtml(pricing: B2bDemoOfferPricing): string {
  const rows = pricing.lines.map((line) => rowHtml({ label: line.label, value: formatB2bDemoMoney(line.amountEur) }));
  if (pricing.vatMode === "standard" && pricing.vatEur > 0) {
    rows.push(rowHtml({ label: b2bDemoVatModeLabel(pricing.vatMode), value: formatB2bDemoMoney(pricing.vatEur) }));
  } else if (pricing.vatMode === "margin") {
    rows.push(rowHtml({ label: b2bDemoVatModeLabel(pricing.vatMode), value: "iekļauts maržā" }));
  }
  if (pricing.totalEur > 0 || pricing.lines.length > 0) {
    rows.push(rowHtml({ label: "Kopā", value: formatB2bDemoMoney(pricing.totalEur) }));
  }
  return rows.length ? `<table class="kv">${rows.join("")}</table>` : "";
}

function headerHtml(model: B2bDemoOrderPdfModel): string {
  const logo = model.party.logoUrl
    ? `<img class="logo" src="${esc(model.party.logoUrl)}" alt="${esc(model.party.companyName)}"/>`
    : "";
  const brand = model.party.companyName ? `<p class="brand">${esc(model.party.companyName)}</p>` : "";
  return `<header>${logo}<div>${brand}<h1>${esc(model.title)}</h1><p class="sub">${esc(model.generatedAt)}</p></div></header>`;
}

export function renderB2bDemoPdfHtml(model: B2bDemoOrderPdfModel): string {
  const checks = model.checks.length
    ? `<ul class="checks">${model.checks
        .map((c) => `<li class="${c.on ? "on" : "off"}">${c.on ? "Jā" : "Nē"}: ${esc(c.label)}</li>`)
        .join("")}</ul>`
    : "";
  const body = [
    headerHtml(model),
    blockHtml("Klients", tableHtml(model.client)),
    blockHtml(model.kind === "offer" ? "Pamatinformācija" : "Auto", tableHtml(model.vehicle)),
    blockHtml("Darījuma detaļas", model.deal.map((d) => `<p>${esc(d)}</p>`).join("")),
    blockHtml("Aprīkojums", tableHtml(model.equipment)),
    blockHtml("Novērtējums", checks + tableHtml(model.assessments)),
    blockHtml("Cenas", model.pricing ? pricingHtml(model.pricing) : ""),
    blockHtml("Piezīmes", model.notes ? `<pre>${esc(model.notes)}</pre>` : ""),
    blockHtml("Noteikumi", model.party.termsText ? `<pre>${esc(model.party.termsText)}</pre>` : ""),
    blockHtml("Depozīts", model.party.depositText ? `<pre>${esc(model.party.depositText)}</pre>` : ""),
    partyFooterHtml(model.party),
  ].join("\n");
  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>${esc(model.title)}</title>
<style>
@page { size: A4; margin: 12mm; }
body { font-family: Inter, system-ui, sans-serif; color: ${INK}; font-size: 11pt; margin: 0; }
h1 { font-size: 1.35rem; margin: 0 0 4px; letter-spacing: 0.04em; text-transform: uppercase; }
h2 { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; margin: 18px 0 8px; color: ${ACCENT}; }
header { display: flex; gap: 16px; align-items: center; border-bottom: 1px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
.logo { max-height: 42px; max-width: 160px; }
.brand { margin: 0; font-weight: 700; }
.sub { margin: 0; font-size: 0.8rem; color: #334155; }
.kv { width: 100%; border-collapse: collapse; }
.kv th { text-align: left; width: 38%; padding: 4px 8px 4px 0; color: #475569; font-weight: 600; }
.kv td { padding: 4px 0; }
pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
.checks { list-style: none; padding: 0; }
.checks .on { font-weight: 600; }
footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 0.85rem; color: #334155; }
footer p { margin: 2px 0; }
</style></head><body>${body}</body></html>`;
}

export function buildB2bDemoOrderPrintHtml(
  order: B2bDemoOrder,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): string {
  return renderB2bDemoPdfHtml(buildB2bDemoOrderPdfModel(order, settings, opts));
}

export function buildB2bDemoOfferPrintHtml(
  order: B2bDemoOrder,
  offer: B2bDemoOffer,
  settings: B2bDemoSettings,
  opts: { tenantName: string; generatedAt: string },
): string {
  return renderB2bDemoPdfHtml(buildB2bDemoOfferPdfModel(order, offer, settings, opts));
}
