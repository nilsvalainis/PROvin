"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { B2bPartnerHero } from "@/components/b2b/B2bPartnerHero";
import { homeFooterColumnClass } from "@/lib/home-layout";

const LINK_CLASS =
  "text-left text-[0.62rem] font-semibold uppercase tracking-[0.04em] text-[#93c5fd] underline decoration-white/25 underline-offset-[0.18em] transition-colors hover:text-[#bfdbfe] hover:decoration-[#93c5fd]";

const B2bPartnerCatalog = dynamic(
  () => import("@/components/b2b/B2bPartnerCatalog").then((mod) => mod.B2bPartnerCatalog),
  { ssr: false },
);

export function B2bPartnerPreview() {
  const t = useTranslations("Partner");
  const [open, setOpen] = useState(false);

  const links = (
    <div className="flex flex-col items-start gap-2.5">
      <button
        type="button"
        className={LINK_CLASS}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {t("serviceLinkBusiness")}
      </button>
    </div>
  );

  return (
    <>
      <B2bPartnerHero afterContact={<div className="mt-6 hidden lg:block">{links}</div>} />
      <div className={`${homeFooterColumnClass} pb-6 lg:hidden`}>
        {links}
      </div>
      {open ? <B2bPartnerCatalog plan="business" className="px-4 sm:px-6" /> : null}
    </>
  );
}
