"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";

type Props = {
  open: boolean;
  href: string;
  title: string;
  closeLabel: string;
  openPdfLabel: string;
  onClose: () => void;
};

/**
 * Full-viewport PDF lightbox using the browser’s native PDF viewer
 * (original colors/shadows — no pdf.js raster distortions).
 */
export function SampleReportLightbox({
  open,
  href,
  title,
  closeLabel,
  openPdfLabel,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const dialogTitleId = useId();
  const paneSrc = `${href}#toolbar=0&navpanes=0&scrollbar=1`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/80 p-0 sm:items-center sm:bg-black/75 sm:p-3 lg:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-zinc-950 shadow-2xl sm:h-[min(92vh,56rem)] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
          <h2 id={dialogTitleId} className="min-w-0 truncate text-sm font-semibold text-zinc-100">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-[#60a5fa] hover:underline"
              onClick={() => recordSampleReportClick()}
            >
              {openPdfLabel}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/40"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white sm:bg-zinc-950">
          <iframe title={title} src={paneSrc} className="absolute inset-0 h-full w-full border-0 bg-white" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
