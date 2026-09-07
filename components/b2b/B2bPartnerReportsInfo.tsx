"use client";

import { useTranslations } from "next-intl";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";

export function B2bPartnerReportsInfo() {
  const t = useTranslations("Partner");

  return (
    <div>
      <h1
        id="b2b-included-title"
        className="text-balance text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-100"
      >
        {t("includedHeading")}
      </h1>
      <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />
      <B2bPartnerCatalog className="pt-6 sm:pt-8" />
    </div>
  );
}
