#!/usr/bin/env node
// Pavadzīmju pieprasījumu rindas tīrīšana (tikai admin: vajag Vercel Blob BLOB_READ_WRITE_TOKEN).
// 1) VIENMĒR vispirms raksta pilnu JSON backup (visi pieprasījumi + notikumi) uz --backup-dir;
// 2) parāda, ko dzēstu (dry-run pēc noklusējuma);
// 3) tikai ar --apply raksta iztīrīto dokumentu ar ifMatch (ja kāds tikmēr rakstīja - atsakās, palaid vēlreiz).
// Idempotents: otrā palaišana neko nedzēš. Izdotas/aktīvas pavadzīmes nekad netiek dzēstas (cleanup-waybill-requests-core.mjs).
//
//   node scripts/iriss-ttr/cleanup-waybill-requests.mjs --load-env-local            # dry-run + backup
//   node scripts/iriss-ttr/cleanup-waybill-requests.mjs --load-env-local --apply    # backup + dzēš
// Bez tokena strādā ar lokālo .data/iriss-waybill-requests/queue.json (izstrādei). Tokenu neizdrukā.

import fs from "node:fs/promises";
import path from "node:path";
import { planWaybillCleanup } from "./cleanup-waybill-requests-core.mjs";

const BLOB_PATH = "iriss-waybill-requests/queue.json";
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const root = process.cwd();
const backupDir = path.resolve(argValue("--backup-dir") || path.join(root, ".data", "waybill-requests-backups"));

async function loadEnvLocal() {
  const txt = await fs.readFile(path.join(root, ".env.local"), "utf8").catch(() => "");
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
}

function strongEtag(raw) {
  const t = String(raw || "").trim();
  return t ? t.replace(/^W\//i, "") : null;
}

async function blobStore(token) {
  const { get, put } = await import("@vercel/blob");
  return {
    where: `Vercel Blob ${BLOB_PATH}`,
    async read() {
      const res = await get(BLOB_PATH, { access: "private", token, useCache: false });
      if (!res || res.statusCode === 404 || !res.stream) throw new Error("rindas dokuments nav atrasts");
      const text = await new Response(res.stream).text();
      const etag = strongEtag(res.blob?.etag);
      if (!etag) throw new Error("nav ETag - nerakstu");
      return { text, etag };
    },
    async write(body, etag) {
      await put(BLOB_PATH, body, {
        access: "private",
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
        ifMatch: etag,
        contentType: "application/json",
      });
    },
  };
}

function fileStore() {
  const file = path.join(root, ".data", "iriss-waybill-requests", "queue.json");
  return {
    where: file,
    async read() {
      const text = await fs.readFile(file, "utf8");
      return { text, etag: text };
    },
    async write(body, etag) {
      if ((await fs.readFile(file, "utf8")) !== etag) throw new Error("dokuments mainījās - palaid vēlreiz");
      await fs.writeFile(`${file}.tmp`, body, "utf8");
      await fs.rename(`${file}.tmp`, file);
    },
  };
}

async function main() {
  if (args.includes("--load-env-local")) await loadEnvLocal();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const store = token ? await blobStore(token) : fileStore();
  const { text, etag } = await store.read();
  const doc = JSON.parse(text);
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.requests)) throw new Error("dokuments nav pavadzīmju rinda - nerakstu");

  // 1) Backup VIENMĒR pirms jebkā cita.
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `iriss-waybill-requests-${stamp}.json`);
  await fs.writeFile(backupFile, text, { encoding: "utf8", mode: 0o600 });
  const check = JSON.parse(await fs.readFile(backupFile, "utf8"));
  if (!Array.isArray(check.requests) || check.requests.length !== doc.requests.length) throw new Error("backup nesakrīt - nerakstu");

  const plan = planWaybillCleanup(doc);
  console.log(`Avots: ${store.where}`);
  console.log(`Backup: ${backupFile} (${doc.requests.length} pieprasījumi, ${Array.isArray(doc.events) ? doc.events.length : 0} notikumi)`);
  console.log(`Paliek: ${plan.kept}. Dzēšamie: ${plan.removed.length} pieprasījumi, ${plan.removedEvents} notikumi.`);
  for (const r of plan.removed) console.log(`  - ${r.id} ${r.status} ${r.plate} ${r.brandModel} (${r.reason})`);
  if (!plan.removed.length && !plan.removedEvents) {
    console.log("Nav ko tīrīt.");
    return;
  }
  if (!APPLY) {
    console.log("Dry-run: nekas netika mainīts. Lai dzēstu, palaid ar --apply.");
    return;
  }
  const next = { ...plan.next, updatedAt: new Date().toISOString() };
  await store.write(JSON.stringify(next), etag);
  console.log(`Iztīrīts. Atjaunošana: ieraksti backup failu atpakaļ ${store.where}.`);
}

main().catch((err) => {
  console.error(`Kļūda: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
