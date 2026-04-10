import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { orderSectionHref } from "@/lib/paths";
import { InvestigationLabClient } from "@/components/home/investigation-lab/InvestigationLabClient";

type Pillar = { title: string; body: string };

export async function InvestigationLabSection() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();
  const messages = await getMessages();
  const pillars = (messages as { Hero: { pillars: Pillar[] } }).Hero.pillars;

  return (
    <InvestigationLabClient
      pillars={pillars}
      trustHeadline={t("trustHeadline")}
      trustBody={t("trustBody")}
      cta={t("cta")}
      orderHref={orderSectionHref(locale)}
    />
  );
}
