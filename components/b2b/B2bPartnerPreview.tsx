"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import type { B2bPartnerPlanId } from "@/lib/b2b-partner-copy";

const LINK_CLASS =
  "text-left text-[0.62rem] font-semibold uppercase tracking-[0.04em] text-[#93c5fd] underline decoration-white/25 underline-offset-[0.18em] transition-colors hover:text-[#bfdbfe] hover:decoration-[#93c5fd]";

export function B2bPartnerPreview() {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState<B2bPartnerPlanId | null>(null);

  const toggle = (plan: B2bPartnerPlanId) => {
    setOpen((prev) => (prev === plan ? null : plan));
  };

  const links = (
    <div className="flex flex-col items-start gap-2.5">
      <button
        type="button"
        className={LINK_CLASS}
        aria-expanded={open === "business"}
        onClick={() => toggle("business")}
      >
        {t("serviceLinkBusiness")}
      </button>
      <button
        type="button"
        className={LINK_CLASS}
        aria-expanded={open === "dealer"}
        onClick={() => toggle("dealer")}
      >
        {t("serviceLinkDealer")}
      </button>
    </div>
  );

  return (
    <>
      <B2bPartnerHero afterContact={<div className="mt-6 hidden lg:block">{links}</div>} />
      <div className="mx-auto w-full max-w-[36rem] px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-6 lg:hidden">
        {links}
      </div>
      {open ? <B2bPartnerCatalog plan={open} className="px-4 sm:px-6" /> : null}
    </>
  );
}
