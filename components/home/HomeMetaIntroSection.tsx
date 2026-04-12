import { getTranslations } from "next-intl/server";

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
      </div>
    </section>
  );
}
