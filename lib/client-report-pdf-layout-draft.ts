/**
 * PDF — PROVIN „clean & compact” paneļu izkārtojums (Inter, gaišas līnijas, zīmola akcenti).
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mājaslapas / PDF zīmola zils — sakrīt ar `globals.css` `--color-provin-accent` un `PROVIN_SECTION_ICON_HEX`. */
export const PDF_BRAND_BLUE_HEX = "#0061D2";

/** HTML: „PROVIN” bez .lv — PRO melns, VIN zils. */
export function pdfProvinWordmarkHtml(): string {
  return `<span class="pdf-provin-wordmark"><span class="pdf-provin-wordmark-pro">PRO</span><span class="pdf-provin-wordmark-vin">VIN</span></span>`;
}

/** HTML: „PROVIN.LV” — PRO un .LV melni, VIN zils. */
export function pdfProvinLvWordmarkHtml(): string {
  return `<span class="pdf-provin-wordmark"><span class="pdf-provin-wordmark-pro">PRO</span><span class="pdf-provin-wordmark-vin">VIN</span><span class="pdf-provin-wordmark-pro">.LV</span></span>`;
}

function pdfV1PanelHead(title: string, titleIconHtml = ""): string {
  const icon =
    titleIconHtml.trim() !== ""
      ? `<span class="pdf-sec-ico-wrap pdf-v1-panel-ico-wrap" aria-hidden="true">${titleIconHtml}</span>`
      : "";
  return `<div class="pdf-v1-panel-head">${icon}<p class="pdf-v1-panel-title">${esc(title)}</p></div>`;
}

/** Vārda zīme PDF galvenē — tumšs teksts uz baltas lapas, bez krāsaina logo fona. */
export function provincLogoSvg(): string {
  return `<svg class="pdf-v1-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 48" role="img" aria-label="PROVIN.LV">
  <text font-family="Inter, sans-serif" font-size="28" font-weight="800" letter-spacing="-0.02em">
    <tspan x="0" y="34" fill="#000000">PRO</tspan><tspan fill="${PDF_BRAND_BLUE_HEX}">VIN</tspan><tspan fill="#000000">.LV</tspan>
  </text>
</svg>`;
}

export function pdfLayoutDraftExtraCss(): string {
  return `
      .pdf-v1-hero{
        margin:0 0 12px;padding:0;
        background:#fff;
        border:0;
      }
      @media print{.pdf-v1-hero{margin:0 0 10px}}
      .pdf-v1-hero-inner{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .pdf-v1-logo{width:220px;max-width:46vw;height:auto;flex-shrink:0;display:block}
      .pdf-v1-hero-text{flex:1;min-width:160px}
      .pdf-v1-doc-title{margin:0;font-size:0.75rem;font-weight:700;color:#000;letter-spacing:0.06em;line-height:1.3;text-transform:uppercase}
      .pdf-v1-meta{margin:6px 0 0;font-size:0.576rem;color:#6e6e73;line-height:1.4}
      .pdf-v1-meta .pdf-vin{
        background:transparent;padding:0;color:#424245;font-size:0.9em;
        font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;
      }
      .pdf-surface-card{
        margin:0 0 14px;padding:12px 14px;border:1px solid #f1f5f9;border-radius:8px;
        background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.05);
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-v1-panel.pdf-v1-panel--clean{
        margin:0 0 14px;padding:12px 14px;border:1px solid #f1f5f9;border-radius:8px;
        background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.05);
      }
      .pdf-v1-panel-head{
        display:flex;align-items:center;gap:10px;margin:0 0 8px;flex-wrap:wrap;
        padding:0 0 0 10px;border-left:2px solid ${PDF_BRAND_BLUE_HEX};
      }
      .pdf-v1-panel-ico-wrap{flex-shrink:0}
      .pdf-v1-panel-ico-wrap .pdf-ico{width:16px;height:16px}
      .pdf-v1-notes-client-wrap{
        margin:0;padding:10px 12px;border-radius:8px;border:1px solid #f1f5f9;background:#fafafa;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-v1-notes-body{font-style:italic;color:#000;line-height:1.45}
      .pdf-v1-panel-title{
        margin:0;font-size:0.75rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000;
      }
      .pdf-v1-panel-title--src{letter-spacing:0.04em;font-size:0.75rem;color:#000}
      .pdf-v1-kv{width:100%;border-collapse:collapse;font-size:0.74rem}
      .pdf-v1-kv td{padding:6px 0 6px;border-bottom:1px solid #f1f5f9;vertical-align:top}
      .pdf-v1-kv td:first-child{width:36%;color:#86868b;font-weight:500}
      .pdf-v1-kv tr:last-child td{border-bottom:none}
      .pdf-provin-wordmark{font-weight:inherit;letter-spacing:inherit;white-space:nowrap}
      .pdf-provin-wordmark-pro{color:#000}
      .pdf-provin-wordmark-vin{color:${PDF_BRAND_BLUE_HEX}}
      .pdf-v1-kv a{color:${PDF_BRAND_BLUE_HEX};word-break:break-all}
      .pdf-v1-listing-link{color:${PDF_BRAND_BLUE_HEX};word-break:break-all;text-decoration:underline}
      .pdf-v1-kv .pdf-vin{font-family:Inter,sans-serif!important;font-variant-numeric:normal!important;}
      .pdf-source-mirror-panel{margin-top:0}
      .pdf-source-mirror-panel + .pdf-source-mirror-panel{margin-top:4px;padding-top:6px;border-top:1px solid #f0f0f2}
  `;
}

