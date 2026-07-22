"use client";

import { useTranslations } from "next-intl";
import { OrderForm } from "@/components/OrderForm";

type Props = {
  operatorKey: string;
};

export function OperatorPasutitForm({ operatorKey }: Props) {
  const t = useTranslations("Order");

  return (
    <div className="mx-auto min-h-[70vh] max-w-[720px] px-4 py-12 sm:px-8 sm:py-16">
      <header className="mb-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">
          PROVIN.LV
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[32px]">
          {t("operatorPageTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-[15px] font-normal leading-relaxed text-[#86868b]">
          {t("operatorPageIntro")}
        </p>
      </header>
      <OrderForm operatorMode={{ operatorKey }} />
      <p className="mt-6 text-center text-[11px] font-normal leading-snug text-[#aeaeb2]">
        {t("operatorNote")}
      </p>
    </div>
  );
}
