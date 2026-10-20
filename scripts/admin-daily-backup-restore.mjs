#!/usr/bin/env node
/**
 * Nakts backup (`/api/cron/admin-drafts-daily-backup`) atjaunošana IZOLĒTĀ mapē.
 * Nekad neraksta Vercel Blob un nekad nepārraksta dzīvās `.data/*` mapes.
 *
 * Avots (viens no):
 *   --file <ceļš>                 `snapshot.json` (FS) vai Blob fails `admin-daily-backups/<YYYY-MM-DD>.json`
 *   --from-blob <YYYY-MM-DD|latest>  lejupielādē no Blob (tikai lasīšana; vajag BLOB_READ_WRITE_TOKEN, --load-env-local)
 *
 *   node scripts/admin-daily-backup-restore.mjs --file ~/Downloads/2026-10-20.json --verify-only
 *   node scripts/admin-daily-backup-restore.mjs --from-blob latest --load-env-local
 *   node scripts/admin-daily-backup-restore.mjs --file snapshot.json --out /tmp/provin-restore
 *
 * Noklusējuma --out: `.data/restore-tests/<timestamp>/`. Mape nedrīkst eksistēt ar saturu.
 * Pēc tam lokāli (bez Blob, izolēti):
 *   ADMIN_ORDER_DRAFT_DIR=<out>/admin-order-drafts ADMIN_ORDER_DRAFT_BLOB_PREFIX= BLOB_READ_WRITE_TOKEN= npm run dev
 */
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

/** Snapshot avota etiķete → mapes nosaukums (tāds pats izkārtojums kā `.data/<mape>` un Blob prefiksā). */
const TARGET_DIR_BY_SOURCE = {
  "order-drafts-blob": "admin-order-drafts",
  "order-drafts-fs": "admin-order-drafts",
  "consultation-drafts-fs": "admin-consultation-drafts",
  "iriss-blob": "iriss-pasutijumi",
  "iriss-fs": "iriss-pasutijumi",
  "iriss-scan-blob": "iriss-scan",
  "iriss-scan-fs": "iriss-scan",
  "iriss-pavadzimes-blob": "iriss-pavadzimes",
  "iriss-pavadzimes-fs": "iriss-pavadzimes",
  "b2b-partner-credits-blob": "b2b-partner-credits",
};

