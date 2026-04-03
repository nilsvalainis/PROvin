import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { getTranslations } from "next-intl/server";

type Props = { className?: string };

/**
 * Obligātie distances līguma / GDPR rekvizīti (Footer, Noteikumi, Privātuma politika).
 */
export async function CompanyLegalDisclosure({ className }: Props) {
  const t = await getTranslations("Footer");
  const { legalName, regNo, legalAddress, isComplete } = getCompanyLegal();
  const publicBrand = getCompanyPublicBrand();

  /** Kamēr nav env: tikai publiskais zīmols PROVIN.LV; pilni rekvizīti — pirms Live (.env). Izstrādē — brīdinājums. */
  if (!isComplete) {
    const isDev = process.env.NODE_ENV === "development";
    return (
      <address
        className={
          className ??
          "not-italic text-[11px] leading-relaxed text-[#6e6e73] sm:text-[12px]"
        }
      >
        <p className="font-medium text-[#424245]">{publicBrand}</p>
        {isDev ? (
          <p className="mt-1.5 text-[10px] leading-snug text-[#aeaeb2]">{t("companyIncompleteDev")}</p>
        ) : null}
      </address>
    );
  }

  return (
    <address
      className={
        className ??
        "not-italic text-[11px] leading-relaxed text-[#6e6e73] sm:text-[12px]"
      }
    >
      <p className="font-medium text-[#424245]">{publicBrand}</p>
      <p className="mt-1">
        <span className="font-medium text-[#424245]">{t("companyLegalSubject")}:</span> {legalName}
      </p>
      <p className="mt-0.5">
        <span className="font-medium text-[#424245]">{t("companyRegNo")}:</span> {regNo}
      </p>
      <p className="mt-0.5">
        <span className="font-medium text-[#424245]">{t("companyLegalAddress")}:</span> {legalAddress}
      </p>
    </address>
  );
}
