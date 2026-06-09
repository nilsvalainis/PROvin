import { homeDarkProvinWordmarkOptions, homeHeroTransitionBodyClass } from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";
import { TP5_HERO_SUBHEAD } from "@/lib/test-pricing-5-hero-copy";

export function ProvinHeroTransitionBanner() {
  return (
    <section
      id="hero-transition"
      aria-label="PROVIN pakalpojuma kopsavilkums"
      className="bg-transparent py-14 sm:py-20 md:py-24 lg:py-28"
    >
      <p className={homeHeroTransitionBodyClass}>
        {renderProvinText(TP5_HERO_SUBHEAD, homeDarkProvinWordmarkOptions)}
      </p>
    </section>
  );
}
