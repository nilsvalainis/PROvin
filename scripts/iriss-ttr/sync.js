#!/usr/bin/env node
// sync.js - TIKAI LASA: aktīvās CSDD pavadzīmes firmas tirdzniecības numuriem (arī ar roku izrakstītās).
// Ievade: env IRISS_JOB_JSON {ctx, plates?, known?}. Rezultāts: pēdējā stdout rindā JSON {ok, plates, maxNumber, platesChecked}.
// Nekādas saglabāšanas, pārtraukšanas vai anulēšanas. Darbojas gan CommonJS, gan ESM mapē (tikai dinamisks import).
import("./ctl/waybill-run.mjs")
  .catch(() => import("./waybill-run.mjs"))
  .then((m) => m.main("sync"))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `sync.js: ${String(err && err.message ? err.message : err).slice(0, 160)}` })}\n`, () => process.exit(0));
  });
