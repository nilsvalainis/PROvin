"use client";

import { Expand, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
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

/** lg breakpoint — desktop keeps the original scrollable iframe preview. */
const DESKTOP_MQ = "(min-width: 1024px)";

/**
 * Sample pages are A4-ish. Mobile preview height follows this ratio so Safari’s
 * width-fit PDF paint shows the whole first page — no CSS scale (broken for
 * iOS PDF plugins) and no raster (harsh soft-mask shadows).
 */
const PDF_PAGE_ASPECT = "1400 / 1981";

/** Defaults to desktop so web never flashes the mobile preview layout. */
function useIsDesktopPreview() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return isDesktop;
}

type MobileNativeProps = {
  href: string;
  title: string;
  previewLabel: string;
};

/**
 * Native PDF, full first page: frame aspect matches the page so width-fit ≡ page-fit.
 * pointer-events none — Pakalpojumi scroll passes through; interact via Pietuvināt.
 */
function MobileNativeFullPagePreview({ href, title, previewLabel }: MobileNativeProps) {
  const src = `${href}#page=1&toolbar=0&navpanes=0&scrollbar=0`;

  return (
    <div
      className="pointer-events-none relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: PDF_PAGE_ASPECT }}
    >
      <iframe
        title={`${title} — ${previewLabel}`}
        src={src}
        tabIndex={-1}
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white"
      />
    </div>
  );
}

/**
 * Desktop/web: scrollable PDF iframe (unchanged).
 * Mobile: native PDF in a page-aspect frame (full page + original Safari paint);
 * touches pass through; PDF interaction only via „Pietuvināt”.
 */
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
  const isDesktop = useIsDesktopPreview();
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

  const desktopPaneSrc = href ? `${href}#toolbar=0&navpanes=0&scrollbar=1` : null;
  const lightboxSrc = href ? `${href}#toolbar=0&navpanes=0&scrollbar=1` : null;

  return (
    <>
      <div className="flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.7)]">
        <div className="pointer-events-none relative z-[2] flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
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
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-[#60a5fa] transition hover:bg-white/5 hover:text-[#93c5fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/40"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Expand className="h-3.5 w-3.5" aria-hidden />
              {enlargeLabel}
            </button>
          ) : null}
        </div>

        {isDesktop ? (
          <div className="relative h-[min(28rem,55vh)] w-full bg-zinc-950 sm:h-[min(32rem,58vh)] lg:h-[36rem]">
            {desktopPaneSrc ? (
              <iframe
                title={`${title} — ${previewLabel}`}
                src={desktopPaneSrc}
                className="absolute inset-0 h-full w-full border-0 bg-zinc-950"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-zinc-500">{comingSoonLabel}</p>
              </div>
            )}
          </div>
        ) : href ? (
          <MobileNativeFullPagePreview href={href} title={title} previewLabel={previewLabel} />
        ) : (
          <div className="relative flex aspect-[1400/1981] w-full items-center justify-center bg-zinc-950 px-6 text-center">
            <p className="text-sm font-medium text-zinc-500">{comingSoonLabel}</p>
          </div>
        )}
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
