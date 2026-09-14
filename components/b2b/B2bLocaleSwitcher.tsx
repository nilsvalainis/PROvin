"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { B2B_LOCALES, type AppLocale } from "@/i18n/locales";

const LANG_KEY: Record<AppLocale, "langLv" | "langEn" | "langDe" | "langRu"> = {
  lv: "langLv",
  en: "langEn",
  de: "langDe",
  ru: "langRu",
};

type Props = {
  dark: boolean;
  compact?: boolean;
};

export function B2bLocaleSwitcher({ dark, compact }: Props) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/partneriem";
  const tHeader = useTranslations("Header");
  const textClass = dark ? "text-white/75 hover:text-white" : "text-[#1d1d1f]/70 hover:text-[#1d1d1f]";
  const activeClass = "text-[#93c5fd]";

  return (
    <nav
      aria-label={tHeader("langGroupAria")}
      className={`relative z-[52] inline-flex shrink-0 items-center ${compact ? "gap-1.5" : "gap-2"}`}
    >
      {B2B_LOCALES.map((id) => {
        const current = locale === id;
        return (
          <Link
            key={id}
            href={pathname as never}
            locale={id}
            className={`text-[0.68rem] font-semibold uppercase tracking-[0.08em] no-underline transition ${
              compact ? "min-h-8 px-0.5" : "min-h-9 px-1"
            } inline-flex items-center justify-center ${current ? activeClass : textClass}`}
            aria-current={current ? "page" : undefined}
            aria-label={tHeader(LANG_KEY[id])}
          >
            {tHeader(LANG_KEY[id])}
          </Link>
        );
      })}
    </nav>
  );
}
