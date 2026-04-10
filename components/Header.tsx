import { getLocale, getTranslations } from "next-intl/server";
import { HeaderClient } from "@/components/HeaderClient";
import { orderSectionHref } from "@/lib/paths";

export async function Header() {
  const t = await getTranslations("Header");
  const locale = await getLocale();
  const orderHref = orderSectionHref(locale);
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
    />
  );
}
