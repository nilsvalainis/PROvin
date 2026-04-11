import { getCompanyLegal, getCompanyPublicBrand } from "@/lib/company";
import { getTranslations } from "next-intl/server";

/**
 * Viena rinda: „Juridiskā informācija:“ / „Pakalpojuma sniedzējs:“ + rekvizīti.
 * Askētisks: text-gray-400, ~10px, bez rāmja.
 */
export async function CompanyLegalOneLine({
  variant,
  tone = "light",
  omitPrefix = false,
}: {
  variant: "juridiska" | "pakalpojums";
  tone?: "light" | "dark";
  /** Ja true — tikai rekvizītu rinda (piem. pēc summary „Pakalpojuma sniedzējs”). */
  omitPrefix?: boolean;
}) {
  const t = await getTranslations("Footer");
  const { legalName, regNo, legalAddress, isComplete } = getCompanyLegal();
  const prefix =
    variant === "juridiska" ? t("legalInlinePrefixJuridiska") : t("legalInlinePrefixPakalpojums");
  const cls =
    tone === "dark"
      ? "mx-auto max-w-[min(100%,85ch)] text-balance text-center text-[10px] font-normal leading-relaxed text-[#b8bcc4]/80 sm:text-xs"
      : "mx-auto max-w-[min(100%,85ch)] text-balance text-center text-[10px] font-normal leading-relaxed text-gray-400 sm:text-xs";

  if (!isComplete) {
    const publicBrand = getCompanyPublicBrand();
    const isDev = process.env.NODE_ENV === "development";
    return (
      <p className={cls}>
        {omitPrefix ? null : <span>{prefix} </span>}
        {publicBrand}
        {isDev ? (
          <span
            className={`mt-1 block text-[9px] leading-snug ${tone === "dark" ? "text-[#b8bcc4]/70" : "text-gray-400/90"}`}
          >
            {t("companyIncompleteDev")}
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <p className={cls}>
      {omitPrefix ? null : <span>{prefix} </span>}
      {legalName}, Reģ. nr. {regNo}, {legalAddress}
    </p>
  );
}
