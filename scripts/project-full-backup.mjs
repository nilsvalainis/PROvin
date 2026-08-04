#!/usr/bin/env node
/**
 * Pilna projekta rezerve pirms riskantām izmaiņām (kods + admin dati).
 * Saglabā Dropbox: `.data/project-full-backups/<timestamp>/`
 *
 *   node scripts/project-full-backup.mjs --load-env-local
 *   node scripts/project-full-backup.mjs --load-env-local --purpose pre-copilot-agent-build
 *
 * Satur:
 *   - git.bundle (visa vēsture, atjaunošanai)
 *   - source.tar.gz (projekta faili bez node_modules/.next)
 *   - admin/ (admin-full-backup saturs — pasūtījumi, IRISS, orders-backups)
 *   - RESTORE.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  return fs
    .readFile(p, "utf8")
    .then((txt) => {
      for (const line of txt.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq <= 0) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!(k in process.env)) process.env[k] = v;
      }
    })
    .catch(() => {});
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "").trim() || `${cmd} failed`;
    throw new Error(err);
  }
  return (r.stdout || "").trim();
}

function readPurposeArg() {
  const idx = process.argv.indexOf("--purpose");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].trim();
  return "project-full-backup";
}

async function main() {
  if (process.argv.includes("--load-env-local")) await loadEnvLocal();

  const purpose = readPurposeArg();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, ".data", "project-full-backups", stamp);
  await fs.mkdir(backupRoot, { recursive: true });

  const gitCommit = sh("git", ["rev-parse", "HEAD"]);
  const gitBranch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const gitStatus = sh("git", ["status", "--porcelain"]);

  console.log(`\n→ Project full backup: ${backupRoot}`);
  console.log(`  git: ${gitCommit.slice(0, 12)} (${gitBranch}) · ${purpose}\n`);

  // 1) Git bundle — full history restore point
  const bundlePath = path.join(backupRoot, "git.bundle");
  console.log("  git bundle…");
  sh("git", ["bundle", "create", bundlePath, "--all"]);
  const bundleStat = await fs.stat(bundlePath);

  // 2) Source archive (no node_modules / .next / .data / .git)
  const tarPath = path.join(backupRoot, "source.tar.gz");
  console.log("  source.tar.gz…");
  sh("tar", [
    "-czf",
    tarPath,
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=.data",
    "--exclude=.git",
    "--exclude=.vercel",
    "--exclude=coverage",
    "--exclude=.DS_Store",
    "-C",
    root,
    ".",
  ]);
  const tarStat = await fs.stat(tarPath);

  // 3) Admin data backup into this folder
  console.log("  admin-full-backup…");
  const adminScript = path.join(__dirname, "admin-full-backup.mjs");
  const adminArgs = [adminScript, "--purpose", purpose];
  if (process.argv.includes("--load-env-local")) adminArgs.push("--load-env-local");
  // Run admin backup into a temp stamp, then copy/move reference
  const adminRun = spawnSync(process.execPath, adminArgs, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  process.stdout.write(adminRun.stdout || "");
  if (adminRun.stderr) process.stderr.write(adminRun.stderr);
  if (adminRun.status !== 0) {
    throw new Error("admin-full-backup failed");
  }

  // Find newest admin backup and copy into project backup
  const adminBackupsRoot = path.join(root, ".data", "admin-full-backups");
  const adminDirs = (await fs.readdir(adminBackupsRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const latestAdmin = adminDirs[adminDirs.length - 1];
  if (!latestAdmin) throw new Error("admin backup folder missing after run");
  const adminSrc = path.join(adminBackupsRoot, latestAdmin);
  const adminDest = path.join(backupRoot, "admin");
  await fs.cp(adminSrc, adminDest, { recursive: true });

  let adminManifest = null;
  try {
    adminManifest = JSON.parse(await fs.readFile(path.join(adminDest, "manifest.json"), "utf8"));
  } catch {
    /* ignore */
  }

  const restoreMd = `# PROVIN project restore — ${stamp}

## Snapshot
- **Purpose:** ${purpose}
- **Exported:** ${new Date().toISOString()}
- **Git commit:** \`${gitCommit}\` (branch \`${gitBranch}\`)
- **Working tree dirty:** ${gitStatus ? "yes" : "no"}

## Restore code (git)

\`\`\`bash
# Option A — from GitHub (if still on remote)
git checkout ${gitCommit}

# Option B — from this bundle
git clone git.bundle restored-provin
cd restored-provin
git checkout ${gitCommit}
\`\`\`

## Restore source tree (without git history)

\`\`\`bash
mkdir -p /path/to/restore && tar -xzf source.tar.gz -C /path/to/restore
\`\`\`

## Restore admin data (orders / IRISS / fields)

\`\`\`bash
# From project root of a checkout:
npm run admin:restore-full -- --from ${latestAdmin} --confirm
# Or copy admin/filesystem/* back into .data/
\`\`\`

## Notes
- \`admin/\` is a copy of \`.data/admin-full-backups/${latestAdmin}\`
- Vercel Blob: if \`BLOB_READ_WRITE_TOKEN\` was missing at export, production drafts are NOT in this backup — re-run with the token.
`;

  await fs.writeFile(path.join(backupRoot, "RESTORE.md"), restoreMd, "utf8");

  const manifest = {
    exportedAt: new Date().toISOString(),
    purpose,
    backupRoot,
    gitCommit,
    gitBranch,
    workingTreeClean: !gitStatus,
    artifacts: {
      gitBundle: { path: "git.bundle", bytes: bundleStat.size },
      sourceArchive: { path: "source.tar.gz", bytes: tarStat.size },
      adminBackupStamp: latestAdmin,
      adminManifest,
    },
  };
  await fs.writeFile(path.join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`\n✓ Project full backup ready: ${backupRoot}`);
  console.log(`  git.bundle: ${(bundleStat.size / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  source.tar.gz: ${(tarStat.size / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  admin: ${latestAdmin}`);
  console.log(`  RESTORE.md + manifest.json\n`);
}

main().catch((err) => {
  console.error("Project backup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
