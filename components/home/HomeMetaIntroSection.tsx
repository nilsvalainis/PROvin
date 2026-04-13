import { getTranslations } from "next-intl/server";

/**
 * Sākumlapas ievads — `Meta.homeIntroTitle` / `homeIntroBody` (neparasti ar lapas `<title>` / SEO aprakstu).
 */
export async function HomeMetaIntroSection() {
  const tMeta = await getTranslations("Meta");

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
        <div
          className="demo-design-dir__hero-scan relative z-[1] mx-auto my-8 sm:my-10"
          aria-hidden
        />
        <p className="demo-design-dir__body relative z-[1] mx-auto mt-0 max-w-[min(100%,42rem)] text-balance">
          {tMeta("homeIntroBody")}
        </p>
      </div>
    </section>
  );
}
