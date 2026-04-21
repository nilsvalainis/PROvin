import { IRISS_BRAND_ORANGE_HEX, IRISS_COMPANY_LINES } from "@/lib/iriss-brand";
import type { IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowIf(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `<tr><th>${esc(label)}</th><td>${esc(v)}</td></tr>`;
}

function wrapTable(rows: string): string {
  const r = rows.trim();
  if (!r) return "";
  return `<table class="grid">${r}</table>`;
}

function blockIf(title: string, inner: string): string {
  if (!inner.trim()) return "";
  return `<section class="blk"><h2 class="blk-title">${esc(title)}</h2>${inner}</section>`;
}

function parseMoney(value: string | undefined): number {
  const compact = (value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
  const n = Number.parseFloat(compact);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(".", ",");
}

/**
 * Drukas / „Saglabāt kā PDF” HTML — PROVIN līdzīgs bloku sadalījums, akcents #EF7D1A, SIA IRISS rekvizīti.
 * Tukši lauki netiek iekļauti.
 */
export function buildIrissPasutijumsPrintHtml(record: IrissPasutijumsRecord, generatedAtFormatted: string): string {
  const accent = IRISS_BRAND_ORANGE_HEX;
  const legal = IRISS_COMPANY_LINES.map((l) => `<p>${esc(l)}</p>`).join("");

  const clientRows =
    rowIf("Vārds", record.clientFirstName) +
    rowIf("Uzvārds", record.clientLastName) +
    rowIf("Tālrunis", record.phone) +
    rowIf("E-pasts", record.email) +
    rowIf("Pasūtījuma datums", record.orderDate);
  const clientTable = wrapTable(clientRows);

  const vehicleRows =
    rowIf("Marka / modelis", record.brandModel) +
    rowIf("Ražošanas gadi", record.productionYears) +
    rowIf("Kopējais budžets", record.totalBudget) +
    rowIf("Dzinēja tips", record.engineType) +
    rowIf("Ātrumkārba", record.transmission) +
    rowIf("Maks. nobraukums", record.maxMileage) +
    rowIf("Vēlamās krāsas", record.preferredColors) +
    rowIf("Nevēlamās krāsas", record.nonPreferredColors) +
    rowIf("Salona apdare", record.interiorFinish);
  const vehicleTable = wrapTable(vehicleRows);

  const req = record.equipmentRequired.trim();
  const des = record.equipmentDesired.trim();
  const equipBoxes: string[] = [];
  if (req) {
    equipBoxes.push(
      `<div class="box"><h3>Obligātās prasības</h3><pre>${esc(req)}</pre></div>`,
    );
  }
  if (des) {
    equipBoxes.push(
      `<div class="box"><h3>Vēlamās prasības</h3><pre>${esc(des)}</pre></div>`,
    );
  }
  const equip = equipBoxes.length ? `<div class="two">${equipBoxes.join("")}</div>` : "";

  const notes = record.notes.trim()
    ? `<pre class="notes">${esc(record.notes.trim())}</pre>`
    : "";

  const linkRows: string[] = [];
  const pushL = (label: string, v: string) => {
    const t = v.trim();
    if (t) linkRows.push(`${esc(label)}: ${esc(t)}`);
  };
  pushL("Mobile", record.listingLinkMobile);
  pushL("Autobid", record.listingLinkAutobid);
  pushL("Openline", record.listingLinkOpenline);
  pushL("Auto1", record.listingLinkAuto1);
  for (let i = 0; i < record.listingLinksOther.length; i++) {
    const t = record.listingLinksOther[i]?.trim();
    if (t) linkRows.push(`${esc(`Cits ${i + 1}`)}: ${esc(t)}`);
  }
  const linksInner = linkRows.length ? `<p class="meta">${linkRows.join("<br/>")}</p>` : "";

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
    .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 560px) { .gallery { grid-template-columns: 1fr; } }
    .photo { margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; }
    .photo img { display: block; width: 100%; height: auto; max-height: 220px; object-fit: cover; }
    footer.legal { margin-top: 22px; padding-top: 12px; border-top: 2px solid ${accent}; font-size: 9px; color: #4b5563; line-height: 1.5; }
    footer.legal p { margin: 0 0 4px; }
  `;

  const body = `<div class="doc">
    <header class="hero">
      <h1>PASŪTĪJUMS</h1>
      <p class="meta">${esc(generatedAtFormatted)}</p>
    </header>
    ${blockIf("Klienta dati", clientTable)}
    ${blockIf("Transportlīdzekļa specifikācija", vehicleTable)}
    ${blockIf("Aprīkojums", equip)}
    ${blockIf("Piezīmes", notes)}
    ${blockIf("Sludinājumu saites", linksInner)}
    <footer class="legal">${legal}</footer>
  </div>`;

  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>PASŪTĪJUMS</title><style>${css}</style></head><body>${body}</body></html>`;
}

export function buildIrissOfferPrintHtml(
  record: IrissPasutijumsRecord,
  offer: IrissOfferRecord,
  generatedAtFormatted: string,
): string {
  const accent = IRISS_BRAND_ORANGE_HEX;
  const legal = IRISS_COMPANY_LINES.map((l) => `<p>${esc(l)}</p>`).join("");

  const heroTitle =
    offer.brandModel.trim() || offer.title.trim() || "Piedāvājums";

  const clientName = `${record.clientFirstName} ${record.clientLastName}`.trim();
  const clientRows =
    (clientName ? rowIf("Klients", clientName) : "") +
    rowIf("Tālrunis", record.phone) +
    rowIf("E-pasts", record.email);
  const clientTable = wrapTable(clientRows);

  const firstRegistration = offer.firstRegistration?.trim() || offer.year.trim();
  const odometer = offer.odometerReading?.trim() || offer.mileage.trim();
  const offerRows =
    rowIf("Marka, modelis", offer.brandModel) +
    rowIf("Pirmā reģistrācija", firstRegistration) +
    rowIf("Odometra rādījums", odometer) +
    rowIf("Transmisija", offer.transmission) +
    rowIf("Atrašanās vieta", offer.location);
  const offerTable = wrapTable(offerRows);

  const checks = [
    offer.hasFullServiceHistory ? "☑ Pilna servisa vēsture" : "",
    offer.hasFactoryPaint ? "☑ Rūpnīcas krāsojums" : "",
    offer.hasNoRustBody ? "☑ Virsbūve bez rūsas" : "",
    offer.hasSecondWheelSet ? "☑ Otrs riteņu komplekts" : "",
  ].filter(Boolean);
  const visual = offer.visualAssessment?.trim() || "";
  const technical = offer.technicalAssessment?.trim() || "";
  const evalParts: string[] = [];
  if (checks.length > 0) {
    evalParts.push(`<p class="meta">${checks.map((x) => esc(x)).join("<br/>")}</p>`);
  }
  const evalBoxes: string[] = [];
  if (visual) evalBoxes.push(`<div class="box"><h3>Vizuālais novērtējums</h3><pre>${esc(visual)}</pre></div>`);
  if (technical) evalBoxes.push(`<div class="box"><h3>Tehniskais novērtējums</h3><pre>${esc(technical)}</pre></div>`);
  if (evalBoxes.length > 0) evalParts.push(`<div class="two">${evalBoxes.join("")}</div>`);
  const evalInner = evalParts.join("");

  const carPrice = offer.carPrice?.trim() || offer.priceGermany?.trim() || "";
  const deliveryPrice = offer.deliveryPrice?.trim() || "";
  const commissionFee = offer.commissionFee?.trim() || "";
  const totalValue = parseMoney(carPrice) + parseMoney(deliveryPrice) + parseMoney(commissionFee);
  const pricingRows =
    rowIf("Automašīnas cena", carPrice) +
    rowIf("Piegādes cena", deliveryPrice) +
    rowIf("Komisijas maksa", commissionFee) +
    rowIf("Kopā", totalValue > 0 ? fmtMoney(totalValue) : "") +
    rowIf("Piedāvājums spēkā (dienas)", offer.offerValidDays);
  const pricingTable = wrapTable(pricingRows);

  const imageAttachments = offer.attachments.filter(
    (a) => a.mimeType.startsWith("image/") && a.dataUrl.startsWith("data:image/"),
  );
  const otherAttachments = offer.attachments.filter(
    (a) => !a.mimeType.startsWith("image/") || !a.dataUrl.startsWith("data:image/"),
  );

  const gallery =
    imageAttachments.length > 0
      ? `<div class="gallery">${imageAttachments
          .map(
            (img) =>
              `<figure class="photo"><img src="${img.dataUrl}" alt=""/></figure>`,
          )
          .join("")}</div>`
      : "";

  const otherTable =
    otherAttachments.length > 0
      ? `<table class="grid">${otherAttachments
          .map((a, i) => `<tr><th>Fails ${i + 1}</th><td>${esc(a.name)}</td></tr>`)
          .join("")}</table>`
      : "";

  const filesInner = [gallery, otherTable].filter(Boolean).join("");

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
    pre { margin: 0; font-family: inherit; white-space: pre-wrap; word-break: break-word; }
    .notes { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; min-height: 60px; }
    .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 560px) { .gallery { grid-template-columns: 1fr; } }
    .photo { margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff; page-break-inside: avoid; }
    .photo img { display: block; width: 100%; height: auto; max-height: 220px; object-fit: cover; }
    footer.legal { margin-top: 22px; padding-top: 12px; border-top: 2px solid ${accent}; font-size: 9px; color: #4b5563; line-height: 1.5; }
    footer.legal p { margin: 0 0 4px; }
  `;

  const body = `<div class="doc">
    <header class="hero">
      <h1>${esc(heroTitle)}</h1>
      <p class="meta">${esc(generatedAtFormatted)}</p>
    </header>
    ${blockIf("Klienta dati", clientTable)}
    ${blockIf("Pamatinformācija", offerTable)}
    ${blockIf("Vispārējais novērtējums", evalInner)}
    ${blockIf("Cenas un piedāvājums", pricingTable)}
    ${blockIf("Fotogrāfijas", filesInner)}
    <footer class="legal">${legal}</footer>
  </div>`;

  return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><title>${esc(heroTitle)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
