#!/usr/bin/env node

import fs from "fs/promises";
import path from "node:path";

function printUsage() {
  console.log("Usage: node scripts/iriss-restore-from-json-backup.mjs <backup-json-path> <output-dir>");
}

function pickDraftMap(root) {
  if (!root || typeof root !== "object") return null;
  const obj = /** @type {Record<string, unknown>} */ (root);

  // 1) Entire root is already a { "<id>.json": "<json string>" } map.
  const rootEntries = Object.entries(obj);
  if (rootEntries.length > 0 && rootEntries.every(([k, v]) => k.endsWith(".json") && typeof v === "string")) {
    return obj;
  }

  // 2) Look for nested maps that follow the same pattern.
  for (const [, v] of rootEntries) {
    if (!v || typeof v !== "object") continue;
    const nested = /** @type {Record<string, unknown>} */ (v);
    const nestedEntries = Object.entries(nested);
    if (nestedEntries.length === 0) continue;
    if (nestedEntries.every(([k, vv]) => k.endsWith(".json") && typeof vv === "string")) {
      return nested;
    }
  }

  return null;
}

async function main() {
  const [, , backupPathArg, outDirArg] = process.argv;
  if (!backupPathArg || !outDirArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const backupPath = path.resolve(backupPathArg);
  const outDir = path.resolve(outDirArg);

  const raw = await fs.readFile(backupPath, "utf8");
  const parsed = JSON.parse(raw);
  const draftMap = pickDraftMap(parsed);

  if (!draftMap) {
    throw new Error("Could not locate IRISS draft file map in backup JSON.");
  }

  await fs.mkdir(outDir, { recursive: true });

  let restored = 0;
  for (const [name, payload] of Object.entries(draftMap)) {
    if (!name.endsWith(".json") || typeof payload !== "string") continue;
    try {
      JSON.parse(payload);
    } catch {
      continue;
    }
    const fp = path.join(outDir, name);
    await fs.writeFile(fp, payload, "utf8");
    restored += 1;
  }

  if (parsed && typeof parsed === "object" && "listOrder" in parsed) {
    const listOrder = /** @type {Record<string, unknown>} */ (parsed).listOrder;
    if (listOrder && typeof listOrder === "object") {
      await fs.writeFile(path.join(outDir, "_list-order.json"), JSON.stringify(listOrder, null, 2), "utf8");
    }
  }

  console.log(`Restored ${restored} draft json files to: ${outDir}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
