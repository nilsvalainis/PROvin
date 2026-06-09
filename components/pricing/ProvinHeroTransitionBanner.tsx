import { TP5_HERO_SUBHEAD } from "@/lib/test-pricing-5-hero-copy";

export function ProvinHeroTransitionBanner() {
  return (
    <section
      id="hero-transition"
      aria-label="PROVIN pakalpojuma kopsavilkums"
      className="bg-transparent py-8 md:py-12 lg:py-16"
    >
      <p className="mx-auto max-w-3xl px-4 text-center text-lg font-normal leading-relaxed text-gray-300 md:text-xl">
        {TP5_HERO_SUBHEAD}
      </p>
    </section>
  );
}
