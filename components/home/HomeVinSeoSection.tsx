import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { homeContentMaxClass } from "@/lib/home-layout";
import { faqPageHref, pakalpojumiHref, vinCheckHref } from "@/lib/paths";

export async function HomeVinSeoSection() {
  const t = await getTranslations("VinCheck");

  return (
    <section
      id="vin-koda-parbaude"
      className="home-body-ink scroll-mt-16 bg-transparent px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="home-vin-seo-heading"
    >
      <div className={homeContentMaxClass}>
        <h2
          id="home-vin-seo-heading"
          className="max-w-3xl text-balance text-lg font-bold uppercase tracking-[0.14em] text-zinc-100 sm:text-xl"
        >
          {t("homeTitle")}
        </h2>
        <p className="mt-3 max-w-3xl text-pretty text-[0.875rem] font-medium leading-[1.6] text-zinc-300 sm:text-[0.9375rem]">
          {t("homeBody")}
        </p>
        <p className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <Link href={vinCheckHref()} className="text-provin-accent no-underline transition hover:text-white">
            {t("homeCta")}
          </Link>
          <Link href={pakalpojumiHref()} className="text-white/45 no-underline transition hover:text-provin-accent">
            {t("ctaServices")}
          </Link>
          <Link href={faqPageHref()} className="text-white/45 no-underline transition hover:text-provin-accent">
            {t("ctaFaq")}
          </Link>
        </p>
      </div>
    </section>
  );
}
