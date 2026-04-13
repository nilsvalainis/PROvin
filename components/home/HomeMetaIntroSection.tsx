import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Sākumlapas ievads — `Meta.homeIntroTitle` / `homeIntroBody` (neparasti ar lapas `<title>` / SEO aprakstu).
 */
export async function HomeMetaIntroSection() {
  const tMeta = await getTranslations("Meta");
  const tOrder = await getTranslations("Order");

  return (
    <section
      className="demo-design-dir__section demo-design-dir__section--band-a pb-20 pt-4 sm:pb-28 sm:pt-8"
      id="home-intro"
    >
      <div className="demo-design-dir__shell relative text-center">
        <div className="demo-design-dir__axis-line opacity-80" aria-hidden />
        <h1 className="demo-design-dir__title relative z-[1] mx-auto mt-4 max-w-[min(100%,40rem)] text-balance">
          {tMeta("homeIntroTitle")}
        </h1>
        <p className="demo-design-dir__body relative z-[1] mx-auto mt-4 max-w-[min(100%,42rem)] text-balance sm:mt-5">
          {tMeta("homeIntroBody")}
        </p>
        <div className="demo-design-dir__hero-scan relative z-[1]" aria-hidden />
        <div className="relative z-[1] mt-6 flex justify-center sm:mt-7">
          <a
            href="#order-form"
            className="group inline-flex min-h-11 touch-manipulation flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-center text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-[#7eb6ff] no-underline shadow-none transition-colors hover:text-white/95 focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066ff]/55"
          >
            <span className="text-balance text-center">{tOrder("scrollToFormAria")}</span>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-[#7eb6ff] transition-colors group-hover:text-white/90"
              strokeWidth={2}
              aria-hidden
            />
          </a>
        </div>
      </div>
    </section>
  );
}
