/**
 * PDF 1. posms — admin paneļa secības uzmetums + PROVIN vizuālais ietvars.
 * (Pilna avotu sadale pa atsevišķiem blokiem — turpmākajos soļos.)
 */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  <text x="110" y="32" text-anchor="middle" font-family="Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="19" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">PROVIN<tspan fill="#6eb6ff">.LV</tspan></text>
</svg>`;
}

export function pdfLayoutDraftExtraCss(): string {
  return `
      .pdf-v1-hero{
        margin:-14mm -12mm 22px -12mm;padding:20px 22px 22px;
        background:linear-gradient(135deg,#0a1628 0%,#122a4a 48%,#0a1628 100%);
        border-radius:16px 16px 0 0;border-bottom:3px solid #0066d6;
      }
      @media print{
        .pdf-v1-hero{margin:-10mm -12mm 18px;border-radius:0}
        .pdf-v1-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
      .pdf-v1-hero-inner{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
      .pdf-v1-logo{width:200px;max-width:42vw;height:auto;flex-shrink:0;display:block}
      .pdf-v1-hero-text{flex:1;min-width:160px}
      .pdf-v1-doc-title{margin:0;font-size:1.32rem;font-weight:700;color:#fff;letter-spacing:-0.03em;line-height:1.2;text-transform:none}
      .pdf-v1-meta{margin:8px 0 0;font-size:0.84rem;color:#b9d4f0;line-height:1.45}
      .pdf-v1-meta code{background:rgba(255,255,255,.14);padding:3px 10px;border-radius:8px;color:#fff;font-size:0.9em}
      .pdf-v1-panel{
        margin:16px 0 0;padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;
        background:linear-gradient(180deg,#fafbfc 0%,#ffffff 100%);border-left:4px solid #0066d6;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-v1-panel-title{
        margin:0 0 12px;font-size:0.72rem;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:#0066d6;
      }
      .pdf-v1-kv{width:100%;border-collapse:collapse;font-size:0.86rem}
      .pdf-v1-kv td{padding:8px 10px;border-bottom:1px solid #eef2f6;vertical-align:top}
      .pdf-v1-kv td:first-child{width:36%;color:#64748b;font-weight:600}
      .pdf-v1-kv tr:last-child td{border-bottom:none}
      .pdf-v1-kv a{color:#0066d6;word-break:break-all}
  `;
}

export function buildPdfAdminMirrorPaymentBlock(
  p: { created: number; paymentStatus: string; amountTotal: number | null; currency: string | null },
  money: string,
  dateFmt: Intl.DateTimeFormat,
): string {
  const rows: { k: string; v: string; html?: boolean }[] = [];
  if (money !== "—") rows.push({ k: "Summa", v: money });
  rows.push({ k: "Laiks", v: dateFmt.format(new Date(p.created * 1000)) });
  if (p.paymentStatus?.trim()) rows.push({ k: "Statuss", v: p.paymentStatus });
  if (rows.length === 0) return "";
  const body = rows
    .map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`)
    .join("");
  return `<div class="pdf-v1-panel" role="region"><p class="pdf-v1-panel-title">Maksājums</p><table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorVehicleBlock(
  p: { vin: string | null; listingUrl: string | null },
  makeModel: string | null,
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
  return `<div class="pdf-v1-panel" role="region"><p class="pdf-v1-panel-title">Transportlīdzeklis un sludinājums</p><table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorClientBlock(p: {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  contactMethod: string | null;
}): string {
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
  return `<div class="pdf-v1-panel" role="region"><p class="pdf-v1-panel-title">Klienta kontaktdati</p><table class="pdf-v1-kv"><tbody>${body}</tbody></table></div>`;
}

export function buildPdfAdminMirrorNotesBlock(notes: string | null | undefined): string {
  const t = notes?.trim();
  if (!t) return "";
  return `<div class="pdf-v1-panel" role="region"><p class="pdf-v1-panel-title">Komentārs no klienta formas</p><p class="client-msg" style="margin:0">${esc(t)}</p></div>`;
}
