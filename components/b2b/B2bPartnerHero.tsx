"use client";

import { useTranslations } from "next-intl";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";
import { CONTACT_PHONE_TEL, contactEmail } from "@/lib/contact";

export function B2bPartnerHero() {
  const t = useTranslations("Partner");
  const email = contactEmail();

  return (
    <section
      id="b2b-partner-hero"
      className="px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-8 pb-10 sm:pt-12 sm:pb-14"
      aria-labelledby="b2b-partner-hero-title"
    >
      <div className="mx-auto w-full max-w-[36rem] text-center">
        <h1
          id="b2b-partner-hero-title"
          className="text-balance text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-100 sm:text-[1.85rem]"
        >
          {t("titlePrefix")}
          <span className="text-[#2563EB]">{t("titleAccent")}</span>
        </h1>

        <div className="mx-auto mt-8 max-w-[36rem] text-left sm:mt-10">
          <p className="border-l-2 border-[#2563EB] pl-3.5 text-[0.84rem] font-normal leading-[1.55] text-zinc-300 sm:pl-4 sm:text-[0.9rem] sm:leading-[1.6]">
            {t("heroLead")}
          </p>
          <p className="mt-5 text-[0.84rem] font-medium leading-snug text-zinc-100 sm:mt-6 sm:text-[0.9rem]">
            {t("heroContactLead")}
          </p>
          <p className="mt-2 text-[0.82rem] leading-relaxed text-zinc-400 sm:text-[0.875rem]">
            {t("loginEmail")}:{" "}
            <a
              href={`mailto:${email}`}
              className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
            >
              {email}
            </a>
            {" | "}
            {t("heroPhoneLabel")}:{" "}
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              className="text-[#93c5fd] underline-offset-2 transition-colors hover:text-[#bfdbfe] hover:underline"
            >
              {CONTACT_PHONE_TEL}
            </a>
          </p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[22rem] text-left sm:mt-10">
          <B2bPartnerLogin />
        </div>
      </div>
    </section>
  );
}
