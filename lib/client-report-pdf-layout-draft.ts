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

function pdfV1PanelHead(title: string, titleIconHtml = ""): string {
  const icon =
    titleIconHtml.trim() !== ""
      ? `<span class="pdf-v1-ico" aria-hidden="true">${titleIconHtml}</span>`
      : "";
  return `<div class="pdf-v1-panel-head">${icon}<p class="pdf-v1-panel-title">${esc(title)}</p></div>`;
}

/** Vektora zīmols — drukai / PDF (tumši zils fons, balts teksts, akcenta .LV). */
export function provincLogoSvg(): string {
  return `<svg class="pdf-v1-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 48" role="img" aria-label="PROVIN.LV">
  <defs>
    <linearGradient id="pdfV1LogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628"/>
      <stop offset="55%" style="stop-color:#0f2847"/>
      <stop offset="100%" style="stop-color:#0a1628"/>
    </linearGradient>
  </defs>
  <rect width="220" height="48" rx="12" fill="url(#pdfV1LogoBg)"/>
  <text x="110" y="32" text-anchor="middle" font-family="Inter,sans-serif" font-size="19" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">PROVIN<tspan fill="#6eb6ff">.LV</tspan></text>
</svg>`;
}

export function pdfLayoutDraftExtraCss(): string {
  return `
      .pdf-v1-hero{
        margin:-10mm -12mm 14px -12mm;padding:14px 16px 16px;
        background:#0a1628;
        border-radius:0 0 0 0;border-bottom:2px solid #0066d6;
      }
      @media print{
        .pdf-v1-hero{margin:-8mm -12mm 12px;border-bottom:2px solid #0066d6}
        .pdf-v1-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
      .pdf-v1-hero-inner{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .pdf-v1-logo{width:176px;max-width:40vw;height:auto;flex-shrink:0;display:block}
      .pdf-v1-hero-text{flex:1;min-width:160px}
      .pdf-v1-doc-title{margin:0;font-size:1.05rem;font-weight:600;color:#fff;letter-spacing:-0.02em;line-height:1.25;text-transform:lowercase}
      .pdf-v1-meta{margin:6px 0 0;font-size:0.72rem;color:#b9d4f0;line-height:1.4}
      .pdf-v1-meta code{background:rgba(255,255,255,.12);padding:2px 8px;border-radius:6px;color:#fff;font-size:0.9em}
      .pdf-v1-panel.pdf-v1-panel--clean{
        margin:8px 0 0;padding:8px 0 10px;border:none;border-radius:0;
        background:transparent;border-bottom:1px solid #ececee;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-v1-panel--clean:last-child{border-bottom:none}
      .pdf-v1-panel-head{display:flex;align-items:center;gap:8px;margin:0 0 6px;flex-wrap:wrap}
      .pdf-v1-ico{display:inline-flex;align-items:center;justify-content:center;color:#0066d6;flex-shrink:0}
      .pdf-v1-ico .pdf-ico{width:14px;height:14px}
      .pdf-v1-panel-title{
        margin:0;font-size:0.68rem;font-weight:700;letter-spacing:0.04em;text-transform:lowercase;color:#0066d6;
      }
      .pdf-v1-panel-title--src{text-transform:none;letter-spacing:0.02em;font-size:0.72rem;color:#1d1d1f}
      .pdf-v1-kv{width:100%;border-collapse:collapse;font-size:0.74rem}
      .pdf-v1-kv td{padding:4px 0 5px;border-bottom:1px solid #ececee;vertical-align:top}
      .pdf-v1-kv td:first-child{width:36%;color:#86868b;font-weight:500}
      .pdf-v1-kv tr:last-child td{border-bottom:none}
      .pdf-v1-kv a{color:#0066d6;word-break:break-all}
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
  return `<div class="pdf-v1-panel pdf-v1-panel--clean" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorVehicleBlock(
  p: { vin: string | null; listingUrl: string | null },
  makeModel: string | null,
  titleIconHtml = "",
): string {
  const rows: { k: string; v: string }[] = [];
  const vin = p.vin?.trim();
  if (vin) rows.push({ k: "VIN", v: vin });
  const url = p.listingUrl?.trim();
  if (url) rows.push({ k: "Sludinājuma saite", v: url });
  const mm = makeModel?.trim();
  if (mm) rows.push({ k: "Marka / modelis (no datiem)", v: mm });
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => {
      if (r.k === "Sludinājuma saite") {
        return `<tr><td>${esc(r.k)}</td><td><a href="${esc(r.v)}">${esc(r.v)}</a></td></tr>`;
      }
      if (r.k === "VIN") {
        return `<tr><td>${esc(r.k)}</td><td><code>${esc(r.v)}</code></td></tr>`;
      }
      return `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`;
    })
    .join("");
  const head = pdfV1PanelHead("transportlīdzeklis un sludinājums", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
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
  const cm = p.contactMethod?.trim();
  if (cm) rows.push({ k: "Vēlamā saziņa", v: cm });
  if (rows.length === 0) return "";
  const body = rows.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("");
  const head = pdfV1PanelHead("klienta kontaktdati", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean" role="region">${head}<table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorNotesBlock(notes: string | null | undefined, titleIconHtml = ""): string {
  const t = notes?.trim();
  if (!t) return "";
  const head = pdfV1PanelHead("komentārs no klienta formas", titleIconHtml);
  return `<div class="pdf-v1-panel pdf-v1-panel--clean" role="region">${head}<p class="client-msg pdf-v1-notes-body" style="margin:0">${esc(t)}</p></div>`;
}
