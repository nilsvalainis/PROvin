"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import type { ReportPreviewTab } from "@/lib/client-report-html";

/**
 * «Priekšskats» (Nils 26.11): nobraukuma un negadījumu tabulas tieši kā PDF (tas pats HTML un CSS),
 * bez Chromium un bez PDF faila. Datorā logs lapā, telefonā pilnekrāns ar ×.
 */

export type ReportPreviewHtml = Partial<Record<ReportPreviewTab, string>>;

/** PDF lapas platums ekrānā (210 mm). Šaurākā logā (iPhone) iframe tiek mērogots - izkārtojums kā PDF. */
const A4_PX = 794;

const TABS: { id: ReportPreviewTab; label: string }[] = [
  { id: "all", label: "Viss" },
  { id: "mileage", label: "Nobraukums" },
  { id: "incidents", label: "Negadījumi" },
];

export function AdminReportPreviewDialog({
  open,
  vin,
  html,
  busy,
  error,
  onClose,
}: {
  open: boolean;
  vin: string;
  html: ReportPreviewHtml | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ReportPreviewTab>("all");
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: A4_PX, h: 600 });
  useAdminScrollLock(open);

  useEffect(() => {
    const el = boxRef.current;
    if (!open || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [open, busy, error]);

  useEffect(() => {
    if (!open) return;
    setTab("all");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const doc = html?.[tab] ?? "";
  const scale = box.w > 0 && box.w < A4_PX ? box.w / A4_PX : 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[#0f172a66] md:items-center md:p-6"
      role="presentation"
      onClick={onClose}
      data-report-preview
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Priekšskats"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white md:h-[min(88dvh,980px)] md:max-w-[880px] md:rounded-2xl md:shadow-2xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[#F3F4F6] py-1 pl-4 pr-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#1d1d1f]">
            Priekšskats
            {vin ? <span className="ml-2 font-medium tabular-nums text-[#86868b]">{vin}</span> : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[22px] leading-none text-[#475569]"
            aria-label="Aizvērt"
          >
            ×
          </button>
        </div>
        <div className="flex shrink-0 gap-1 border-b border-[#F3F4F6] px-3 py-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-8 rounded-lg px-3 text-[12px] font-semibold ${
                tab === t.id ? "bg-[#1d1d1f] text-white" : "text-[#475569] hover:bg-black/[0.04]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#f5f5f7]">
          {busy ? (
            <p className="p-4 text-[13px] font-medium text-[#86868b]">Gatavo…</p>
          ) : error ? (
            <p className="p-4 text-[13px] font-medium text-[#b42318]">{error}</p>
          ) : (
            <iframe
              key={tab}
              title="Priekšskats"
              srcDoc={doc}
              sandbox=""
              className="block border-0 bg-white"
              style={
                scale < 1
                  ? { width: A4_PX, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: "0 0" }
                  : { width: "100%", height: "100%" }
              }
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
