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
      className="demo-design-dir__section demo-design-dir__section--band-a pb-6 pt-4 sm:pb-8 sm:pt-6"
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
        <div className="relative z-[1] mt-5 flex justify-center sm:mt-6">
          <a
            href="#order-form"
            className="group inline-flex min-h-11 touch-manipulation flex-col items-center justify-center gap-1.5 border-0 bg-transparent p-0 text-center text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-provin-accent no-underline shadow-none transition-colors hover:text-[var(--color-provin-accent-hover)] focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent/55"
          >
            <span className="text-balance text-center">{tOrder("scrollToFormAria")}</span>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-provin-accent transition-colors group-hover:text-[var(--color-provin-accent-hover)]"
              strokeWidth={2}
              aria-hidden
            />
          </a>
        </div>
      </div>
    </section>
  );
}
