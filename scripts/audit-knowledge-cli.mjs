#!/usr/bin/env node
/**
 * Agregātu atmiņa bez browsera:
 *   npm run audit:knowledge -- status
 *   npm run audit:knowledge -- backfill
 *   npm run audit:knowledge -- promote
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      const v = t
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const runTs = path.join(root, "scripts", "_audit-knowledge-run.ts");
const stub = path.join(root, "scripts", "stub-server-only.mjs");
const extraArgs = process.argv.slice(2).filter((a) => a !== "--load-env-local");
const r = spawnSync(
  "npx",
  ["--yes", "tsx", "--import", stub, runTs, ...extraArgs],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);
process.exit(r.status ?? 1);
