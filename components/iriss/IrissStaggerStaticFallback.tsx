"use client";

/** Tikai saturs bez pavediena — ErrorBoundary fallback. */
export function IrissStaggerStaticFallback({
  headingClassName,
  bodyClassName,
  gapClassName,
  block1Heading,
  block1Body,
  block2Heading,
  block2Body,
  block3Heading,
  block3Body,
}: {
  headingClassName: string;
  bodyClassName: string;
  gapClassName: string;
  block1Heading: string;
  block1Body: string;
  block2Heading: string;
  block2Body: string;
  block3Heading: string;
  block3Body: string;
}) {
  return (
    <div className="relative isolate mt-12 sm:mt-14 md:mt-16">
      <div className="home-iriss-stagger-atmosphere" aria-hidden />
      <div
        className={`relative z-[2] flex flex-col ${gapClassName} pt-[clamp(0.75rem,2vw,1.25rem)] pb-[clamp(2.5rem,6vw,4.5rem)]`}
      >
        <div className="grid grid-cols-1 gap-y-5 lg:grid-cols-2 lg:gap-x-10 xl:gap-x-16">
          <div className="hidden min-h-[8rem] lg:block" aria-hidden />
          <div className="min-w-0 max-w-[min(100%,38rem)] lg:justify-self-end lg:text-right">
            <h3 className={headingClassName}>{block1Heading}</h3>
            <p className={`${bodyClassName} mt-4 text-balance`}>{block1Body}</p>
          </div>
        </div>
        <div className="mx-auto min-w-0 max-w-[min(100%,42rem)] px-1 text-center sm:px-2">
          <h3 className={`${headingClassName} mx-auto max-w-[min(100%,52ch)]`}>{block2Heading}</h3>
          <p className={`${bodyClassName} mt-4 whitespace-pre-line text-balance`}>{block2Body}</p>
        </div>
        <div className="grid grid-cols-1 gap-y-5 lg:grid-cols-2 lg:gap-x-10 xl:gap-x-16">
          <div className="min-w-0 max-w-[min(100%,38rem)] text-left">
            <h3 className={headingClassName}>{block3Heading}</h3>
            <p className={`${bodyClassName} mt-4 text-balance`}>{block3Body}</p>
          </div>
          <div className="hidden min-h-[8rem] lg:block" aria-hidden />
        </div>
      </div>
    </div>
  );
}
