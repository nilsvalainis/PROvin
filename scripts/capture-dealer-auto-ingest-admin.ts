/**
 * Preview screenshots: admin dīlera automātiskās ielases josla
 * (kļūda + Atkārtot, gatavs komentārs).
 *
 *   npx vite-node -c vitest.config.ts scripts/capture-dealer-auto-ingest-admin.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  DEALER_DATA_RETRY_NO_RECHARGE_HINT,
  dealerDataRetryButtonLabel,
  describeDealerDataJob,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";

const outDir = process.env.DEALER_INGEST_CAPTURE_OUT ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

const now = "2026-10-19T12:00:00.000Z";

function job(patch: Partial<DealerDataJob>): DealerDataJob {
  return {
    sessionId: "manual_order_preview",
    vin: "WAUZZZ4M0JD000001",
    status: "pending",
    attempts: 1,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

const STATUS_TONE: Record<DealerDataJob["status"], string> = {
  pending: "background:#fffbeb;color:#b45309;border:1px solid #fde68a",
  running: "background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd",
  done: "background:#ecfdf5;color:#047857;border:1px solid #a7f3d0",
  no_data: "background:#fff7ed;color:#c2410c;border:1px solid #fed7aa",
  failed: "background:#fff1f2;color:#be123c;border:1px solid #fecdd3",
};

function stripHtml(j: DealerDataJob, extra: string): string {
  const retry = dealerDataRetryButtonLabel(j);
  const retryStyle =
    j.status === "failed"
      ? "border:1px solid #fda4af;background:#fff;color:#be123c"
      : "border:1px solid #cbd5e1;background:#fff;color:#334155";
  return `<section style="margin:0 0 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:8px">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#64748b">Automātiskā ielase</span>
      <span style="border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600;${STATUS_TONE[j.status]}">${describeDealerDataJob(j)}</span>
      ${extra}
    </div>
    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">
      <button type="button" style="${retryStyle};border-radius:6px;padding:4px 8px;font-size:10px;font-weight:600">${retry}</button>
    </div>
  </section>`;
}

const failed = job({
  status: "failed",
  error: "api_unavailable",
  paidOutcomes: { oe_vin_lookup: "ok", oe_service_history: "failed" },
  commentLang: "en",
});
const done = job({
  status: "done",
  serviceEventCount: 12,
  aiGenerated: true,
  commentLang: "en",
  paidOutcomes: { oe_vin_lookup: "ok", oe_service_history: "ok" },
});

const html = `<!doctype html>
<html lang="lv"><head><meta charset="utf-8">
<title>PROVIN admin - dīlera automātiskā ielase</title>
<style>
  body{margin:0;padding:20px;background:#f1f5f9;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a}
  h1{margin:0 0 4px;font-size:14px}
  p.hint{margin:0 0 16px;font-size:11px;color:#64748b;max-width:520px}
</style></head>
<body>
  <h1>PROVIN admin · dīlera RAW/PRO ielase</h1>
  <p class="hint">${DEALER_DATA_RETRY_NO_RECHARGE_HINT}</p>
  ${stripHtml(failed, "")}
  ${stripHtml(done, `<span style="font-size:10px;color:#64748b">AI melnraksti sagatavoti (EN)</span>`)}
</body></html>`;

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome",
});
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 720, height: 420 },
});
await page.setContent(html, { waitUntil: "load" });
const pngPath = join(outDir, "dealer-auto-ingest-admin.png");
await page.screenshot({ path: pngPath, type: "png" });
await page.locator("section").first().screenshot({
  path: join(outDir, "dealer-auto-ingest-retry.png"),
  type: "png",
});
await page.locator("section").nth(1).screenshot({
  path: join(outDir, "dealer-auto-ingest-ready.png"),
  type: "png",
});
await browser.close();
console.log(`PNG: ${pngPath}`);
