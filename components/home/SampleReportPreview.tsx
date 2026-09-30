"use client";

import { Expand } from "lucide-react";
import { useEffect, useId, useState, type MouseEvent } from "react";
import { SampleReportLightbox } from "@/components/home/SampleReportLightbox";
import { recordSampleReportClick } from "@/lib/sample-report-click-client";
import { sampleMobilePage1Src, samplePdfHref } from "@/lib/sample-public-assets";

type Props = {
  href?: string;
  title: string;
  enlargeLabel: string;
  closeLabel: string;
  previewLabel: string;
  openPdfLabel: string;
  comingSoonLabel: string;
  /** Slightly shorter preview (samples grid). */
  compact?: boolean;
};

/** lg breakpoint - desktop keeps the original scrollable iframe preview. */
const DESKTOP_MQ = "(min-width: 1024px)";

/** Defaults to desktop so web never flashes the mobile static image. */
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

/**
 * Desktop/web: scrollable PDF iframe (unchanged).
 * Mobile: full-page PNG preview; „Pietuvināt” opens the PDF in a new browser tab.
 */
export function SampleReportPreview({
  href,
  title,
  enlargeLabel,
  closeLabel,
  previewLabel,
  openPdfLabel,
  comingSoonLabel,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktopPreview();
  const titleId = useId();

  const openPdfInBrowser = !isDesktop;

  const onEnlargeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!href) return;
    recordSampleReportClick();
    if (openPdfInBrowser) return;
    event.preventDefault();
    setOpen(true);
  };

  const pdfHref = href ? samplePdfHref(href) : null;
  const desktopPaneSrc = pdfHref ? `${pdfHref}#toolbar=0&navpanes=0&scrollbar=1` : null;
  const mobileImageSrc = href ? sampleMobilePage1Src(href) : null;
  const desktopPaneClass = compact
    ? "relative h-[min(22rem,48vh)] w-full bg-zinc-950 sm:h-[min(24rem,50vh)] lg:h-[26rem]"
    : "relative h-[min(28rem,55vh)] w-full bg-zinc-950 sm:h-[min(32rem,58vh)] lg:h-[36rem]";
  const mobilePaneClass = compact
    ? "pointer-events-none relative flex h-[min(22rem,48vh)] w-full items-center justify-center overflow-hidden bg-white p-1.5 sm:h-[min(24rem,50vh)]"
    : "pointer-events-none relative flex h-[min(28rem,55vh)] w-full items-center justify-center overflow-hidden bg-white p-1.5 sm:h-[min(32rem,58vh)]";

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
          {pdfHref ? (
            <a
              href={pdfHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onEnlargeClick}
              className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-[#60a5fa] transition hover:bg-white/5 hover:text-[#93c5fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/40"
              aria-haspopup={openPdfInBrowser ? undefined : "dialog"}
              aria-expanded={openPdfInBrowser ? undefined : open}
            >
              <Expand className="h-3.5 w-3.5" aria-hidden />
              {enlargeLabel}
            </a>
          ) : null}
        </div>

        {isDesktop ? (
          <div className={desktopPaneClass}>
            {desktopPaneSrc ? (
              <iframe
                title={`${title} - ${previewLabel}`}
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
        ) : (
          <div className={mobilePaneClass}>
            {mobileImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- full-page PDF snapshot; avoid next/image crop
              <img
                src={mobileImageSrc}
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-zinc-950 px-6 text-center">
                <p className="text-sm font-medium text-zinc-500">{comingSoonLabel}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {pdfHref ? (
        <SampleReportLightbox
          open={open}
          href={pdfHref}
          title={title}
          closeLabel={closeLabel}
          openPdfLabel={openPdfLabel}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
