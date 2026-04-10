import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { irissAnchorHref } from "@/lib/paths";
import { homeSectionTitleClass } from "@/lib/home-layout";
import { PricingIncludedClient, type PricingGridItem } from "@/components/PricingIncludedClient";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: PricingGridItem[] } }).Pricing.grid;

  return (
    <section
      id="cena"
      className="relative scroll-mt-16 px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 md:pb-8 md:pt-6"
    >
      <div className="relative mx-auto w-full max-w-[1000px]">
        <h2 className={homeSectionTitleClass}>{t("workTitle")}</h2>
        <div className="perspective-[1000px]">
          <PricingIncludedClient
            grid={grid}
            irissHref={irissHref}
            irissLinkLabel={t("irissLink")}
          />
        </div>
        <p className="mt-5 max-w-[65ch] text-left text-xs font-normal leading-snug text-[#b8bcc4] sm:mt-6 sm:text-sm">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
