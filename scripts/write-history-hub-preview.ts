import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_HUB_VARIANTS, historyHubPreviewCss } from "../lib/history-hub-layout-preview";

const sections = HISTORY_HUB_VARIANTS.map(
  (v) =>
    `<section class="block"><h2 class="block__h">${v.title}</h2><p class="block__p">${v.note}</p>${v.html()}</section>`,
).join("\n");

const html = `<!doctype html>
<html lang="lv">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>PROVIN — vēstures kopsavilkums</title>
  <style>
    body{margin:0;background:#EEF1F5;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;}
    .wrap{max-width:820px;margin:0 auto;padding:40px 20px 80px;}
    .eyebrow{font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0369a1;}
    h1{margin:8px 0 0;font-size:30px;letter-spacing:-0.03em;}
    .lead{margin:12px 0 0;max-width:42rem;font-size:15px;line-height:1.55;color:#475569;}
    .block{margin-top:56px;}
    .block__h{margin:0;font-size:13px;font-weight:650;}
    .block__p{margin:4px 0 12px;font-size:13px;line-height:1.4;color:#64748b;}
    ${historyHubPreviewCss()}
  </style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">PROVIN · iekšējs</p>
    <h1>Vēstures kopsavilkums — kartītes</h1>
    <p class="lead">Trīs veidi, kā kopsavilkumu uzcelt par galveno sadaļu. Negadījums paliek kartīte, ko var dublēt. Dati ir Q7-stila izgriezums.</p>
    ${sections}
  </div>
</body>
</html>`;

const out = join(process.cwd(), "scripts/history-hub-preview.html");
writeFileSync(out, html.replaceAll("/brand/damage-car-top.jpg", "../public/brand/damage-car-top.jpg"));
console.log(out);
