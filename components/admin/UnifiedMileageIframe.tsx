"use client";

import { useMemo } from "react";
import { buildUnifiedMileageTableHtml, getClientReportPrintCss } from "@/lib/client-report-html";
import { toPdfManualVendorBlocks, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

export function UnifiedMileageIframe({ blocks }: { blocks: WorkspaceSourceBlocks }) {
  const srcDoc = useMemo(() => {
    const html = buildUnifiedMileageTableHtml({
      csddForm: blocks.csdd,
      autoRecordsBlock: blocks.auto_records,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      citiAvotiBlock: blocks.citi_avoti,
    });
    if (!html) return "";
    return `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/><style>${getClientReportPrintCss()}</style></head><body class="provin-report-doc">${html}</body></html>`;
  }, [blocks]);

  if (!srcDoc) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-apple-text)]">
        Nobraukuma vēsture (PDF atbilstība)
      </p>
      <iframe
        title="Nobraukuma vēsture"
        srcDoc={srcDoc}
        className="h-[min(480px,70vh)] w-full border-0"
        sandbox="allow-same-origin"
      />
    </div>
  );
}
