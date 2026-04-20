#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, ".data", "iriss-pasutijumi");
const backupDir = path.join(root, ".data", "iriss-pasutijumi-backups");

const argId = process.argv.find((a) => a.startsWith("--id="))?.slice("--id=".length) ?? null;

async function main() {
  const names = await fs.readdir(backupDir);
  const byId = new Map();

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const idx = name.indexOf("__");
    if (idx <= 0) continue;
    const id = name.slice(0, idx);
    if (argId && id !== argId) continue;
    const prev = byId.get(id);
    if (!prev || name > prev) byId.set(id, name);
  }

  if (byId.size === 0) {
    console.log("No matching IRISS backups found.");
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  let restored = 0;
  for (const [id, file] of byId) {
    const src = path.join(backupDir, file);
    const dst = path.join(dataDir, `${id}.json`);
    await fs.copyFile(src, dst);
    restored += 1;
  }
  console.log(`Restored ${restored} IRISS record(s) from latest backup snapshot.`);
}

main().catch((err) => {
  console.error("Restore failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

