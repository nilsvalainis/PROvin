#!/usr/bin/env node
// TIKAI LASA (incidentu pārbaudei ar roku): numura aktīvās pavadzīmes, viena pavadzīme pēc numura, pavadzīmes ar VIN.
// VPN jābūt ieslēgtam (curl -X POST 127.0.0.1:9334/lease). Nekas netiek saglabāts, pārtraukts vai anulēts.
//   node /root/iriss-ttr/ctl/csdd-check.mjs --plate B193-7 [--number P02812] [--vin WBA...] [--shots j10]
// Ekrānuzņēmumi: /root/iriss-ttr/shots/<shots>-*.png. Rezultāts: JSON stdout.
import { dealerPlate, DEALER_PLATES, platesForCtx } from "./csdd-waybills-core.mjs";
import { createPlaywrightDriver } from "./waybill-driver.mjs";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? String(process.argv[i + 1] || "") : "";
}

const plate = dealerPlate(arg("plate"));
const number = arg("number").toUpperCase();
const vin = arg("vin").toUpperCase();
const shots = arg("shots").replace(/[^A-Za-z0-9_-]/g, "") || "check";
if (!plate) {
  console.log(JSON.stringify({ ok: false, error: "--plate B193-7 | B762-7 | B192-7" }));
  process.exit(0);
}
const ctx = DEALER_PLATES[plate];
const ttrDir = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
const log = (msg, extra = {}) => process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), msg, ...extra })}\n`);
const driver = await createPlaywrightDriver("sync", { ttrDir, env: process.env, log });
const out = { ok: false, plate, ctx };
try {
  await driver.open({ jobId: `check-${shots}`, plate, ctx, flow: "new", brandModel: "-", representative: "" });
  const known = number ? [number] : [];
  const res = await driver.readActiveWaybills({ plates: platesForCtx(ctx), known });
  out.ok = res.ok;
  out.error = res.error || "";
  out.activeByPlate = res.plates;
  out.maxNumber = res.maxNumber;
  out.checkedCards = res.checked;
  out.shots = [await driver.screenshot(`${shots}-saraksts`).catch(() => "")];
  if (number) {
    out.number = await driver.lookupWaybill(number);
    out.shots.push(await driver.screenshot(`${shots}-${number}`).catch(() => ""));
  }
  if (vin) out.vinHits = (res.details || []).filter((d) => d.vin === vin);
} catch (err) {
  out.error = err instanceof Error ? err.message.slice(0, 200) : "error";
} finally {
  await driver.close({ keepPage: false }).catch(() => {});
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`, () => process.exit(0));
