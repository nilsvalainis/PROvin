#!/usr/bin/env node
/**
 * Atjauno Artis Miļicins PROVIN SELECT melnrakstu no PDF 2026-05-21.
 * Lietošana: node scripts/restore-consultation-artis.mjs <stripe_session_id>
 * Vai: node scripts/restore-consultation-artis.mjs --email (meklē pēc milicins80@gmail.com, vajag STRIPE_SECRET_KEY)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* nav .env.local */
  }
}

async function findSessionByEmail(email) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  let startingAfter;
  for (let page = 0; page < 20; page++) {
    const list = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of list.data) {
      if (s.payment_status !== "paid") continue;
      const meta = s.metadata ?? {};
      if (meta.checkout_line !== "provin_select") continue;
      const em =
        (s.customer_details?.email ?? s.customer_email ?? meta.customer_email ?? "").trim().toLowerCase();
      if (em === email.toLowerCase()) return s.id;
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return null;
}

async function main() {
  loadEnvLocal();
  let sessionId = process.argv[2]?.trim();
  if (sessionId === "--email") {
    sessionId = await findSessionByEmail("milicins80@gmail.com");
    if (!sessionId) {
      console.error("Nav atrasts apmaksāts PROVIN SELECT ar milicins80@gmail.com (Stripe).");
      process.exit(1);
    }
    console.log("Atrasts session:", sessionId);
  }
  if (!sessionId) {
    console.error("Lietošana: node scripts/restore-consultation-artis.mjs <sessionId>");
    console.error("       vai: node scripts/restore-consultation-artis.mjs --email");
    process.exit(1);
  }

  const runTs = path.join(root, "scripts", "_restore-consultation-artis-run.ts");
  const r = spawnSync("npx", ["--yes", "tsx", runTs, sessionId], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);

  const revDir = path.join(root, ".data", "admin-consultation-drafts", "_revisions", sessionId);
  await fs.mkdir(revDir, { recursive: true });
  const doc = await fs.readFile(path.join(root, ".data", "admin-consultation-drafts", `${sessionId}.json`), "utf8");
  const revId = new Date().toISOString().replace(/[:.]/g, "-") + "_recovery";
  await fs.writeFile(
    path.join(revDir, `${revId}.json`),
    JSON.stringify({
      revisionId: revId,
      updatedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      reason: "recovery_artis_pdf_2026_05_21",
      doc: JSON.parse(doc),
    }),
    "utf8",
  );
  console.log("Pārlādē admin konsultācijas lapu šim sessionId.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
