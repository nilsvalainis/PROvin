"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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

const DESKTOP_MQ = "(min-width: 1024px)";

function useIsDesktopLightbox() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isDesktop;
}

/**
 * Mobile: render each PDF page at the dialog width (screen-fit) via pdf.js.
 * Avoids iOS Safari’s zoomed native PDF iframe / new-tab viewer.
 */
function MobileFitWidthPdfPages({ href }: { href: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument({ url: href, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        host.replaceChildren();
        const cssWidth = Math.max(280, Math.floor(host.clientWidth));
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const base = page.getViewport({ scale: 1 });
          const scale = cssWidth / base.width;
          const viewport = page.getViewport({ scale: scale * outputScale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${Math.floor(base.height * scale)}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto";
          canvas.style.background = "#fff";
          canvas.setAttribute("aria-hidden", "true");
          host.appendChild(canvas);

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;

          if (pageNum < pdf.numPages) {
            const spacer = document.createElement("div");
            spacer.style.height = "0.5rem";
            spacer.setAttribute("aria-hidden", "true");
            host.appendChild(spacer);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [href]);

  if (error) {
    return (
      <iframe
        title="PDF"
        src={`${href}#toolbar=0&navpanes=0&view=FitH`}
        className="absolute inset-0 h-full w-full border-0 bg-white"
      />
    );
  }

  return <div ref={hostRef} className="w-full min-h-full bg-zinc-300" />;
}

export function SampleReportLightbox({
  open,
  href,
  title,
  closeLabel,
  openPdfLabel,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const isDesktop = useIsDesktopLightbox();
  const dialogTitleId = useId();

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
              className="hidden rounded-md px-2 py-1 text-[0.75rem] font-medium text-[#60a5fa] hover:underline sm:inline"
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
        <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-zinc-300 sm:bg-zinc-950">
          {isDesktop ? (
            <iframe
              title={title}
              src={`${href}#toolbar=0&navpanes=0&scrollbar=1`}
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <MobileFitWidthPdfPages href={href} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
