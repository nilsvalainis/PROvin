import { getTranslations } from "next-intl/server";

/**
 * Sākumlapas ievads — `Meta.homeIntroTitle` / `homeIntroBody` (neparasti ar lapas `<title>` / SEO aprakstu).
 */
export async function HomeMetaIntroSection() {
  const tMeta = await getTranslations("Meta");

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
      </div>
    </section>
  );
}
