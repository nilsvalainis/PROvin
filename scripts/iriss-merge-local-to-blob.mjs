#!/usr/bin/env node
/**
 * IRISS pasūtījumi: lokālie JSON + (opcionāli) admin eksporta backup → Vercel Blob.
 *
 * Lietošana (projekta saknē, ar produkcijas BLOB_READ_WRITE_TOKEN):
 *   node scripts/iriss-merge-local-to-blob.mjs --load-env-local
 *   node scripts/iriss-merge-local-to-blob.mjs --load-env-local --dry-run
 *   node scripts/iriss-merge-local-to-blob.mjs --load-env-local --dir=.data/iriss-pasutijumi --backup-json=./exports/backup.json
 *   node scripts/iriss-merge-local-to-blob.mjs --load-env-local --bundle-json=.data/iriss-pasutijumi-local-mirror/_all-orders.json
 *
 * Stratēģija pēc noklusējuma: ja Blob jau satur pasūtījumu, augšupielādē tikai tad, ja
 * lokālā `updatedAt` ≥ Blob `updatedAt` (vienāds = pārraksta ar lokālo, lai sinhronizētu saturu).
 * Pilnīgi jauni ID vienmēr tiek augšupielādēti. Beigās pārraksta `iriss-pasutijumi/_list-rows.json`
 * un sapludina `iriss-pasutijumi/_list-order.json` (jauni ID nonāk unpinned beigās).
 *
 * --strategy=newer|local|blob
 *   newer (noklusējums): kā augšāk
 *   local: vienmēr pārraksta Blob ar lokālo kandidātu
 *   blob: augšupielādē tikai trūkstošos ID (esošos Blob neaiztiek)
 */

import { get, list, put } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";

const BLOB_PREFIX = "iriss-pasutijumi/";
const LIST_ORDER = "_list-order.json";
const LIST_ROWS = "_list-rows.json";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id) {
  return typeof id === "string" && id.length <= 64 && UUID_RE.test(id);
}

function parseArgs(argv) {
  const flags = new Set();
  const dirs = [];
  let backupJson = null;
  let bundleJson = null;
  let strategy = "newer";
  let throttleMs = 0;
  for (const a of argv) {
    if (a === "--dry-run") flags.add("dry-run");
    else if (a === "--load-env-local") flags.add("load-env-local");
    else if (a.startsWith("--dir=")) dirs.push(path.resolve(a.slice("--dir=".length)));
    else if (a.startsWith("--backup-json=")) backupJson = path.resolve(a.slice("--backup-json=".length));
    else if (a.startsWith("--bundle-json=")) bundleJson = path.resolve(a.slice("--bundle-json=".length));
    else if (a.startsWith("--strategy=")) strategy = a.slice("--strategy=".length).trim().toLowerCase();
    else if (a.startsWith("--throttle-ms=")) throttleMs = Math.max(0, Number.parseInt(a.slice("--throttle-ms=".length), 10) || 0);
  }
  if (!["newer", "local", "blob"].includes(strategy)) {
    console.error("Unknown --strategy (use newer, local, or blob).");
    process.exit(1);
  }
  return { flags, dirs, backupJson, bundleJson, strategy, throttleMs };
}