export function buildPdfAdminMirrorPaymentBlock(
  p: { created: number; paymentStatus: string; amountTotal: number | null; currency: string | null },
  money: string,
  dateFmt: Intl.DateTimeFormat,
  titleIconHtml = "",
): string {
  const rows: { k: string; v: string; html?: boolean }[] = [];
  if (money !== "—") rows.push({ k: "Summa", v: money });
  rows.push({ k: "Laiks", v: dateFmt.format(new Date(p.created * 1000)) });
  if (p.paymentStatus?.trim()) rows.push({ k: "Statuss", v: p.paymentStatus });
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`)
    .join("");
  const head = pdfV1PanelHead("maksājums", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorVehicleBlock(
  p: { vin: string | null; listingUrl: string | null },
  makeModel: string | null,
  titleIconHtml = "",
): string {
  const rows: { k: string; v: string; isLink?: boolean }[] = [];
  const vin = p.vin?.trim();
  if (vin) rows.push({ k: "VIN", v: vin });
  const url = p.listingUrl?.trim();
  if (url) rows.push({ k: "Sludinājuma saite", v: url, isLink: true });
  const mm = makeModel?.trim();
  if (mm) rows.push({ k: "Marka / modelis (no datiem)", v: mm });
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => {
      if (r.k === "VIN") {
        return `<tr><td>${esc(r.k)}</td><td><span class="pdf-vin">${esc(r.v)}</span></td></tr>`;
      }
      if (r.isLink) {
        const u = esc(r.v);
        return `<tr><td>${esc(r.k)}</td><td><a href="${u}" class="pdf-v1-listing-link">${u}</a></td></tr>`;
      }
      return `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`;
    })
    .join("");
  const head = pdfV1PanelHead("transportlīdzeklis un sludinājums", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorClientBlock(
  p: {
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    contactMethod: string | null;
  },
  titleIconHtml = "",
): string {
  const rows: { k: string; v: string }[] = [];
  const name = p.customerName?.trim();
  if (name) rows.push({ k: "Vārds, uzvārds", v: name });
  const em = p.customerEmail?.trim();
  if (em) rows.push({ k: "E-pasts", v: em });
  const ph = p.customerPhone?.trim();
  if (ph) rows.push({ k: "Tālrunis", v: ph });
  if (rows.length === 0) return "";
  const body = rows.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("");
  const head = pdfV1PanelHead("klienta dati", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorNotesBlock(notes: string | null | undefined, titleIconHtml = ""): string {
  const t = notes?.trim();
  if (!t) return "";
  const head = pdfV1PanelHead("klienta komentārs", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean pdf-surface-card" role="region">${head}<div class="pdf-v1-notes-client-wrap"><p class="client-msg pdf-v1-notes-body" style="margin:0">${esc(t)}</p></div></div>`;
}
