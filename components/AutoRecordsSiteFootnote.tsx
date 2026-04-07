import { getTranslations } from "next-intl/server";
import { homeContentMaxClass } from "@/lib/home-layout";

/** Vienīgā vieta lapā — * piezīme par ražotāju servisa avotiem. */
export async function AutoRecordsSiteFootnote() {
  const t = await getTranslations("Pricing");
  return (
    <div className="bg-white px-4 pb-6 pt-2 sm:px-6 sm:pb-8">
      <p className={`${homeContentMaxClass} text-center text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]`}>
        {t("autoRecordsFootnote")}
      </p>
    </div>
  );
}
