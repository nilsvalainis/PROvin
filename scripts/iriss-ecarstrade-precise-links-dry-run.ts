import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ecarstradePreciseLinksDryRunRecords } from "@/lib/iriss-ecarstrade-links-dry-run-fixtures";
import { formatEcarstradeDryRunReport } from "@/lib/iriss-ecarstrade-links-dry-run";

const here = dirname(fileURLToPath(import.meta.url));
const md = formatEcarstradeDryRunReport(ecarstradePreciseLinksDryRunRecords());
const targets = [
  resolve(here, "../lib/__fixtures__/iriss-ecarstrade/precise-links-dry-run.md"),
  "/opt/cursor/artifacts/ecarstrade-precise-links-dry-run.md",
];
for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, md, "utf8");
  console.log(target);
}
