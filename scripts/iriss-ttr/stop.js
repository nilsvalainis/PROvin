#!/usr/bin/env node
// stop.js - aizstāšana (Nils 20.11, A): CSDD «Pārtraukt» ("Pārtraukt!") TIKAI lietotāja apstiprinātajai vecajai pavadzīmei
// IRISS_JOB_JSON.replaceWaybillNo uz šī numura, pirms jaunās izrakstīšanas. Nekad «Anulēt», nekad «Paziņot klientam»,
// Saglabāt nespiež. Atslēdzams ar IRISS_WAYBILL_REPLACE_STOP=0. NAV annul.js (tas paliek izslēgts ar IRISS_WAYBILL_ANNUL_LIVE).
// Rezultāts: pēdējā stdout rindā JSON {ok, waybillNo}. Darbojas gan CommonJS, gan ESM mapē (tikai dinamisks import).
import("./ctl/waybill-run.mjs")
  .catch(() => import("./waybill-run.mjs"))
  .then((m) => m.main("stop"))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `stop.js: ${String(err && err.message ? err.message : err).slice(0, 160)}` })}\n`, () => process.exit(0));
  });
