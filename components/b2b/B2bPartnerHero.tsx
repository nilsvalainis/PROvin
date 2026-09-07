"use client";

import { useTranslations } from "next-intl";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";

export function B2bPartnerHero() {
  const t = useTranslations("Partner");

  return (
    <section
      id="b2b-partner-hero"
      className="px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-8 pb-4 sm:pt-12"
      aria-labelledby="b2b-partner-hero-title"
    >
      <div className="mx-auto w-full max-w-[22rem]">
        <h1 id="b2b-partner-hero-title" className="text-balance text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.02em] text-zinc-100">
          {t("titlePrefix")}
          <span className="text-[#2563EB]">{t("titleAccent")}</span>
        </h1>
        <div className="mt-8">
          <B2bPartnerLogin />
        </div>
      </div>
    </section>
  );
}
