"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const LABEL_CLASS = "text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const VALUE_CLASS = "text-[0.8125rem] font-medium leading-snug text-zinc-100 sm:text-[0.875rem]";

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-12 items-center justify-between gap-4 rounded-[0.35rem] bg-white/[0.03] px-3">
      <span className={LABEL_CLASS}>{label}</span>
      <span className={`${VALUE_CLASS} min-w-0 truncate text-right`}>{value}</span>
    </div>
  );
}

export function B2bPartnerRequisites() {
  const t = useTranslations("Partner");
  const [profile, setProfile] = useState<B2bPartnerPublicProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/me", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { partner?: B2bPartnerPublicProfile };
        if (!cancelled && data.partner) setProfile(data.partner);
      } catch {
        /* paliek tukšs, kamēr nav profila */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="b2b-partner-requisites-title">
      <h1 id="b2b-partner-requisites-title" className={TITLE_CLASS}>
        {t("requisitesTitle")}
      </h1>
      <div className={TITLE_RULE_CLASS} aria-hidden />
      {!profile ? (
        <p className="mt-8 text-[0.8125rem] text-zinc-400 sm:text-[0.875rem]">{t("requisitesLoading")}</p>
      ) : (
        <div className="mt-7 flex flex-col gap-1.5">
          <ProfileRow label={t("fieldCompany")} value={profile.companyName} />
          <ProfileRow label={t("fieldReg")} value={profile.companyReg} />
          <ProfileRow label={t("fieldAddress")} value={profile.companyAddress} />
          <ProfileRow label={t("fieldContact")} value={profile.contactName} />
          <ProfileRow label={t("fieldEmail")} value={profile.email} />
          <ProfileRow label={t("fieldPhone")} value={profile.phone} />
        </div>
      )}
    </section>
  );
}
