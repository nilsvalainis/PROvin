#!/usr/bin/env node
/**
 * Pilns admin datu backup pirms riskantām izmaiņām.
 * Kopē pasūtījumu/konsultāciju/IRISS melnrakstus no `.data/` (+ opcionāli Blob).
 *
 *   node scripts/orders-backup-all.mjs
 *   node scripts/orders-backup-all.mjs --load-env-local
 */
import fs from "node:fs/promises";
import path from "node:path";

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

async function copyTree(srcDir, destDir, rel = "") {
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
    const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      const sub = await copyTree(src, dst, nextRel);
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

async function listBlobJson(prefix, token) {
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
      if (b.pathname?.endsWith(".json")) out.set(b.pathname, b.url);
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

async function main() {
  if (process.argv.includes("--load-env-local")) await loadEnvLocal();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(root, ".data", "orders-backups", stamp);
  await fs.mkdir(backupRoot, { recursive: true });

  const sources = [
    { key: "admin-order-drafts", dir: path.join(root, ".data", "admin-order-drafts") },
    { key: "admin-consultation-drafts", dir: path.join(root, ".data", "admin-consultation-drafts") },
    { key: "iriss-pasutijumi", dir: path.join(root, ".data", "iriss-pasutijumi") },
    { key: "iriss-pasutijumi-backups", dir: path.join(root, ".data", "iriss-pasutijumi-backups") },
    { key: "daily-admin-draft-backups", dir: path.join(root, ".data", "daily-admin-draft-backups") },
  ];

  const reports = [];
  for (const { key, dir } of sources) {
    const dest = path.join(backupRoot, key);
    const r = await copyTree(dir, dest);
    reports.push({ source: key, path: dir, ...r });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const orderPrefix = process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX?.trim() ?? "";
  if (blobToken && orderPrefix) {
    const blobDir = path.join(backupRoot, "vercel-blob-order-drafts");
    await fs.mkdir(blobDir, { recursive: true });
    const blobs = await listBlobJson(orderPrefix, blobToken);
    let files = 0;
    let bytes = 0;
    for (const [pathname, url] of blobs) {
      const text = await fetchBlobText(url, blobToken);
      if (!text) continue;
      const name = path.basename(pathname);
      const fp = path.join(blobDir, name);
      await fs.writeFile(fp, text, "utf8");
      files += 1;
      bytes += Buffer.byteLength(text, "utf8");
    }
    reports.push({ source: "vercel-blob-order-drafts", path: orderPrefix, files, bytes, skipped: files === 0 });
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    backupRoot,
    reports,
    restoreHint:
      "Kopē atpakaļ no attiecīgās apakšmapes uz `.data/<source>/` vai lieto admin UI eksportu / scripts/iriss-restore-backup.mjs",
  };
  await fs.writeFile(path.join(backupRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Backup saglabāts: ${backupRoot}`);
  for (const r of reports) {
    if (r.skipped) console.log(`  ${r.source}: nav datu (${r.path})`);
    else console.log(`  ${r.source}: ${r.files} faili, ${r.bytes} B`);
  }
}

main().catch((err) => {
  console.error("Backup failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
