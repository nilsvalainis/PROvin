#!/usr/bin/env node
// annul.js - pārtrauc (CSDD "Pārtraukt!") TIKAI lietotāja apstiprināto pavadzīmi IRISS_JOB_JSON.replaceWaybillNo uz šī numura.
// Strādā tikai ar env IRISS_WAYBILL_ANNUL_LIVE=1 (citādi {ok:false} un CSDD netiek aiztikts). Saglabāt nespiež.
// Rezultāts: pēdējā stdout rindā JSON {ok, waybillNo}. Darbojas gan CommonJS, gan ESM mapē (tikai dinamisks import).
import("./ctl/waybill-run.mjs")
  .catch(() => import("./waybill-run.mjs"))
  .then((m) => m.main("annul"))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `annul.js: ${String(err && err.message ? err.message : err).slice(0, 160)}` })}\n`, () => process.exit(0));
  });
