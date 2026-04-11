import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { orderSectionHref } from "@/lib/paths";
import { InvestigationLabGlass, type InvestigationPillar } from "@/components/home/investigation-lab/InvestigationLabGlass";

export async function InvestigationLabSection() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();
  const messages = await getMessages();
  const pillars = (messages as { Hero: { pillars: InvestigationPillar[] } }).Hero.pillars;

  return (
    <InvestigationLabGlass
      pillars={pillars}
      trustHeadline={t("trustHeadline")}
      trustBody={t("trustBody")}
      cta={t("cta")}
      orderHref={orderSectionHref(locale)}
    />
  );
}