async function loadEnvLocal() {
  const fp = path.join(process.cwd(), ".env.local");
  const txt = await fs.readFile(fp, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function readJsonBlob(token, pathname) {
  const res = await get(pathname, { access: "private", token, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream).text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function listAllOrderIds(token) {
  const ids = new Set();
  let cursor;
  const prefix = BLOB_PREFIX;
  do {
    const page = await list({ token, prefix, cursor, limit: 1000, mode: "expanded" });
    for (const b of page.blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      if (!b.pathname.startsWith(prefix)) continue;
      const rel = b.pathname.slice(prefix.length);
      if (rel.startsWith("_")) continue;
      const id = rel.slice(0, -".json".length);
      if (isUuid(id)) ids.add(id);
    }
    if (page.hasMore && !page.cursor) break;
    cursor = page.hasMore && page.cursor ? page.cursor : undefined;
  } while (cursor);
  return ids;
}

function rowFromRecord(rec) {
  const other = Array.isArray(rec.listingLinksOther) ? [...rec.listingLinksOther] : [""];
  return {
    id: rec.id,
    createdAt: typeof rec.createdAt === "string" ? rec.createdAt : "",
    updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : "",
    pinnedAt: typeof rec.pinnedAt === "string" ? rec.pinnedAt : "",
    brandModel: (typeof rec.brandModel === "string" ? rec.brandModel : "").trim() || "—",
    totalBudget: (typeof rec.totalBudget === "string" ? rec.totalBudget : "").trim() || "—",
    phone: (typeof rec.phone === "string" ? rec.phone : "").trim() || "—",
    listingLinkMobile: typeof rec.listingLinkMobile === "string" ? rec.listingLinkMobile : "",
    listingLinkAutobid: typeof rec.listingLinkAutobid === "string" ? rec.listingLinkAutobid : "",
    listingLinkOpenline: typeof rec.listingLinkOpenline === "string" ? rec.listingLinkOpenline : "",
    listingLinkAuto1: typeof rec.listingLinkAuto1 === "string" ? rec.listingLinkAuto1 : "",
    listingLinksOther: other.length ? other : [""],
  };
}

function sortRows(rows) {
  rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return rows;
}

function parseListOrder(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
  const norm = (arr) => {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      if (typeof x !== "string" || !isUuid(x) || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  };
  return {
    pinnedOrder: norm(o.pinnedOrder),
    unpinnedOrder: norm(o.unpinnedOrder),
  };
}

function mergeListOrder(existing, allIds) {
  const allIdsSet = new Set(allIds);
  const pinnedOrder = (existing?.pinnedOrder ?? []).filter((id) => allIdsSet.has(id));
  const pset = new Set(pinnedOrder);
  const unpinned = (existing?.unpinnedOrder ?? []).filter((id) => allIdsSet.has(id) && !pset.has(id));
  const seen = new Set([...pinnedOrder, ...unpinned]);
  for (const id of allIdsSet) {
    if (!seen.has(id)) {
      unpinned.push(id);
      seen.add(id);
    }
  }
  return { version: 1, pinnedOrder, unpinnedOrder: unpinned };
}

async function readLocalOrderFiles(dir) {
  const out = new Map();
  let names = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("_")) continue;
    const id = name.slice(0, -".json".length);
    if (!isUuid(id)) continue;
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
      if (raw && typeof raw === "object" && raw.id === id) out.set(id, raw);
    } catch {
      /* skip */
    }
  }
  return out;
}

async function readBackupOrderDrafts(backupPath) {
  const out = new Map();
  const txt = await fs.readFile(backupPath, "utf8");
  const payload = JSON.parse(txt);
  const drafts = payload?.orderDrafts;
  if (!drafts || typeof drafts !== "object") return out;
  for (const [name, content] of Object.entries(drafts)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (!isUuid(id)) continue;
    try {
      const raw = typeof content === "string" ? JSON.parse(content) : content;
      if (raw && typeof raw === "object" && raw.id === id) out.set(id, raw);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Lokālais `_all-orders.json` (writeLocalMirrorFullBundle). */
async function readBundleRecords(bundlePath) {
  const out = new Map();
  const txt = await fs.readFile(bundlePath, "utf8");
  const payload = JSON.parse(txt);
  const records = payload?.records;
  if (!Array.isArray(records)) return out;
  for (const raw of records) {
    if (!raw || typeof raw !== "object") continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!isUuid(id) || raw.id !== id) continue;
    out.set(id, raw);
  }
  return out;
}

function mergeCandidates(maps) {
  /** @type {Map<string, object>} */
  const merged = new Map();
  for (const m of maps) {
    for (const [id, rec] of m) {
      const prev = merged.get(id);
      if (!prev) {
        merged.set(id, rec);
        continue;
      }
      const a = typeof prev.updatedAt === "string" ? prev.updatedAt : "";
      const b = typeof rec.updatedAt === "string" ? rec.updatedAt : "";
      merged.set(id, b >= a ? rec : prev);
    }
  }
  return merged;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { flags, dirs: dirsArg, backupJson, bundleJson, strategy, throttleMs } = parseArgs(
    process.argv.slice(2),
  );
  const dry = flags.has("dry-run");

  if (flags.has("load-env-local")) {
    try {
      await loadEnvLocal();
    } catch (e) {
      console.error("Could not read .env.local:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  }

  const token = (process.env.BLOB_READ_WRITE_TOKEN ?? "").trim();
  if (!token) {
    console.error("Missing BLOB_READ_WRITE_TOKEN (use Vercel env or --load-env-local with token in .env.local).");
    process.exit(1);
  }

  const dirs = [...dirsArg];
  if (dirs.length === 0) {
    for (const rel of [".data/iriss-pasutijumi", ".data/iriss-pasutijumi-local-mirror"]) {
      const abs = path.join(process.cwd(), rel);
      try {
        await fs.access(abs);
        dirs.push(abs);
      } catch {
        /* skip */
      }
    }
  }

  if (dirs.length === 0 && !backupJson && !bundleJson) {
    console.error(
      "No --dir=… and no default .data dirs found; provide --dir, --backup-json, and/or --bundle-json.",
    );
    process.exit(1);
  }

  /** @type {Map<string, object>[]} */
  const maps = [];
  for (const d of dirs) {
    const m = await readLocalOrderFiles(d);
    console.log(`Dir ${d}: ${m.size} order file(s).`);
    maps.push(m);
  }
  if (backupJson) {
    const m = await readBackupOrderDrafts(backupJson);
    console.log(`Backup ${backupJson}: ${m.size} order draft(s).`);
    maps.push(m);
  }
  if (bundleJson) {
    const m = await readBundleRecords(bundleJson);
    console.log(`Bundle ${bundleJson}: ${m.size} record(s).`);
    maps.push(m);
  }

  const candidates = mergeCandidates(maps);
  console.log(`Merged local/backup candidates: ${candidates.size} unique id(s). Strategy: ${strategy}.`);

  let uploaded = 0;
  let skipped = 0;

  for (const [id, localRec] of candidates) {
    const pathname = `${BLOB_PREFIX}${id}.json`;
    const blobRec = await readJsonBlob(token, pathname);
    const localU = typeof localRec.updatedAt === "string" ? localRec.updatedAt : "";
    const blobU =
      blobRec && typeof blobRec.updatedAt === "string" ? blobRec.updatedAt : "";

    let shouldPut = false;
    if (strategy === "local") shouldPut = true;
    else if (strategy === "blob") shouldPut = !blobRec;
    else shouldPut = !blobRec || localU >= blobU;

    if (!shouldPut) {
      skipped += 1;
      continue;
    }

    const body = `${JSON.stringify(localRec, null, 2)}\n`;
    if (dry) {
      console.log(`[dry-run] put ${pathname} (${blobRec ? "overwrite" : "create"})`);
    } else {
      await put(pathname, body, {
        access: "private",
        token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      if (throttleMs) await sleep(throttleMs);
    }
    uploaded += 1;
  }

  console.log(`Records: uploaded ${uploaded}, skipped (kept blob) ${skipped}.`);

  if (dry) {
    console.log("[dry-run] Skipped _list-rows.json / _list-order.json rebuild (run without --dry-run to finish).");
    console.log("Dry run complete.");
    return;
  }

  const allIds = [...(await listAllOrderIds(token))];
  for (const [id] of candidates) {
    if (!allIds.includes(id)) allIds.push(id);
  }

  const rows = [];
  for (const id of allIds) {
    const pathname = `${BLOB_PREFIX}${id}.json`;
    const rec = await readJsonBlob(token, pathname);
    if (rec && typeof rec === "object" && rec.id === id) rows.push(rowFromRecord(rec));
    if (throttleMs) await sleep(throttleMs);
  }
  sortRows(rows);

  const listOrderPath = `${BLOB_PREFIX}${LIST_ORDER}`;
  const listRowsPath = `${BLOB_PREFIX}${LIST_ROWS}`;
  const rawOrder = await readJsonBlob(token, listOrderPath);
  const existingOrder = parseListOrder(rawOrder);
  const mergedOrder = mergeListOrder(existingOrder, allIds);
  const orderBody = `${JSON.stringify(mergedOrder, null, 2)}\n`;
  const rowsBody = `${JSON.stringify(rows, null, 2)}\n`;

  await put(listRowsPath, rowsBody, {
    access: "private",
    token,
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  await put(listOrderPath, orderBody, {
    access: "private",
    token,
    contentType: "application/json; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log("Done. Ja admin saraksts vēl rāda veco kešu, pagaidi ~5 min vai samazini IRISS_PASUTIJUMI_BLOB_LIST_CACHE_TTL_MS deploy vidē.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
