"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { homePath } from "@/lib/paths";

export function PasutitRedirect() {
  const locale = useLocale();
  const t = useTranslations("Misc");
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchParams.get("atcelts") === "1") params.set("atcelts", "1");
    const vin = searchParams.get("vin");
    if (vin?.trim()) params.set("vin", vin.trim());
    const q = params.toString() ? `?${params.toString()}` : "";
    const base = homePath(locale);
    const path = base === "/" ? "/" : base;
    window.location.replace(`${path}${q}#home-hero`);
  }, [searchParams, locale]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-16 text-center text-[15px] font-normal text-[#86868b]">
      {t("pasutitRedirect")}
    </div>
  );
}
