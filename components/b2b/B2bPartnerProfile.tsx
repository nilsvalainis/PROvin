"use client";

import { useTranslations } from "next-intl";
import { B2bPartnerArchive } from "@/components/b2b/B2bPartnerArchive";
import { B2bPartnerRequisites } from "@/components/b2b/B2bPartnerRequisites";

export function B2bPartnerProfile() {
  const t = useTranslations("Partner");

  return (
    <div className="flex flex-col gap-12 sm:gap-14">
      <h1 className="sr-only">{t("navProfile")}</h1>
      <B2bPartnerArchive embedded />
      <B2bPartnerRequisites embedded />
    </div>
  );
}
