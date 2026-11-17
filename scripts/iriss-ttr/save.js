#!/usr/bin/env node
// save.js - pārbauda aizpildīto formu un VIENREIZ spiež Saglabāt, nolasa numuru un PDF.
// Ievade: env IRISS_JOB_JSON. Rezultāts: pēdējā stdout rindā JSON {ok, waybillNo, pdfPath}.
// Nekādas pārtraukšanas/anulēšanas/beigšanas. Darbojas gan CommonJS, gan ESM mapē (tikai dinamisks import).
import("./ctl/waybill-run.mjs")
  .catch(() => import("./waybill-run.mjs"))
  .then((m) => m.main("save"))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `save.js: ${String(err && err.message ? err.message : err).slice(0, 160)}` })}\n`, () => process.exit(0));
  });
