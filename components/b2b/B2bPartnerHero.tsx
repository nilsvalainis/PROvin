"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { B2bPartnerLogin } from "@/components/b2b/B2bPartnerLogin";
import { CONTACT_PHONE_TEL, contactEmail } from "@/lib/contact";

export function B2bPartnerHero({
  afterContact,
  panel,
  hideContact = false,
  widePanel = false,
}: {
  afterContact?: ReactNode;
  /** Login by default; invite register (or invalid-token copy) replaces the aside. */
  panel?: ReactNode;
  hideContact?: boolean;
  widePanel?: boolean;
}) {
  const t = useTranslations("Partner");
  const email = contactEmail();

  return (
    <section
      id="b2b-partner-hero"
      className="px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-8 pb-10 sm:pt-12 sm:pb-14"
      aria-labelledby="b2b-partner-hero-title"
    >
      <div
        className={`mx-auto grid w-full max-w-[36rem] gap-8 lg:items-start lg:gap-12 xl:gap-16 ${
          widePanel
            ? "lg:max-w-[72rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,32rem)]"
            : "lg:max-w-[68rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,22rem)]"
        }`}
      >
        <div className="min-w-0 text-center lg:text-left">
          <h1
            id="b2b-partner-hero-title"
            className="text-balance text-[1.5rem] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-100 lg:text-[1.85rem]"
          >
            {t("titlePrefix")}
            <span className="text-[#2563EB]">{t("titleAccent")}</span>
          </h1>
          <p className="mt-3 hidden text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[#93c5fd] lg:block">
            {t("heroPartnerEyebrow")}
          </p>

          <div className="mx-auto mt-8 max-w-[36rem] space-y-4 text-left lg:mx-0 lg:mt-6 lg:max-w-[40rem]">
            <p className="border-l-2 border-[#2563EB] pl-3.5 text-[0.84rem] font-normal leading-[1.55] text-zinc-300 lg:border-0 lg:pl-0 lg:text-[0.9rem] lg:leading-[1.6]">
              {t("heroLead")}
            </p>
            <p className="text-[0.84rem] font-normal leading-[1.55] text-zinc-300 lg:text-[0.9rem] lg:leading-[1.6]">
              {t("heroLeadProof")}
            </p>
            <p className="text-[0.84rem] font-normal leading-[1.55] text-zinc-300 lg:text-[0.9rem] lg:leading-[1.6]">
              {t("heroLeadTrust")}
            </p>
            {hideContact ? null : (
              <>
                <p className="pt-1 text-[0.84rem] font-medium leading-snug text-zinc-100 sm:text-[0.9rem]">
                  {t("heroContactLead")}
                </p>
                <p className="text-[0.82rem] leading-relaxed text-zinc-400 sm:text-[0.875rem]">
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
              </>
            )}
            {afterContact}
          </div>
        </div>

        <div
          className={`mx-auto w-full text-left lg:mx-0 lg:rounded-[1rem] lg:border lg:border-white/10 lg:bg-gradient-to-b lg:from-white/[0.04] lg:to-white/[0.015] lg:p-5 xl:p-6 ${
            widePanel ? "max-w-[36rem] lg:max-w-none" : "max-w-[22rem]"
          }`}
        >
          {panel ?? <B2bPartnerLogin />}
        </div>
      </div>
    </section>
  );
}