/** Blob ir produkcijas patiesība - FS kopija (Vercel `/tmp`) var būt novecojusi. */
const SOURCE_PRIORITY = (label) => (label.endsWith("-blob") ? 1 : 0);

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function loadEnvLocal() {
  try {
    const txt = await fs.readFile(path.join(root, ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* nav .env.local */
  }
}

/** Atbalsta abus formātus: FS `snapshot.json` = payload; Blob = `{ manifest, snapshotPayload }`. */
export function normalizeSnapshot(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("Backup nav JSON objekts.");
  if (parsed.snapshotPayload && typeof parsed.snapshotPayload === "object") {
    return { manifest: parsed.manifest ?? null, payload: parsed.snapshotPayload };
  }
  return { manifest: null, payload: parsed };
}

function isSafeRelPath(rel) {
  if (typeof rel !== "string" || !rel || rel.length > 400) return false;
  if (path.isAbsolute(rel) || rel.includes("\\") || rel.includes("\0")) return false;
  return rel.split("/").every((seg) => seg && seg !== "." && seg !== "..");
}

const ORDER_SESSION_RE = /^(cs_(test|live)_[A-Za-z0-9]+|manual_order_[A-Za-z0-9_]+)\.json$/;

export function planRestore(payload) {
  const files = new Map();
  const report = {
    sources: {},
    invalidJson: [],
    unsafePaths: [],
    unknownSources: [],
    orderSessions: 0,
    manualOrderSessions: 0,
    hasInvoiceCounter: false,
    hasStripePaidIndex: false,
    totalFiles: 0,
  };
  const labels = Object.keys(payload).sort((a, b) => SOURCE_PRIORITY(a) - SOURCE_PRIORITY(b));
  for (const label of labels) {
    const group = payload[label];
    if (!group || typeof group !== "object") continue;
    let dir = TARGET_DIR_BY_SOURCE[label];
    if (!dir) {
      report.unknownSources.push(label);
      dir = `_other/${label}`;
    }
    let count = 0;
    for (const [rel, body] of Object.entries(group)) {
      if (!isSafeRelPath(rel) || typeof body !== "string") {
        report.unsafePaths.push(`${label}:${rel}`);
        continue;
      }
      try {
        JSON.parse(body);
      } catch {
        report.invalidJson.push(`${label}:${rel}`);
      }
      files.set(`${dir}/${rel}`, body);
      count += 1;
    }
    report.sources[label] = { files: count, targetDir: dir };
  }
  const orderDraftNames = [...files.keys()]
    .filter((k) => k.startsWith("admin-order-drafts/"))
    .map((k) => k.slice("admin-order-drafts/".length))
    .filter((k) => !k.includes("/"));
  report.orderSessions = orderDraftNames.filter((n) => ORDER_SESSION_RE.test(n)).length;
  report.manualOrderSessions = orderDraftNames.filter((n) => n.startsWith("manual_order_")).length;
  report.hasInvoiceCounter = files.has("admin-order-drafts/_meta/invoice-year-sequence.json");
  report.hasStripePaidIndex = files.has("admin-order-drafts/admin-stripe-paid-index.json");
  report.totalFiles = files.size;
  return { files, report };
}

async function fetchFromBlob(which, token) {
  const prefixRaw = process.env.ADMIN_DRAFT_DAILY_BACKUP_BLOB_PREFIX?.trim() || "admin-daily-backups/";
  const prefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;
  const blobs = [];
  let cursor;
  do {
    const url = new URL("https://blob.vercel-storage.com");
    url.searchParams.set("prefix", prefix);
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Blob list HTTP ${res.status}`);
    const data = await res.json();
    for (const b of data.blobs ?? []) if (/\d{4}-\d{2}-\d{2}\.json$/.test(b.pathname ?? "")) blobs.push(b);
    cursor = data.hasMore ? data.cursor : undefined;
  } while (cursor);
  blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
  if (blobs.length === 0) throw new Error(`Blob nav neviena nakts snapshot zem ${prefix}`);
  const pick = which === "latest" ? blobs[blobs.length - 1] : blobs.find((b) => b.pathname === `${prefix}${which}.json`);
  if (!pick) throw new Error(`Snapshot ${which} nav atrasts. Pieejamie: ${blobs.map((b) => b.pathname).join(", ")}`);
  const res = await fetch(pick.downloadUrl || pick.url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Blob get HTTP ${res.status}`);
  return { text: await res.text(), label: pick.pathname };
}

/** Atrisina simlinkus (macOS `/var` → `/private/var`) arī vēl neeksistējošam ceļam. */
async function realpathLoose(p) {
  const tail = [];
  let cur = path.resolve(p);
  for (;;) {
    try {
      return path.join(await fs.realpath(cur), ...tail.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

function isWithin(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Atsakās rakstīt dzīvās `.data/*` mapēs - atļauta tikai `.data/restore-tests/<x>` vai mape ārpus `.data`. */
async function assertIsolatedOut(outDir) {
  const out = await realpathLoose(outDir);
  const dataDir = await realpathLoose(path.join(root, ".data"));
  if (!isWithin(dataDir, out)) return;
  const allowed = path.join(dataDir, "restore-tests");
  if (out === allowed || !isWithin(allowed, out)) {
    throw new Error(`--out nedrīkst būt dzīvajā .data mapē (${outDir}). Lieto .data/restore-tests/<nosaukums> vai mapi ārpus .data.`);
  }
}

async function assertEmptyDir(outDir) {
  try {
    const entries = await fs.readdir(outDir);
    if (entries.length > 0) throw new Error(`--out mape nav tukša: ${outDir} (nepārrakstām).`);
  } catch (e) {
    if (e && e.code === "ENOENT") return;
    throw e;
  }
}

async function main() {
  if (process.argv.includes("--load-env-local")) await loadEnvLocal();
  const file = argValue("--file");
  const fromBlob = argValue("--from-blob");
  const verifyOnly = process.argv.includes("--verify-only");
  if (!file && !fromBlob) {
    console.log("Lietošana: node scripts/admin-daily-backup-restore.mjs (--file <ceļš> | --from-blob <YYYY-MM-DD|latest>) [--out <mape>] [--verify-only]");
    process.exitCode = 1;
    return;
  }

  let text;
  let sourceLabel;
  if (file) {
    text = await fs.readFile(path.resolve(file), "utf8");
    sourceLabel = path.resolve(file);
  } else {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
    if (!token) throw new Error("Trūkst BLOB_READ_WRITE_TOKEN (pievieno --load-env-local).");
    const got = await fetchFromBlob(fromBlob, token);
    text = got.text;
    sourceLabel = `blob:${got.label}`;
  }

  const { manifest, payload } = normalizeSnapshot(JSON.parse(text));
  const { files, report } = planRestore(payload);

  console.log(`\nBackup: ${sourceLabel}`);
  if (manifest?.startedAt) console.log(`  izveidots: ${manifest.startedAt}`);
  for (const [label, r] of Object.entries(report.sources)) console.log(`  ${label}: ${r.files} faili → ${r.targetDir}/`);
  console.log(`  pasūtījumu sesijas: ${report.orderSessions} (no tām manuālie: ${report.manualOrderSessions})`);
  console.log(`  rēķinu skaitītājs: ${report.hasInvoiceCounter ? "ir" : "NAV"} · Stripe paid indekss: ${report.hasStripePaidIndex ? "ir" : "NAV"}`);
  if (!report.sources["order-drafts-blob"]) {
    console.log("  ⚠ Snapshot nesatur pasūtījumus no Blob (ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB=0?).");
  }
  if (report.invalidJson.length) console.log(`  ⚠ bojāts JSON: ${report.invalidJson.length}`);
  if (report.unsafePaths.length) console.log(`  ⚠ izlaisti nedroši ceļi: ${report.unsafePaths.length}`);
  for (const w of manifest?.warnings ?? []) console.log(`  manifest brīdinājums: ${w}`);

  if (verifyOnly) {
    console.log("\n--verify-only: faili netika rakstīti.\n");
    if (report.invalidJson.length) process.exitCode = 2;
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(argValue("--out") ?? path.join(root, ".data", "restore-tests", stamp));
  await assertIsolatedOut(outDir);
  await assertEmptyDir(outDir);

  for (const [rel, body] of files) {
    const fp = path.join(outDir, ...rel.split("/"));
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, body, "utf8");
  }
  await fs.writeFile(
    path.join(outDir, "restore-report.json"),
    `${JSON.stringify({ restoredAt: new Date().toISOString(), source: sourceLabel, manifest, report }, null, 2)}\n`,
    "utf8",
  );
  console.log(`\n✓ Atjaunoti ${files.size} faili izolētā mapē: ${outDir}`);
  console.log(`  Pārbaude lokāli: ADMIN_ORDER_DRAFT_DIR=${path.join(outDir, "admin-order-drafts")} ADMIN_ORDER_DRAFT_BLOB_PREFIX= BLOB_READ_WRITE_TOKEN= npm run dev\n`);
  if (report.invalidJson.length) process.exitCode = 2;
}

const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("admin-daily-backup-restore.mjs");
if (isCli) {
  main().catch((err) => {
    console.error("Restore failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
