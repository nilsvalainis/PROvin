import { IRISS_BRAND_ORANGE_HEX, IRISS_COMPANY_LINES } from "@/lib/iriss-brand";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  const v = value.trim();
  return `<tr><th>${esc(label)}</th><td>${esc(v || "—")}</td></tr>`;
}

function block(title: string, inner: string): string {
  return `<section class="blk"><h2 class="blk-title">${esc(title)}</h2>${inner}</section>`;
}

/**
 * Drukas / „Saglabāt kā PDF” HTML — PROVIN līdzīgs bloku sadalījums, akcents #EF7D1A, SIA IRISS rekvizīti.
 */
export function buildIrissPasutijumsPrintHtml(record: IrissPasutijumsRecord, generatedAtFormatted: string): string {
  const accent = IRISS_BRAND_ORANGE_HEX;
  const legal = IRISS_COMPANY_LINES.map((l) => `<p>${esc(l)}</p>`).join("");

  const clientTable = `<table class="grid">${row(
    "Vārds",
    record.clientFirstName,
  )}${row("Uzvārds", record.clientLastName)}${row("Tālrunis", record.phone)}${row("E-pasts", record.email)}${row(
    "Pasūtījuma datums",
    record.orderDate,
  )}</table>`;

  const vehicleTable = `<table class="grid">${row("Marka / modelis", record.brandModel)}${row(
    "Ražošanas gadi",
    record.productionYears,
  )}${row("Kopējais budžets", record.totalBudget)}${row("Dzinēja tips", record.engineType)}${row(
    "Ātrumkārba",
    record.transmission,
  )}${row("Maks. nobraukums", record.maxMileage)}${row("Vēlamās krāsas", record.preferredColors)}${row(
    "Nevēlamās krāsas",
    record.nonPreferredColors,
  )}${row("Salona apdare", record.interiorFinish)}</table>`;

  const equip = `<div class="two"><div class="box"><h3>Obligātās prasības</h3><pre>${esc(
    record.equipmentRequired.trim() || "—",
  )}</pre></div><div class="box"><h3>Vēlamās prasības</h3><pre>${esc(
    record.equipmentDesired.trim() || "—",
  )}</pre></div></div>`;

  const notes = `<pre class="notes">${esc(record.notes.trim() || "—")}</pre>`;

  const css = `
    @page { margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #1d1d1f; font-size: 11px; line-height: 1.45; margin: 0; padding: 12px 14px 24px; }
    .doc { max-width: 720px; margin: 0 auto; }
    .hero { border-bottom: 3px solid ${accent}; padding-bottom: 10px; margin-bottom: 14px; }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.06em; margin: 0 0 4px; color: ${accent}; text-transform: uppercase; }
    .meta { color: #6b7280; font-size: 10px; margin: 0; }
    .blk { margin-bottom: 16px; page-break-inside: avoid; }
    .blk-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: ${accent}; border-left: 4px solid ${accent}; padding: 4px 0 4px 10px; margin: 0 0 8px; background: rgba(239,125,26,0.06); }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th { text-align: left; width: 32%; padding: 6px 8px; vertical-align: top; color: #4b5563;
      font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e5e7eb; }
    table.grid td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; white-space: pre-wrap; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 520px) { .two { grid-template-columns: 1fr; } }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
    .box h3 { margin: 0 0 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${accent}; }
    pre { margin: 0; font-family: inherit; white-space: pre-wrap; word-break: break-word; }
    .notes { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; min-height: 60px; }
    footer.legal { margin-top: 22px; padding-top: 12px; border-top: 2px solid ${accent}; font-size: 9px; color: #4b5563; line-height: 1.5; }
    footer.legal p { margin: 0 0 4px; }
  `;

  const body = `<div class="doc">
    <header class="hero">
      <h1>PASŪTĪJUMS</h1>
      <p class="meta">Ģenerēts: ${esc(generatedAtFormatted)} · ID: ${esc(record.id)}</p>
    </header>
    ${block("Klienta dati", clientTable)}
    ${block("Transportlīdzekļa specifikācija", vehicleTable)}
    ${block("Aprīkojums", equip)}
    ${block("Piezīmes", notes)}
    <footer class="legal">${legal}</footer>
  </div>`;

  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>PASŪTĪJUMS</title><style>${css}</style></head><body>${body}</body></html>`;
}
