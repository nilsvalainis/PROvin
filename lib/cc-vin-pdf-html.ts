/**
 * Starptautiskās vēstures sadaļa klienta PDF.
 *
 * Rāda tikai to, kas maina pircēja lēmumu: sarkanos karogus, bojājumus, norakstīšanas un
 * īpašumtiesību ierakstus, pārdošanas vēsturi. Specifikācijas un „nav ierakstu” pārbaudes
 * netiek drukātas — tās jau ir citās sadaļās vai nesniedz informāciju.
 */

import {
  CC_VIN_SUBTITLES,
  ccVinAlertChecks,
  ccVinDamageRowHasData,
  ccVinRecordRowHasData,
  ccVinSaleRowHasData,
  ccVinTitleRowHasData,
  type CcVinBlockState,
  type CcVinRecordRow,
} from "@/lib/cc-vin-report";

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

function td(v: string): string {
  return `<td>${escapeHtml(v.trim() || "—")}</td>`;
}

/** Kolonnas bez neviena datu lauka netiek drukātas — sadaļa nepiepildās ar „—”. */
function logTable(headings: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const keep = headings.map((_, i) => rows.some((cells) => (cells[i] ?? "").trim().length > 0));
  if (!keep.some(Boolean)) return "";
  const head = headings
    .filter((_, i) => keep[i])
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("");
  const body = rows
    .map((cells) => `<tr>${cells.filter((_, i) => keep[i]).map(td).join("")}</tr>`)
    .join("");
  return `<table class="pdf-v1-kv pdf-v1-kv--outvin-log"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** „49890” → „49 890”; teksts, kas nav skaitlis, paliek nemainīts. */
function kmDisplay(raw: string): string {
  const t = raw.trim();
  const digits = t.replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d+$/.test(digits)) return t;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Sarkanie karogi — tikai reģistri ar atzīmi; „tīrie” netiek uzskaitīti. */
function alertList(b: CcVinBlockState): string {
  const alerts = ccVinAlertChecks(b);
  if (alerts.length === 0) return "";
  const items = alerts
    .map(
      (c) =>
        `<li class="pdf-ccvin-flag"><span class="pdf-ccvin-flag-dot" aria-hidden="true"></span><span class="pdf-ccvin-flag-label">${escapeHtml(
          c.label.trim(),
        )}</span><span class="pdf-ccvin-flag-value">${escapeHtml(c.status.trim() || "atrasts ieraksts")}</span></li>`,
    )
    .join("");
  return `<ul class="pdf-ccvin-flags">${items}</ul>`;
}

function recordTable(rows: CcVinRecordRow[], labelHead: string): string {
  const data = rows.filter(ccVinRecordRowHasData);
  return logTable([labelHead, "Datums", "Detaļas"], data.map((r) => [r.label, r.date, r.detail]));
}

/** Kopsavilkuma rinda zem karogiem: atzīmju skaits un īpašnieku maiņas. */
function factLine(b: CcVinBlockState): string {
  const facts: string[] = [];
  const marks = b.attentionMarks.trim();
  if (marks) facts.push(`Reģistros ar atzīmēm: <strong>${escapeHtml(marks)}</strong>`);
  const owners = b.ownersCount.trim();
  if (owners) facts.push(`Īpašnieki ārvalstīs: <strong>${escapeHtml(owners)}</strong>`);
  const date = b.reportDate.trim();
  if (date) facts.push(`Datu stāvoklis uz <strong>${escapeHtml(date)}</strong>`);
  if (facts.length === 0) return "";
  return `<p class="pdf-ccvin-facts">${facts.join(" · ")}</p>`;
}

/**
 * Sadaļas iekšpuse (bez virsraksta joslas un komentāra salas — tos pievieno izsaucējs,
 * lai noformējums sakristu ar pārējiem avotiem).
 */
export function buildCcVinPdfInnerHtml(b: CcVinBlockState | null | undefined): string {
  if (!b) return "";
  const parts: string[] = [];

  const flags = alertList(b);
  const facts = factLine(b);
  if (flags || facts) {
    parts.push(subhead(CC_VIN_SUBTITLES.flags));
    if (flags) parts.push(flags);
    if (facts) parts.push(facts);
  }

  const damages = (b.damages ?? []).filter(ccVinDamageRowHasData);
  if (damages.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.damages));
    parts.push(
      logTable(
        ["Datums", "Bojājums", "Summa", "Vieta"],
        damages.map((r) => [r.date, r.description, r.amount, r.region]),
      ),
    );
  }

  const brands = recordTable(b.brands ?? [], "Atzīme");
  if (brands) {
    parts.push(subhead(CC_VIN_SUBTITLES.brands));
    parts.push(brands);
  }

  const insurance = recordTable(b.insurance ?? [], "Reģistrs");
  if (insurance) {
    parts.push(subhead(CC_VIN_SUBTITLES.insurance));
    parts.push(insurance);
  }

  const titles = (b.titles ?? []).filter(ccVinTitleRowHasData);
  if (titles.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.titles));
    parts.push(
      logTable(
        ["Datums", "Reģions", "Odometrs, km", "Piezīme"],
        titles.map((r) => [r.date, r.region, kmDisplay(r.odometer), r.note]),
      ),
    );
  }

  const sales = (b.sales ?? []).filter(ccVinSaleRowHasData);
  if (sales.length > 0) {
    parts.push(subhead(CC_VIN_SUBTITLES.sales));
    parts.push(
      logTable(
        ["Datums", "Vieta", "Odometrs, km", "Cena", "Statuss"],
        sales.map((r) => [r.date, r.venue, kmDisplay(r.odometer), r.price, r.status]),
      ),
    );
  }

  return parts.join("\n");
}

/** Sadaļas CSS — mērogs un krāsas seko PDF dizaina marķieriem. */
export const CC_VIN_PDF_CSS = `
      .pdf-ccvin-flags{list-style:none;margin:0 0 8px;padding:0;display:block}
      .pdf-ccvin-flag{
        display:flex;align-items:baseline;gap:8px;padding:6px 0;
        border-bottom:1px solid var(--pdf-line-soft);font-size:var(--pdf-fs-table);
      }
      .pdf-ccvin-flag:last-child{border-bottom:none}
      .pdf-ccvin-flag-dot{
        width:7px;height:7px;border-radius:50%;background:#DC2626;flex:0 0 auto;
        -webkit-print-color-adjust:exact;print-color-adjust:exact;
      }
      .pdf-ccvin-flag-label{flex:1 1 auto;color:#0f172a;font-weight:600}
      .pdf-ccvin-flag-value{flex:0 0 auto;color:#B91C1C;font-weight:600;text-align:right}
      .pdf-ccvin-facts{margin:0 0 4px;font-size:var(--pdf-fs-label);color:#86868b;line-height:1.5}
`;
