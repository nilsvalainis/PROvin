import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { formatMoneyEur } from "@/lib/format-money";
import { provincLogoSvg } from "@/lib/client-report-pdf-layout-draft";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Noklusējuma teksts — digitālais pakalpojums; var pārrakstīt ar env. */
export function getInvoiceLineDescription(): string {
  const v = process.env.NEXT_PUBLIC_INVOICE_LINE_DESCRIPTION?.trim();
  return v || "Auto vēstures analīze (digitālais pakalpojums)";
}

/** Atsauce uz PVN likuma 3. panta otrās daļas 1. punkta b) apakšpunktu (iekšzemes nereģistrēts nodokļa maksātājs). */
export function getInvoicePvnFooterText(): string {
  const v = process.env.NEXT_PUBLIC_INVOICE_PVN_DISCLAIMER?.trim();
  if (v) return v;
  return (
    "Pakalpojuma sniedzējs nav reģistrēts Valsts ieņēmumu dienesta pievienotās vērtības nodokļa maksātāju reģistrā. " +
    "Šajā rēķinā pievienotās vērtības nodoklis netiek piemērots atsevišķi (likme 0% / N/A). " +
    "Saskaņā ar Pievienotās vērtības nodokļa likuma 3. panta otrās daļas 1. punkta b) apakšpunktu pakalpojuma sniedzējs ir iekšzemes nereģistrēts nodokļa maksātājs."
  );
}

export type InvoiceOrderPayload = {
  id: string;
  created: number;
  amountTotal: number;
  currency: string | null;
  customerEmail: string | null;
  customerDetailsEmail: string | null;
  vin: string | null;
};

