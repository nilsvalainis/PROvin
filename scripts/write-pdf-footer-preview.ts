import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPdfDocFooterHtml, pdfDocFooterCss } from "../lib/client-report-pdf-footer";

const generated = new Intl.DateTimeFormat("lv-LV", { dateStyle: "long" }).format(new Date());

function sheet(amountTotalCents: number) {
  return buildPdfDocFooterHtml({
    vin: "WVWZZZ1JZXW000001",
    amountTotalCents,
    generatedLabel: `Ģenerēts ${generated}`,
  });
}

const html = `<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>PROVIN — PDF kājenes priekšskatījums</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  html,body{margin:0;background:#E4E9F0;color:#0f172a;font-family:Inter,sans-serif;}
  main{max-width:920px;margin:0 auto;padding:40px 20px 64px;}
  .kicker{margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#0061D2;}
  h1{margin:8px 0 0;font-size:30px;letter-spacing:-0.03em;}
  .lead{margin:12px 0 0;max-width:38rem;font-size:15px;line-height:1.6;color:#475569;}
  h2{margin:40px 0 12px;font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;}
  .sheet{
    width:min(100%,190mm);margin:0 auto;background:#fff;padding:16mm 14mm 12mm;
    box-shadow:0 18px 50px -24px rgba(15,23,42,0.35);
  }
  .fade-title{margin:0;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;}
  .fade-text{margin:12px 0 0;font-size:11.5px;line-height:1.6;color:#94a3b8;}
${pdfDocFooterCss()}
</style>
</head>
<body>
<main>
  <p class="kicker">PROVIN · iekšējs</p>
  <h1>PDF kājene</h1>
  <p class="lead">Tāds pats HTML un CSS kā klienta auditā. Logo ir, juridiskie rekvizīti nav.</p>
  <h2>PROVIN AUDITS</h2>
  <article class="sheet provin-report-doc">
    <p class="fade-title">2. Kopsavilkums</p>
    <p class="fade-text">Ņemot vērā apzinātu odometra neatbilstību un slēptu komerciālo pagātni, pircējam jāvērtē auto pēc reālā, ne sludinājumā redzamā nobraukuma. Šī rinda ir tikai priekšskatījuma fons — lai redzētu, kā kājene sēž zem pēdējās sadaļas.</p>
    ${sheet(9999)}
  </article>
  <h2>PROVIN MINI</h2>
  <article class="sheet provin-report-doc">
    <p class="fade-title">2. Kopsavilkums</p>
    <p class="fade-text">Īsāka atskaite, tā pati kājene — mainās tikai produkta nosaukums.</p>
    ${sheet(3999)}
  </article>
</main>
</body>
</html>
`;

const out = join(process.cwd(), "scripts/pdf-footer-preview.html");
writeFileSync(out, html);
console.log(out);
