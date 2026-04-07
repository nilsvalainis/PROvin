import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { orderSectionHref } from "@/lib/paths";

export async function Header() {
  const t = await getTranslations("Header");
  const locale = await getLocale();
  const orderHref = orderSectionHref(locale);

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex min-h-12 max-w-[980px] items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:min-h-11 sm:gap-3 sm:px-6 lg:max-w-[1024px]">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center text-[21px] font-semibold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0"
        >
          <span>PRO</span>
          <span className="text-provin-accent">VIN</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          <Link
            href={orderHref}
            className="provin-btn provin-btn--compact inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full px-3.5 text-[11px] font-normal shadow-[0_2px_10px_rgba(0,0,0,0.1)] sm:min-h-0 sm:py-[7px] sm:text-[13px]"
          >
            {t("order")}
          </Link>
        </div>
      </div>
    </header>
  );
}
