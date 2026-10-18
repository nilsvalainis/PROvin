import { translateClientReportStatic, type ClientReportLang } from "@/lib/client-report-i18n";
import { normalizeCountryName } from "@/lib/country-names-lv";
import {
  outvinDealerServiceRowHasData,
  outvinEuropeanRowHasData,
  outvinUsCarfaxHasData,
  type OutvinDataBundle,
  type OutvinPdfSectionToggles,
} from "@/lib/outvin-data-bundle";
import {
  buildOutvinDealerEquipmentPdfHtml,
  buildOutvinDealerReportPdfInnerHtml,
} from "@/lib/outvin-dealer-pdf-html";
import { outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subhead(title: string): string {
  return `<p class="pdf-subhead">${escapeHtml(title)}</p>`;
}

function plainBlock(text: string): string {
  const body = escapeHtml(text.trim()).replace(/\n/g, "<br/>");
  if (!body) return "";
  return `<div class="pdf-outvin-plain">${body}</div>`;
}

function dealerServiceTable(
  log: OutvinDataBundle["dealerServiceLog"],
  lang: ClientReportLang,
): string {
  const rows = log.filter(outvinDealerServiceRowHasData);
  if (rows.length === 0) return "";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const tr = rows
    .map((r) => {
      const note = r.serviceNotes.trim() || normalizeCountryName(r.country, lang) || r.country;
      return `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.odometer)}</td><td>${escapeHtml(note)}</td></tr>`;
    })
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log"><thead><tr><th>${escapeHtml(t("Datums"))}</th><th>${escapeHtml(t("Nobraukums, km"))}</th><th>${escapeHtml(t("Servisa veids / Piezīmes"))}</th></tr></thead><tbody>${tr}</tbody></table>`;
}

function usCarfaxBlock(d: OutvinDataBundle["usCarfax"], lang: ClientReportLang): string {
  if (!outvinUsCarfaxHasData(d)) return "";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const lines = [
    d.importDate ? `${t("Importa datums")}: ${d.importDate}` : "",
    d.registeredDamage ? `${t("Bojājumi / avārijas")}:\n${d.registeredDamage}` : "",
    d.auctionData ? `${t("Izsoles dati")}:\n${d.auctionData}` : "",
    d.usOdometer ? `${t("ASV odometrs")}: ${d.usOdometer}` : "",
    d.notes ? d.notes : "",
  ].filter(Boolean);
  return plainBlock(lines.join("\n\n"));
}

function europeanTable(
  rows: OutvinDataBundle["europeanRegisters"],
  lang: ClientReportLang,
): string {
  const data = rows.filter(outvinEuropeanRowHasData);
  if (data.length === 0) return "";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const tr = data
    .map((r) => {
      const country = normalizeCountryName(r.country, lang) || r.country;
      return `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(country)}</td><td>${escapeHtml(r.registerType)}</td><td>${escapeHtml(r.details)}</td></tr>`;
    })
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log"><thead><tr><th>${escapeHtml(t("Datums"))}</th><th>${escapeHtml(t("Valsts"))}</th><th>${escapeHtml(t("Veids"))}</th><th>${escapeHtml(t("Dati"))}</th></tr></thead><tbody>${tr}</tbody></table>`;
}

/** Aprīkojums no Outvin bundle (zem komentāra dīlera PDF). */
export function buildOutvinBundleEquipmentPdfHtml(
  bundle: OutvinDataBundle | undefined | null,
  toggles?: OutvinPdfSectionToggles,
  opts?: { lang?: ClientReportLang },
): string {
  if (!bundle) return "";
  const pdf = toggles ?? bundle.pdfSections;
  if (!pdf.vehicleEquipment) return "";
  return buildOutvinDealerEquipmentPdfHtml(outvinBundleToDealerReport(bundle), { lang: opts?.lang });
}

export function buildOutvinBundlePdfInnerHtml(
  bundle: OutvinDataBundle | undefined | null,
  toggles?: OutvinPdfSectionToggles,
  opts?: { omitEquipment?: boolean; maskDemoVin?: boolean; lang?: ClientReportLang },
): string {
  if (!bundle) return "";
  const pdf = toggles ?? bundle.pdfSections;
  const lang = opts?.lang ?? "lv";
  const t = (lv: string) => translateClientReportStatic(lv, lang);
  const parts: string[] = [];

  if (pdf.vehicleEquipment) {
    const dealerInner = buildOutvinDealerReportPdfInnerHtml(outvinBundleToDealerReport(bundle), {
      omitEquipment: opts?.omitEquipment === true,
      maskDemoVin: opts?.maskDemoVin === true,
      lang,
    });
    if (dealerInner.trim()) parts.push(dealerInner);
  }

  if (pdf.dealerService) {
    const table = dealerServiceTable(bundle.dealerServiceLog, lang);
    if (table) {
      parts.push(subhead(t("Dīlera servisa žurnāls")));
      parts.push(table);
    }
  }

  if (pdf.usCarfax) {
    const us = usCarfaxBlock(bundle.usCarfax, lang);
    if (us) {
      parts.push(subhead(t("ASV vēsture un bojājumi")));
      parts.push(us);
    }
  }

  if (pdf.europeanRegisters) {
    const eu = europeanTable(bundle.europeanRegisters, lang);
    if (eu) {
      parts.push(subhead(t("Eiropas reģistru dati")));
      parts.push(eu);
    }
  }

  return parts.join("\n");
}
