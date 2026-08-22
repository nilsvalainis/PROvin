#!/usr/bin/env node
/**
 * Iegūst stila korpusa kandidātus no gatavajiem komentāriem.
 * Lietošana: npm run style:corpus:mine
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
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* nav .env.local */
  }
}

loadEnvLocal();

const runTs = path.join(root, "scripts", "_mine-style-corpus-run.ts");
const extraArgs = process.argv.slice(2).filter((a) => a !== "--load-env-local");
const r = spawnSync("npx", ["--yes", "tsx", runTs, ...extraArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(r.status ?? 1);
