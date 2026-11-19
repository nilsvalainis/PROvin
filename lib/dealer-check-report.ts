/**
 * Dīlera datu pārbaudes servera PDF HTML: tā pati dīlera-only atskaite kā klienta pasūtījumā
 * (`buildClientReportDocumentHtml`, `pdfReportKind: "dealer"`). Šablons «Dzintarzeme Auto» -
 * DZA logo galvenē (PROVIN nedrīkst būt DZA materiālos); «Cits» - standarta galvene.
 */
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { DEALER_ONLY_PDF_VISIBILITY } from "@/lib/pdf-visibility";
import { buildProvinDilerisPdfFilename } from "@/lib/audit-report-pdf-filename";
import { dealerCheckAutoRecords, dealerCheckOneautoBlock } from "@/lib/dealer-check-delivery";
import type { DealerCheckRecord, DealerCheckTemplateId } from "@/lib/dealer-check";

export function buildDealerCheckReportPayload(record: DealerCheckRecord): ClientReportPayload {
  const csddForm = emptyCsddFields();
  csddForm.makeModel = [record.vehicle.make, record.vehicle.model].filter(Boolean).join(" ");
  return {
    sessionId: record.id,
    isDemo: false,
    vin: record.vin || null,
    created: Math.floor(Date.parse(record.createdAt || record.fetchedAt || "") / 1000) || Math.floor(Date.now() / 1000),
    amountTotal: null,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    csddForm,
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    autoRecordsBlock: dealerCheckAutoRecords(record),
    oneautoBlock: dealerCheckOneautoBlock(record),
    ccVinBlock: null,
    asvBlock: null,
    citiAvoti: null,
    listingAnalysis: null,
    pdfVisibility: DEALER_ONLY_PDF_VISIBILITY,
    pdfReportKind: "dealer",
    checkoutLine: "dealer",
    pdfBannerInclude: {},
    manualBanners: [],
    internalComment: "",
    mileageComment: "",
    incidentPhotoGroups: [],
    incidentPhotos: [],
    dealerMajorWorkOverrides: record.dealerMajorWorkOverrides ?? [],
  };
}

/**
 * Šablons «Dzintarzeme Auto»: PROVIN zīmols nedrīkst būt DZA materiālos. DZA logo galvenē un kājenē,
 * lapas galvenes teksts bez PROVIN.LV, PROVIN atruna/konfidencialitāte izņemta.
 */
export function applyDealerCheckBrandHeader(
  html: string,
  template: DealerCheckTemplateId,
  dzaLogoDataUrl: string,
): string {
  if (template !== "dzintarzeme") return html;
  const img = (cls: string) =>
    dzaLogoDataUrl
      ? `<img class="${cls}" src="${dzaLogoDataUrl}" alt="Dzintarzeme Auto" style="width:170px;height:auto">`
      : `<p class="${cls}" style="font:800 18px Inter,sans-serif;margin:0">Dzintarzeme Auto</p>`;
  return html
    .replace(/<svg class="(pdf-v1-logo[^"]*)"[^>]*aria-label="PROVIN(?:\.LV)?"[\s\S]*?<\/svg>/g, (_m, cls: string) => img(cls))
    .replace(/<div class="pdf-doc-footer__legal">[\s\S]*?<\/div>\s*<\/div>\s*(?=<\/footer>)/g, "")
    .replace(/content:"PROVIN(?:\.LV)? · /g, 'content:"DZINTARZEME AUTO · ')
    .replace(/PROVIN datubāzēs/g, "datubāzēs")
    .replace(/PROVIN\.LV|PROVIN/g, "Dzintarzeme Auto");
}

export function buildDealerCheckReportHtml(
  record: DealerCheckRecord,
  opts: { dzaLogoDataUrl?: string; now?: Date } = {},
): string {
  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const html = buildClientReportDocumentHtml({
    payload: buildDealerCheckReportPayload(record),
    portfolio: [],
    pdfInsights: [],
    dateFmt,
    formatBytes: (n) => `${Math.round(n / 1024)} KB`,
    lang: "lv",
  });
  return applyDealerCheckBrandHeader(html, record.template, opts.dzaLogoDataUrl ?? "");
}

export function dealerCheckReportFilename(record: DealerCheckRecord): string {
  const base = buildProvinDilerisPdfFilename(record.vin);
  return record.template === "dzintarzeme" ? base.replace(/\.pdf$/i, "_DZA.pdf") : base;
}

/** E-pasta noklusējuma teksts (rediģējams pirms sūtīšanas). */
export function dealerCheckEmailDefaults(record: DealerCheckRecord): { subject: string; text: string } {
  const car = [record.vehicle.make, record.vehicle.model].filter(Boolean).join(" ");
  const label = [car, record.vin].filter(Boolean).join(" · ");
  return {
    subject: `Oficiālā dīlera dati - ${label || "auto"}`,
    text: [
      "Labdien!",
      "",
      `Pielikumā oficiālā dīlera servisa dati${label ? ` (${label})` : ""}.`,
      "",
      "Ar cieņu",
    ].join("\n"),
  };
}
