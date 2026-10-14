#!/usr/bin/env node
/**
 * Admin panel performance report: Next build route sizes + optional local API timings.
 * Usage: node scripts/admin-perf-report.mjs [--json]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ADMIN_ROUTE_RE =
  /^(?:○|ƒ|λ)\s+\/admin(?:\/dashboard|\/iriss\/pasutijumi|\/iriss\/scan|\/iriss\/sludinajumi)?\s/;

function runBuild() {
  const r = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function parseRouteSizes(buildLog) {
  const lines = buildLog.split("\n");
  const routes = [];
  for (const line of lines) {
    if (!line.includes("/admin")) continue;
    const m = line.match(
      /^(?<sym>[○ƒλ])\s+(?<route>\/admin[^\s]*)\s+(?<size>\d+(?:\.\d+)?\s*k?B)\s+(?<first>\d+(?:\.\d+)?\s*k?B)/,
    );
    if (!m?.groups) continue;
    routes.push({
      route: m.groups.route,
      sym: m.groups.sym,
      size: m.groups.size,
      firstLoadJs: m.groups.first,
    });
  }
  return routes;
}

function sumFirstLoadKb(routes, filterRe) {
  let sum = 0;
  for (const r of routes) {
    if (filterRe && !filterRe.test(r.route)) continue;
    const n = parseFloat(r.firstLoadJs.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 10) / 10;
}

const jsonOut = process.argv.includes("--json");
const skipBuild = process.argv.includes("--skip-build");

let buildLog = "";
if (!skipBuild) {
  const { ok, stdout, stderr } = runBuild();
  buildLog = `${stdout}\n${stderr}`;
  if (!ok) {
    console.error(buildLog.slice(-8000));
    process.exit(1);
  }
} else {
  const logPath = path.join(process.cwd(), ".admin-perf-build.log");
  if (!fs.existsSync(logPath)) {
    console.error("Missing .admin-perf-build.log — run without --skip-build first");
    process.exit(1);
  }
  buildLog = fs.readFileSync(logPath, "utf8");
}

const routes = parseRouteSizes(buildLog);
const keyRoutes = [
  "/admin/dashboard",
  "/admin/iriss/pasutijumi",
  "/admin/iriss/scan",
  "/admin/iriss/sludinajumi",
];
const picked = keyRoutes.map((route) => routes.find((r) => r.route === route) ?? { route, firstLoadJs: "n/a", size: "n/a" });

const report = {
  at: new Date().toISOString(),
  adminRoutesFound: routes.length,
  keyRoutes: picked,
  firstLoadJsSumKb: sumFirstLoadKb(routes, /^\/admin/),
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("PROVIN admin perf report", report.at);
  for (const r of picked) {
    console.log(`  ${r.route}: First Load JS ${r.firstLoadJs}, route ${r.size}`);
  }
  console.log(`  Sum First Load JS (all /admin routes in build log): ~${report.firstLoadJsSumKb} kB`);
}

fs.writeFileSync(path.join(process.cwd(), ".admin-perf-report.json"), JSON.stringify(report, null, 2));
