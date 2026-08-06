"use client";

import { Expand, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";

type Props = {
  href?: string;
  title: string;
  enlargeLabel: string;
  closeLabel: string;
  previewLabel: string;
  openPdfLabel: string;
  comingSoonLabel: string;
};

/** Renders PDF page 1 as a static, non-interactive bitmap (no zoom/scroll). */
function StaticFirstPagePreview({ href, title, previewLabel }: { href: string; title: string; previewLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument({ url: href, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const parent = canvas.parentElement;
        const cssWidth = Math.max(280, Math.floor(parent?.clientWidth ?? 320));
        const unscaled = page.getViewport({ scale: 1 });
        const scale = cssWidth / unscaled.width;
        const viewport = page.getViewport({ scale });

        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          return;
        }
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        await page.render({ canvasContext: ctx, viewport, transform }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [href]);

  if (failed) {
    /* Fallback: embed first page, interaction blocked by parent overlay. */
    return (
      <iframe
        title={`${title} — ${previewLabel}`}
        src={`${href}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
        className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-zinc-950"
        loading="lazy"
        tabIndex={-1}
        aria-hidden
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none mx-auto block h-auto max-h-full w-full object-contain object-top"
      aria-hidden
    />
  );
}

/** Inline: static first-page fit, no scroll. Lightbox (Pietuvināt): full scrollable PDF. */
export function SampleReportPreview({
  href,
  title,
  enlargeLabel,
  closeLabel,
  previewLabel,
  openPdfLabel,
  comingSoonLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogTitleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openLightbox = () => {
    if (!href) return;
    recordSampleReportClick();
    setOpen(true);
  };

  const lightboxSrc = href ? `${href}#toolbar=0&navpanes=0&scrollbar=1` : null;

  return (
    <>
      <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <p
            id={titleId}
            className="min-w-0 truncate text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-zinc-400"
          >
            {previewLabel}
          </p>
          {href ? (
            <button
              type="button"
              onClick={openLightbox}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-[#60a5fa] transition hover:bg-white/5 hover:text-[#93c5fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/40"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Expand className="h-3.5 w-3.5" aria-hidden />
              {enlargeLabel}
            </button>
          ) : null}
        </div>

        <div className="relative h-[min(22rem,48vh)] w-full overflow-hidden overscroll-none bg-zinc-950 sm:h-[min(28rem,52vh)] lg:h-[36rem]">
          {href ? (
            <>
              <div className="absolute inset-0 flex items-start justify-center overflow-hidden">
                <StaticFirstPagePreview href={href} title={title} previewLabel={previewLabel} />
              </div>
              {/* Block pan/zoom/scroll until Pietuvināt. */}
              <div
                className="absolute inset-0 z-[1] touch-none select-none"
                aria-hidden
                onWheel={(e) => e.preventDefault()}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-sm font-medium text-zinc-500">{comingSoonLabel}</p>
            </div>
          )}
        </div>
      </div>

      {mounted && open && lightboxSrc
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-6"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={dialogTitleId}
                className="flex h-[min(92vh,56rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
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
                      onClick={() => setOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/40"
                      aria-label={closeLabel}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-zinc-950">
                  <iframe
                    title={`${title} — ${previewLabel}`}
                    src={lightboxSrc}
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
