import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ecarstradePreciseLinksDryRunRecords } from "@/lib/iriss-ecarstrade-links-dry-run-fixtures";
import {
  dryRunRecordsFromPasutijumiBackup,
  formatEcarstradeDryRunReport,
} from "@/lib/iriss-ecarstrade-links-dry-run";

const here = dirname(fileURLToPath(import.meta.url));
const realPath = process.argv[2] || "/tmp/iriss-real/pasutijumi.json";
let realMd = "";
try {
  const payload = JSON.parse(readFileSync(realPath, "utf8")) as unknown;
  const records = dryRunRecordsFromPasutijumiBackup(payload);
  if (records.length > 0) {
    realMd = formatEcarstradeDryRunReport(records, { realBackup: true });
    console.log(`real-backup ${records.length} ${realPath}`);
  }
} catch {
  console.log(`real-backup skip (${realPath} nav lasāms)`);
}

const md = formatEcarstradeDryRunReport(ecarstradePreciseLinksDryRunRecords());
const targets = [
  { file: resolve(here, "../lib/__fixtures__/iriss-ecarstrade/precise-links-dry-run.md"), body: md },
  { file: "/opt/cursor/artifacts/ecarstrade-precise-links-dry-run.md", body: md },
];
if (realMd) {
  targets.push({ file: "/opt/cursor/artifacts/ecarstrade-real-links-dry-run.md", body: realMd });
}
for (const target of targets) {
  mkdirSync(dirname(target.file), { recursive: true });
  writeFileSync(target.file, target.body, "utf8");
  console.log(target.file);
}