export function buildInvoiceHtml(order: InvoiceOrderPayload): string {
  const legal = getCompanyLegal();
  const brand = getCompanyPublicBrand();
  const lineDesc = getInvoiceLineDescription();
  const pvnFooter = getInvoicePvnFooterText();

  const money = formatMoneyEur(order.amountTotal, order.currency);
  const email = order.customerEmail ?? order.customerDetailsEmail ?? "—";
  const vin = order.vin?.trim() || "—";
  const invoiceNo = order.id;

  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const invoiceDate = dateFmt.format(new Date(order.created * 1000));

  const supplierLines = [
    legal.legalName || "—",
    legal.regNo ? `Reģ. Nr.: ${legal.regNo}` : null,
    legal.legalAddress || null,
  ].filter(Boolean) as string[];

  const css = `
    :root{
      --inv-accent:#0061d2;
      --inv-ink:#1d1d1f;
      --inv-muted:#86868b;
      --inv-line:#e8e8ed;
      --inv-soft:#f5f5f7;
    }
    *{box-sizing:border-box;}
    body{
      margin:0;
      padding:32px 28px 40px;
      font-family:Inter,system-ui,-apple-system,sans-serif;
      font-size:13px;
      line-height:1.45;
      color:var(--inv-ink);
      background:#fff;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .inv-wrap{max-width:720px;margin:0 auto;}
    /* ~30% augstāka galva un kopsavilkums salīdzinājumā ar „kompaktu” PDF rindkopu */
    .inv-hero{
      display:flex;
      flex-wrap:wrap;
      align-items:flex-end;
      justify-content:space-between;
      gap:20px;
      padding:26px 0 30px;
      border-bottom:2px solid var(--inv-accent);
      margin-bottom:28px;
    }
    .inv-hero .pdf-v1-logo{width:240px;max-width:min(240px,52vw);height:auto;display:block;}
    .inv-hero-right{text-align:right;min-width:200px;}
    .inv-doc-title{
      margin:0 0 6px;
      font-size:11px;
      font-weight:700;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:var(--inv-ink);
    }
    .inv-brand-sub{margin:0;font-size:13px;font-weight:600;color:var(--inv-accent);}
    .inv-meta{margin:10px 0 0;font-size:11px;color:var(--inv-muted);line-height:1.5;}
    .inv-meta strong{color:var(--inv-ink);font-weight:600;}
    .inv-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:20px 28px;
      margin-bottom:26px;
    }
    @media (max-width:560px){.inv-grid{grid-template-columns:1fr;}}
    .inv-panel{
      background:var(--inv-soft);
      border-radius:12px;
      padding:16px 18px;
      border:1px solid var(--inv-line);
    }
    .inv-panel h2{
      margin:0 0 12px;
      font-size:10px;
      font-weight:700;
      letter-spacing:.1em;
      text-transform:uppercase;
      color:var(--inv-muted);
    }
    .inv-panel p,.inv-panel address{
      margin:0;
      font-size:12px;
      line-height:1.5;
      font-style:normal;
      white-space:pre-wrap;
      word-break:break-word;
    }
    table.inv-table{
      width:100%;
      border-collapse:collapse;
      font-size:12px;
      margin-bottom:22px;
    }
    .inv-table th,.inv-table td{
      padding:12px 14px;
      text-align:left;
      border-bottom:1px solid var(--inv-line);
    }
    .inv-table th{
      font-size:10px;
      font-weight:700;
      letter-spacing:.06em;
      text-transform:uppercase;
      color:var(--inv-muted);
      background:#fafbfc;
    }
    .inv-table td.num,.inv-table th.num{text-align:right;font-variant-numeric:tabular-nums;}
    .inv-table tbody tr:last-child td{border-bottom:2px solid var(--inv-line);}
    .inv-vin{font-family:ui-monospace,Menlo,monospace;font-size:11px;}
    .inv-summary{
      margin-left:auto;
      max-width:340px;
      padding:26px 22px 30px;
      border-radius:14px;
      border:1px solid var(--inv-line);
      background:linear-gradient(180deg,#fff 0%,#fafbfc 100%);
      box-shadow:0 4px 20px rgba(15,23,42,.06);
    }
    .inv-summary-row{
      display:flex;
      justify-content:space-between;
      gap:16px;
      padding:10px 0;
      font-size:13px;
      border-bottom:1px solid var(--inv-line);
    }
    .inv-summary-row:last-child{border-bottom:none;padding-top:14px;}
    .inv-summary-row--emph{font-size:16px;font-weight:700;}
    .inv-summary-row--muted{font-size:11px;color:var(--inv-muted);}
    .inv-summary-label{color:var(--inv-muted);}
    .inv-summary-val{font-variant-numeric:tabular-nums;font-weight:600;}
    .inv-pvn-note{
      margin:12px 0 0;
      font-size:11px;
      color:var(--inv-muted);
      line-height:1.4;
    }
    .inv-foot{
      margin-top:32px;
      padding-top:22px;
      border-top:1px solid var(--inv-line);
    }
    .inv-foot-legal{
      font-size:9px;
      line-height:1.55;
      color:#6e6e73;
      max-width:640px;
    }
    @media print{
      body{padding:12mm 10mm;}
      .inv-summary{box-shadow:none;}
    }
  `;

  const supplierHtml = supplierLines.map((l) => `<p>${esc(l)}</p>`).join("");

  return `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Rēķins ${esc(invoiceNo)} — ${esc(brand)}</title>
<style>${css}</style>
</head>
<body>
<div class="inv-wrap">
  <header class="inv-hero">
    <div>${provincLogoSvg()}</div>
    <div class="inv-hero-right">
      <p class="inv-doc-title">Rēķins</p>
      <p class="inv-brand-sub">${esc(brand)}</p>
      <div class="inv-meta">
        <div><strong>Rēķina Nr.:</strong> ${esc(invoiceNo)}</div>
        <div><strong>Datums:</strong> ${esc(invoiceDate)}</div>
      </div>
    </div>
  </header>

  <div class="inv-grid">
    <section class="inv-panel" aria-labelledby="inv-seller">
      <h2 id="inv-seller">Pakalpojuma sniedzējs</h2>
      ${supplierHtml || `<p>—</p>`}
    </section>
    <section class="inv-panel" aria-labelledby="inv-buyer">
      <h2 id="inv-buyer">Klients</h2>
      <p><strong>E-pasts:</strong> ${esc(email)}</p>
      <p style="margin-top:8px"><strong>Transportlīdzekļa VIN:</strong><br/><span class="inv-vin">${esc(vin)}</span></p>
    </section>
  </div>

  <table class="inv-table" role="table">
    <thead>
      <tr>
        <th>Apraksts</th>
        <th class="num">Daudz.</th>
        <th class="num">Cena</th>
        <th class="num">Summa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(lineDesc)}</td>
        <td class="num">1</td>
        <td class="num">${esc(money)}</td>
        <td class="num">${esc(money)}</td>
      </tr>
    </tbody>
  </table>

  <div class="inv-summary" role="region" aria-label="Kopsavilkums">
    <div class="inv-summary-row">
      <span class="inv-summary-label">Sub Total</span>
      <span class="inv-summary-val">${esc(money)}</span>
    </div>
    <div class="inv-summary-row inv-summary-row--muted">
      <span class="inv-summary-label">PVN likme</span>
      <span class="inv-summary-val">0% (N/A)</span>
    </div>
    <div class="inv-summary-row inv-summary-row--emph">
      <span class="inv-summary-label">Total</span>
      <span class="inv-summary-val">${esc(money)}</span>
    </div>
    <p class="inv-pvn-note">Starpsumma un kopsumma norādītas bez atsevišķas PVN sadalījuma; pievienotās vērtības nodoklis netiek piemērots (0% / N/A).</p>
  </div>

  <footer class="inv-foot">
    <p class="inv-foot-legal">${esc(pvnFooter)}</p>
  </footer>
</div>
</body>
</html>`;
}
