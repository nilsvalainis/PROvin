#!/usr/bin/env node
/**
 * Lēts audit knowledge pipeline — **bez** Claude/Gemini API.
 *
 * Primāri (Vercel / lokāli ar login):
 *   POST /api/admin/audit-knowledge  { "action": "backfill", "limit": 120 }
 *   POST /api/admin/audit-knowledge  { "action": "promote" }
 *
 * Lokāli promote no jau esošā learnings JSON (bez Next):
 *   node scripts/audit-knowledge-pipeline.mjs --load-env-local promote
 *
 * backfill prasa Next servera moduli → izmanto API (vai `npm run audit:knowledge:api`).
 */
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const LEARNINGS_FILENAME = "provin_audit_aggregate_learnings.json";

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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

function resolveDraftsDir() {
  const env = (process.env.ADMIN_ORDER_DRAFT_DIR ?? "").trim();
  if (env && env !== "0" && env.toLowerCase() !== "off") return path.resolve(env);
  return path.join(root, ".data", "admin-order-drafts");
}

function normalizeEntries(raw) {
  if (!raw || typeof raw !== "object" || !raw.entries || typeof raw.entries !== "object") return [];
  const out = [];
  for (const [key, val] of Object.entries(raw.entries)) {
    if (!val || typeof val !== "object") continue;
    const snippets = Array.isArray(val.snippets)
      ? val.snippets.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 420))
      : [];
    if (!snippets.length) continue;
    out.push({
      key,
      label: typeof val.label === "string" ? val.label.slice(0, 120) : key,
      updatedAt: typeof val.updatedAt === "string" ? val.updatedAt : new Date(0).toISOString(),
      snippets: snippets.slice(0, 12),
    });
  }
  return out.sort((a, b) => b.snippets.length - a.snippets.length);
}

function buildCandidates(entries, minSnippets = 3, maxCandidates = 24) {
  return entries
    .filter((e) => e.snippets.length >= minSnippets)
    .slice(0, maxCandidates)
    .map((e) => ({
      key: e.key,
      label: e.label,
      snippetCount: e.snippets.length,
      topSnippets: e.snippets.slice(-3),
    }));
}

function formatMd(candidates, sourceEntryCount) {
  const lines = [
    "# PROVIN audit knowledge — promotion candidates",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source keys with enough snippets: ${sourceEntryCount}`,
    "",
    "Token rule: review **only this file**. Do not dump full order drafts into Claude.",
    "Promote into `provin-admin-prompt-engineering/reference.md` + `lib/provin-aggregate-case-rules.ts`.",
    "",
  ];
  if (!candidates.length) {
    lines.push("_No candidates yet — run API backfill first._");
    return `${lines.join("\n")}\n`;
  }
  for (const c of candidates) {
    lines.push(`## ${c.label}`);
    lines.push(`- key: \`${c.key}\``);
    lines.push(`- snippets: ${c.snippetCount}`);
    lines.push("- distill:");
    for (const s of c.topSnippets) lines.push(`  - ${s}`);
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

async function promoteLocal() {
  const dir = resolveDraftsDir();
  const learningsPath = path.join(dir, LEARNINGS_FILENAME);
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(learningsPath, "utf8"));
  } catch {
    console.error(`Nav atrasts ${learningsPath}. Vispirms: API backfill.`);
    process.exit(1);
  }
  const entries = normalizeEntries(raw);
  const candidates = buildCandidates(entries);
  let md = formatMd(candidates, entries.length);
  if (md.length > 12_000) md = `${md.slice(0, 11_960).trim()}\n\n…[truncated for token budget]\n`;

  const outDir = dir;
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "audit-knowledge-candidates.md");
  await fs.writeFile(outPath, md, "utf8");
  console.log("[promote]", { candidateCount: candidates.length, markdownChars: md.length, outputPath: outPath });
}

function printApiHelp() {
  console.log(`Backfill (skenē pasūtījumus → learnings) — tikai caur admin API (bez dārgā LLM):

  curl -X POST "$BASE/api/admin/audit-knowledge" \\
    -H "Cookie: <admin session>" -H "Content-Type: application/json" \\
    -d '{"action":"backfill","limit":120}'

  curl -X POST "$BASE/api/admin/audit-knowledge" \\
    -H "Cookie: <admin session>" -H "Content-Type: application/json" \\
    -d '{"action":"promote"}'

Promote lokāli no jau esoša JSON: node scripts/audit-knowledge-pipeline.mjs promote
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--load-env-local")) await loadEnvLocal();
  const cmd = args.find((a) => !a.startsWith("-")) ?? "help";

  if (cmd === "promote") {
    await promoteLocal();
    return;
  }
  if (cmd === "backfill" || cmd === "all") {
    console.log("backfill nav pieejams tīrā Node bez Next (server-only store).");
    printApiHelp();
    process.exit(cmd === "all" ? 0 : 1);
  }
  printApiHelp();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
