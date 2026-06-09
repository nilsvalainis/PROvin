import {
  homeEditorialPunchlineAccentClass,
  homeEditorialPunchlineClass,
  homeEditorialPunchlineLeadClass,
} from "@/lib/home-layout";
import { TP5_HERO_SUBHEAD_ACCENT, TP5_HERO_SUBHEAD_LEAD } from "@/lib/test-pricing-5-hero-copy";

export function ProvinHeroTransitionBanner() {
  return (
    <section
      id="hero-transition"
      aria-label="PROVIN pakalpojuma kopsavilkums"
      className="bg-transparent px-4 pt-14 pb-[4.2rem] sm:pt-20 sm:pb-24 md:pt-24 md:pb-[7.2rem] lg:pt-28 lg:pb-[8.4rem]"
    >
      <p className={homeEditorialPunchlineClass}>
        <span className={homeEditorialPunchlineLeadClass}>{TP5_HERO_SUBHEAD_LEAD}</span>
        <span className={homeEditorialPunchlineAccentClass}>{TP5_HERO_SUBHEAD_ACCENT}</span>
      </p>
    </section>
  );
}
