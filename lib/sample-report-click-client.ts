"use client";

import { track } from "@vercel/analytics";
import { TP5_AUDITS_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

/** Reģistrē AUDITS PDF piemēra klikšķi (fire-and-forget) + Vercel Analytics notikumu. */
export function recordSampleReportClick(): void {
  try {
    track("sample_report_click", { product: "audits" });
  } catch {
    /* ignore */
  }

  const body = JSON.stringify({ source: "hero", product: "audits" });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/sample-report-click", blob)) return;
    }
  } catch {
    /* fall through */
  }

  void fetch("/api/sample-report-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}

export { TP5_AUDITS_SAMPLE_REPORT_HREF };
