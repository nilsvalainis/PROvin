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
      className="bg-transparent px-4 py-14 sm:py-20 md:py-24 lg:py-28"
    >
      <p className={homeEditorialPunchlineClass}>
        <span className={homeEditorialPunchlineLeadClass}>{TP5_HERO_SUBHEAD_LEAD}</span>
        <span className={homeEditorialPunchlineAccentClass}>{TP5_HERO_SUBHEAD_ACCENT}</span>
      </p>
    </section>
  );
}
