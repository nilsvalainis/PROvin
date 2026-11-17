#!/usr/bin/env node
// refill.js - aizpilda JAUNU standarta pavadzīmi CSDD TTR, NESPIEŽ Saglabāt.
// Ievade: env IRISS_JOB_JSON. Rezultāts: pēdējā stdout rindā JSON {ok, fields}.
// Nekādas pārtraukšanas/anulēšanas/beigšanas. Darbojas gan CommonJS, gan ESM mapē (tikai dinamisks import).
import("./ctl/waybill-run.mjs")
  .catch(() => import("./waybill-run.mjs"))
  .then((m) => m.main("fill"))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: `refill.js: ${String(err && err.message ? err.message : err).slice(0, 160)}` })}\n`, () => process.exit(0));
  });
