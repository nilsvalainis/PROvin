function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
import {
  outvinDealerServiceRowHasData,
  outvinEuropeanRowHasData,
  outvinUsCarfaxHasData,
  type OutvinDataBundle,
  type OutvinPdfSectionToggles,
} from "@/lib/outvin-data-bundle";
import { buildOutvinDealerReportPdfInnerHtml } from "@/lib/outvin-dealer-pdf-html";
import { outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";

function subhead(title: string): string {
  return `<p class="pdf-field-label pdf-field-label--row pdf-outvin-subhead"><span>${escapeHtml(title)}</span></p>`;
}

function plainBlock(text: string): string {
  const body = escapeHtml(text.trim()).replace(/\n/g, "<br/>");
  if (!body) return "";
  return `<div class="pdf-outvin-plain">${body}</div>`;
}

function dealerServiceTable(log: OutvinDataBundle["dealerServiceLog"]): string {
  const rows = log.filter(outvinDealerServiceRowHasData);
  if (rows.length === 0) return "";
  const tr = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.odometer)}</td><td>${escapeHtml(r.serviceNotes || r.country)}</td></tr>`,
    )
    .join("");
  return `<table class="mirror-table mirror-table--compact"><thead><tr><th>Datums</th><th>Nobraukums, km</th><th>Servisa veids / Piezīmes</th></tr></thead><tbody>${tr}</tbody></table>`;
}

function usCarfaxBlock(d: OutvinDataBundle["usCarfax"]): string {
  if (!outvinUsCarfaxHasData(d)) return "";
  const lines = [
    d.importDate ? `Importa datums: ${d.importDate}` : "",
    d.registeredDamage ? `Bojājumi / avārijas:\n${d.registeredDamage}` : "",
    d.auctionData ? `Izsoles dati:\n${d.auctionData}` : "",
    d.usOdometer ? `ASV odometrs: ${d.usOdometer}` : "",
    d.notes ? d.notes : "",
  ].filter(Boolean);
  return plainBlock(lines.join("\n\n"));
}

function europeanTable(rows: OutvinDataBundle["europeanRegisters"]): string {
  const data = rows.filter(outvinEuropeanRowHasData);
  if (data.length === 0) return "";
  const tr = data
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.country)}</td><td>${escapeHtml(r.registerType)}</td><td>${escapeHtml(r.details)}</td></tr>`,
    )
    .join("");
  return `<table class="mirror-table mirror-table--compact"><thead><tr><th>Datums</th><th>Valsts</th><th>Veids</th><th>Dati</th></tr></thead><tbody>${tr}</tbody></table>`;
}

export function buildOutvinBundlePdfInnerHtml(
  bundle: OutvinDataBundle | undefined | null,
  toggles?: OutvinPdfSectionToggles,
): string {
  if (!bundle) return "";
  const pdf = toggles ?? bundle.pdfSections;
  const parts: string[] = [];

  if (pdf.vehicleEquipment) {
    const dealerInner = buildOutvinDealerReportPdfInnerHtml(outvinBundleToDealerReport(bundle));
    if (dealerInner.trim()) parts.push(dealerInner);
  }

  if (pdf.dealerService) {
    const table = dealerServiceTable(bundle.dealerServiceLog);
    if (table) {
      parts.push(subhead("Dīlera servisa žurnāls"));
      parts.push(table);
    }
  }

  if (pdf.usCarfax) {
    const us = usCarfaxBlock(bundle.usCarfax);
    if (us) {
      parts.push(subhead("ASV vēsture un bojājumi"));
      parts.push(us);
    }
  }

  if (pdf.europeanRegisters) {
    const eu = europeanTable(bundle.europeanRegisters);
    if (eu) {
      parts.push(subhead("Eiropas reģistru dati"));
      parts.push(eu);
    }
  }

  return parts.join("\n");
}
