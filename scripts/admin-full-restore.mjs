#!/usr/bin/env node
/**
 * Atjauno `.data/*` no `admin-full-backup.mjs` eksporta.
 *
 *   node scripts/admin-full-restore.mjs --list
 *   node scripts/admin-full-restore.mjs --from 2026-07-17T09-03-32-159Z --confirm
 *   node scripts/admin-full-restore.mjs --from latest --confirm
 */
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const backupsRoot = path.join(root, ".data", "admin-full-backups");

async function listBackups() {
  let entries;
  try {
    entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  } catch {
    console.error("Nav backup mapes:", backupsRoot);
    process.exit(1);
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (dirs.length === 0) {
    console.log("Nav atrastu backup.");
    return;
  }
  console.log("Pieejamie backup:\n");
  for (const d of dirs) {
    const manifestPath = path.join(backupsRoot, d, "manifest.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const files = (manifest.reports ?? []).filter((r) => !r.skipped).length;
      console.log(`  ${d}`);
      console.log(`    ${manifest.exportedAt ?? "?"} · ${manifest.purpose ?? "backup"} · git ${manifest.gitCommit ?? "?"}`);
      console.log(`    avoti ar datiem: ${files}\n`);
    } catch {
      console.log(`  ${d} (manifest nav)\n`);
    }
  }
}

async function resolveBackupDir(fromArg) {
  if (fromArg === "latest") {
    const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    if (dirs.length === 0) throw new Error("Nav backup");
    return path.join(backupsRoot, dirs[dirs.length - 1]);
  }
  const direct = path.join(backupsRoot, fromArg);
  try {
    await fs.access(path.join(direct, "manifest.json"));
    return direct;
  } catch {
    throw new Error(`Backup nav atrasts: ${fromArg}`);
  }
}

async function copyTree(srcDir, destDir) {
  let files = 0;
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch {
    return files;
  }
  await fs.mkdir(destDir, { recursive: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      files += await copyTree(src, dst);
    } else if (ent.isFile()) {
      await fs.copyFile(src, dst);
      files += 1;
    }
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list") || args.length === 0) {
    await listBackups();
    console.log("Lietošana: node scripts/admin-full-restore.mjs --from <timestamp|latest> --confirm");
    return;
  }

  const fromIdx = args.indexOf("--from");
  const fromArg = fromIdx >= 0 ? args[fromIdx + 1] : null;
  if (!fromArg) {
    console.error("Trūkst --from <timestamp|latest>");
    process.exit(1);
  }
  if (!args.includes("--confirm")) {
    console.error("Drošībai pievieno --confirm (pārraksta .data mapes no backup).");
    process.exit(1);
  }

  const backupDir = await resolveBackupDir(fromArg);
  const manifest = JSON.parse(await fs.readFile(path.join(backupDir, "manifest.json"), "utf8"));
  const fsRoot = path.join(backupDir, "filesystem");

  console.log(`\nAtjauno no: ${backupDir}`);
  console.log(`  eksportēts: ${manifest.exportedAt ?? "?"}`);
  console.log(`  git: ${manifest.gitCommit ?? "?"}`);
  console.log(`  mērķis: ${manifest.purpose ?? "?"}\n`);

  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(fsRoot, { withFileTypes: true });
  } catch {
    console.error("Backup nav filesystem/ satura.");
    process.exit(1);
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const src = path.join(fsRoot, ent.name);
    const dest = path.join(root, ".data", ent.name);
    const n = await copyTree(src, dest);
    console.log(`  ${ent.name}: ${n} faili → ${dest}`);
    total += n;
  }

  console.log(`\n✓ Atjaunots ${total} faili no filesystem backup.`);
  if ((manifest.reports ?? []).some((r) => r.source === "vercel-blob" && r.skipped)) {
    console.log("\n⚠ Vercel Blob netika backup lokāli — production melnraksti jāatjauno atsevišķi (Vercel env + admin:backup-full).");
  }
  console.log("Koda atjaunošanai: git checkout <commit> vai git revert.\n");
}

main().catch((err) => {
  console.error("Restore failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
