// refill.js / save.js kopīgā palaišana: node <TTR_DIR>/refill.js|save.js ar env IRISS_JOB_JSON (sk. README.md).
import path from "node:path";
import { createPlaywrightDriver } from "./waybill-driver.mjs";
import { platesForCtx } from "./csdd-waybills-core.mjs";
import { runCli } from "./waybill-scripts-core.mjs";

export async function main(step) {
  const ttrDir = process.env.IRISS_TTR_DIR || "/root/iriss-ttr";
  const log = (msg, extra = {}) => process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), step, msg, ...extra })}\n`);
  const code = await runCli(step, {
    env: process.env,
    makeDriver: (s) => createPlaywrightDriver(s, { ttrDir, env: process.env, log }),
    ledgerDir: process.env.IRISS_WAYBILL_LEDGER_DIR || path.join(ttrDir, "state", "waybill-jobs"),
    dateFormat: process.env.IRISS_TTR_DATE_FORMAT || "dd.MM.yyyy HH:mm",
    stdout: process.stdout,
    stderr: process.stderr,
    platesForCtx,
  });
  // Pipe uz worker ir asinhrons: izejam tikai pēc tam, kad JSON rinda ir izrakstīta.
  process.stdout.write("", () => process.exit(code));
}
