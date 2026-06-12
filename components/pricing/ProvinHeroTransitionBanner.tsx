import { useLocale } from "next-intl";
import {
  homeEditorialPunchlineAccentClass,
  homeEditorialPunchlineClass,
  homeEditorialPunchlineLeadClass,
} from "@/lib/home-layout";
import { getTp5HeroCopy } from "@/lib/test-pricing-5-hero-copy";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

export function ProvinHeroTransitionBanner() {
  const locale = useLocale();
  const heroCopy = getTp5HeroCopy(locale);
  const uiCopy = getTp5UiCopy(locale);

  return (
    <section
      id="hero-transition"
      aria-label={uiCopy.transitionBannerAria}
      className="bg-transparent px-4 pt-14 pb-[4.2rem] sm:pt-20 sm:pb-24 md:pt-24 md:pb-[7.2rem] lg:pt-28 lg:pb-[8.4rem]"
    >
      <p className={homeEditorialPunchlineClass}>
        <span className={homeEditorialPunchlineLeadClass}>{heroCopy.subheadLead}</span>
        <span className={homeEditorialPunchlineAccentClass}>{heroCopy.subheadAccent}</span>
      </p>
    </section>
  );
}
