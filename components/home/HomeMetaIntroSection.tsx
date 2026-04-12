import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";

/**
 * Sākumlapas ievads — tā pati kompozīcija kā `DesignDirectionHeroIntro`, tikai `Hero` + `Meta` tulkojumi.
 */
export async function HomeMetaIntroSection() {
  const tHero = await getTranslations("Hero");
  const tMeta = await getTranslations("Meta");

  return (
    <section
      className="demo-design-dir__section demo-design-dir__section--band-a pb-20 pt-4 sm:pb-28 sm:pt-8"
      id="home-intro"
    >
      <div className="demo-design-dir__shell relative text-center">
        <div className="demo-design-dir__axis-line opacity-80" aria-hidden />
        <p className="demo-design-dir__kicker relative z-[1]">{tHero("approved")}</p>
        <h1 className="demo-design-dir__title relative z-[1] mx-auto mt-4 max-w-[40rem]">{tMeta("title")}</h1>
        <p className="demo-design-dir__body relative z-[1] mx-auto mt-4 max-w-[36rem]">{tMeta("description")}</p>
        <div className="demo-design-dir__hero-scan relative z-[1]" aria-hidden />
        <div className="relative z-[1] mt-10 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          <Link
            href="#site-content"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0066ff]/35 bg-[#0066ff]/12 px-4 py-2 text-[#7eb6ff] transition hover:bg-[#0066ff]/20 hover:text-white"
          >
            {tHero("scrollToPricingAria")}
            <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
