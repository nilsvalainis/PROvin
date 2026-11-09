import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { wrapFirstVinCheckPhrase } from "@/lib/seo-vin-check-internal-link";
import { vinCheckHref } from "@/lib/paths";

/** Same accent underline as HomeVinSeoSection body links. */
export const VIN_CHECK_INLINE_LINK_CLASS =
  "text-[#5c9dff] underline decoration-[#5c9dff]/40 underline-offset-[3px] transition hover:text-white";

/** Inherit parent type so a heading wrap does not shrink or restyle the title. */
export const VIN_CHECK_INHERIT_LINK_CLASS =
  "text-inherit underline decoration-[#5c9dff]/40 underline-offset-[3px] transition hover:text-[#5c9dff]";

export function VinCheckTextLink({
  children,
  className = VIN_CHECK_INLINE_LINK_CLASS,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={vinCheckHref()} className={className}>
      {children}
    </Link>
  );
}

/** Turns the first existing VIN-check phrase into a crawlable locale-prefixed link. */
export function LinkedVinCheckText({
  text,
  locale,
  className,
}: {
  text: string;
  locale: string;
  className?: string;
}) {
  const parts = wrapFirstVinCheckPhrase(text, locale);
  if (!parts) return text;
  return (
    <>
      {parts.before}
      <VinCheckTextLink className={className}>{parts.phrase}</VinCheckTextLink>
      {parts.after}
    </>
  );
}
