import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { orderSectionHref } from "@/lib/paths";
import { InvestigationLabClient } from "@/components/home/investigation-lab/InvestigationLabClient";

type Pillar = { title: string; body: string };

export async function InvestigationLabSection() {
  const messages = (await getMessages()) as {
    Hero: { pillars: Pillar[] };
  };
  const t = await getTranslations("InvestigationLab");
  const locale = await getLocale();
  const pillars = (messages.Hero?.pillars ?? []).slice(0, 4);

  return (
    <InvestigationLabClient
      pillars={pillars}
      eyebrow={t("eyebrow")}
      stickyTitle={t("stickyTitle")}
      stickyLead={t("stickyLead")}
      ctaLabel={t("ctaLabel")}
      scannerAria={t("scannerAria")}
      orderHref={orderSectionHref(locale)}
    />
  );
}
