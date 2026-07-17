#!/usr/bin/env node
/**
 * Pilns PROVIN admin datu backup pirms riskantām izmaiņām.
 * Saglabā Dropbox projekta mapē: `.data/admin-full-backups/<timestamp>/`
 *
 *   node scripts/admin-full-backup.mjs
 *   node scripts/admin-full-backup.mjs --load-env-local
 *   node scripts/admin-full-backup.mjs --load-env-local --purpose pre-copilot-agent
 *
 * Atjaunošana: npm run admin:restore-full -- --from latest --confirm
 */
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();

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

async function copyTree(srcDir, destDir) {
  let files = 0;
  let bytes = 0;
  let entries;
  try {
    entries = await fs.readdir(srcDir, { withFileTypes: true });
  } catch {
    return { files, bytes, skipped: true };
  }
  await fs.mkdir(destDir, { recursive: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      const sub = await copyTree(src, dst);
      files += sub.files;
      bytes += sub.bytes;
    } else if (ent.isFile()) {
      await fs.copyFile(src, dst);
      const st = await fs.stat(dst);
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes, skipped: false };
}

async function listBlobPaths(prefix, token) {
  const out = new Map();
  let cursor;
  do {
    const url = new URL("https://blob.vercel-storage.com");
    url.searchParams.set("prefix", prefix);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = await res.json();
    for (const b of data.blobs ?? []) {
      if (b.pathname) out.set(b.pathname, b.url);
    }
    cursor = data.hasMore ? data.cursor : undefined;
  } while (cursor);
  return out;
}

async function fetchBlobText(url, token) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.text();
}

async function backupBlobPrefix(prefix, token, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const blobs = await listBlobPaths(prefix, token);
  let files = 0;
  let bytes = 0;
  for (const [pathname, url] of blobs) {
    const text = await fetchBlobText(url, token);
    if (text == null) continue;
    const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : path.basename(pathname);
    const fp = path.join(destDir, rel.replace(/\//g, "__"));
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, text, "utf8");
    files += 1;
    bytes += Buffer.byteLength(text, "utf8");
  }
  return { files, bytes, skipped: files === 0 };
}

function readGitCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readPurposeArg() {
  const idx = process.argv.indexOf("--purpose");
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].trim();
  return "admin-full-backup";
}

async function main() {
  if (process.argv.includes("--load-env-local")) await loadEnvLocal();

  const purpose = readPurposeArg();
  const gitCommit = readGitCommit();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, ".data", "admin-full-backups", stamp);
  await fs.mkdir(backupRoot, { recursive: true });

  const fsSources = [
    { key: "admin-order-drafts", dir: path.join(root, ".data", "admin-order-drafts") },
    { key: "admin-consultation-drafts", dir: path.join(root, ".data", "admin-consultation-drafts") },
    { key: "admin-pkd-commission-invoices", dir: path.join(root, ".data", "admin-pkd-commission-invoices") },
    { key: "iriss-pasutijumi", dir: path.join(root, ".data", "iriss-pasutijumi") },
    { key: "iriss-pasutijumi-backups", dir: path.join(root, ".data", "iriss-pasutijumi-backups") },
    { key: "iriss-pasutijumi-local-mirror", dir: path.join(root, ".data", "iriss-pasutijumi-local-mirror") },
    { key: "iriss-scan", dir: path.join(root, ".data", "iriss-scan") },
    { key: "iriss-sludinajumi", dir: path.join(root, ".data", "iriss-sludinajumi") },
    { key: "iriss-listings-sessions", dir: path.join(root, ".data", "iriss-listings-sessions") },
    { key: "daily-admin-draft-backups", dir: path.join(root, ".data", "daily-admin-draft-backups") },
    { key: "orders-backups", dir: path.join(root, ".data", "orders-backups") },
    { key: "invoices", dir: path.join(root, ".data", "invoices") },
  ];

  const reports = [];
  for (const { key, dir } of fsSources) {
    const dest = path.join(backupRoot, "filesystem", key);
    const r = await copyTree(dir, dest);
    reports.push({ source: key, kind: "filesystem", path: dir, ...r });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const blobPrefixes = [
    { key: "order-drafts", prefix: process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX?.trim() || "admin-order-drafts/" },
    { key: "consultation-drafts", prefix: "admin-consultation-drafts/" },
    { key: "iriss-pasutijumi", prefix: "iriss-pasutijumi/" },
    { key: "iriss-scan", prefix: "iriss-scan/" },
    { key: "iriss-sludinajumi", prefix: process.env.ADMIN_IRISS_LISTINGS_BLOB_PREFIX?.trim() || "iriss-sludinajumi/" },
    { key: "manual-orders", prefix: "admin-manual-orders/" },
  ];

  if (blobToken) {
    for (const { key, prefix } of blobPrefixes) {
      const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
      const dest = path.join(backupRoot, "vercel-blob", key);
      const r = await backupBlobPrefix(normalized, blobToken, dest);
      reports.push({ source: `blob:${key}`, kind: "vercel_blob", path: normalized, ...r });
    }
  } else {
    reports.push({
      source: "vercel-blob",
      kind: "vercel_blob",
      path: "(skipped)",
      files: 0,
      bytes: 0,
      skipped: true,
      reason: "BLOB_READ_WRITE_TOKEN missing",
    });
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    backupRoot,
    dropboxProjectRoot: root,
    gitCommit,
    gitBranch: (() => {
      try {
        return execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();
      } catch {
        return null;
      }
    })(),
    reports,
    restoreHint:
      "Datu atjaunošana: npm run admin:restore-full -- --from <timestamp> --confirm. Kods: git checkout <gitCommit>. Blob: atkārtot backup ar BLOB_READ_WRITE_TOKEN.",
    purpose,
  };
  await fs.writeFile(path.join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`\n✓ Pilns admin backup: ${backupRoot}`);
  if (gitCommit) console.log(`  git: ${gitCommit.slice(0, 12)} (${purpose})`);
  console.log("");
  for (const r of reports) {
    if (r.skipped) console.log(`  ${r.source}: nav datu (${r.path})${r.reason ? ` — ${r.reason}` : ""}`);
    else console.log(`  ${r.source}: ${r.files} faili, ${(r.bytes / 1024).toFixed(1)} KB`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Backup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
