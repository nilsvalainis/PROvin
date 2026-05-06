import { getTranslations } from "next-intl/server";
import { HeaderClient } from "@/components/HeaderClient";
import { orderSectionHref } from "@/lib/paths";

export async function Header() {
  const t = await getTranslations("Header");
  const tHero = await getTranslations("Hero");
  const orderHref = orderSectionHref();
  const faqHref = "/biezi-jautajumi";

  return (
    <HeaderClient
      orderLabel={t("order")}
      orderHref={orderHref}
      faqHref={faqHref}
      navHome={t("navHome")}
      faqLabel={t("faq")}
      menuOpenLabel={t("menuOpen")}
      menuCloseLabel={t("menuClose")}
      approvedLabel={tHero("approved")}
    />
  );
}
