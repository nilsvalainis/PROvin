"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { normalizeSitePath } from "@/lib/site-rail-sections";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";
import { SiteThemeHeaderButton } from "@/components/site-theme/SiteThemeHeaderButton";

export type HeaderClientProps = {
  orderLabel: string;
  orderHref: string;
  faqHref: string;
  navHome: string;
  faqLabel: string;
  menuOpenLabel: string;
  menuCloseLabel: string;
};

export function HeaderClient({}: HeaderClientProps) {
  const pathname = usePathname() ?? "";
  const normalizedPath = normalizeSitePath(pathname);
  const { theme } = useSiteTheme();

  const isHome = normalizedPath === "/" || normalizedPath === "";

  /** Lapas, kurām mobilajā ir sliežu izvēlne; desktop fiksētā sliede pagaidām izslēgta. */
  const logoAlignWithRailSakums =
    isHome || normalizedPath === "/pasutit" || normalizedPath === "/biezi-jautajumi";

  /** `false`, kamēr `SiteSectionRail` nav layout — citādi logo `lg` nobīde atsakās no neesošas sliedes. */
  const desktopSiteSectionRailEnabled = false;
  const alignLogoWithDesktopRail = logoAlignWithRailSakums && desktopSiteSectionRailEnabled;

  /** Sākumlapas „caurspīdīgais” hero headeris — tikai tumšajā tēmā; gaišajā — kā pārējās lapas. */
  const isDarkHeaderSurface = isHome && theme === "dark";

  const isDemoPath = pathname.includes("/demo");
  /** Demo tumšajā režīmā — grafīta josla kā atsevišķs „chrome”, nevis caurspīdīgs hero. */
  const isDemoGraphiteHeader = isDemoPath && theme === "dark";
  const headerChromeDark = isDarkHeaderSurface || isDemoGraphiteHeader;

  const themeBtnOnDarkHeroClass =
    "min-h-9 min-w-9 h-9 w-9 border-white/20 bg-white/[0.06] text-white hover:border-white/35 hover:bg-white/10 focus-visible:ring-[#0066ff]/40 focus-visible:ring-offset-[#050505]";
  const themeBtnGraphiteClass =
    "min-h-9 min-w-9 h-9 w-9 border-white/12 bg-white/[0.07] text-white hover:border-white/28 hover:bg-white/11 focus-visible:ring-[#0066ff]/40 focus-visible:ring-offset-[#383a40]";
  const themeBtnLightChromeClass =
    "min-h-9 min-w-9 h-9 w-9 border-black/[0.08] bg-white text-[#1d1d1f] shadow-sm hover:bg-slate-50 focus-visible:ring-[rgb(0_102_255/0.35)] focus-visible:ring-offset-white";

  const graphiteHeaderSurface =
    "border-b border-black/30 bg-[#383a40] pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#383a40]/94";

  const headerSurface = isDemoGraphiteHeader
    ? graphiteHeaderSurface
    : isDarkHeaderSurface
      ? "border-b border-white/[0.06] bg-transparent pt-[env(safe-area-inset-top,0px)] md:border-b md:border-white/[0.06]"
      : "border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75";

  /**
   * `lg+` ar fiksēto sliedi: PROVIN „P” apmēram virs zilā punkta — nobīde = `pl-1` + `pl-0.5` + `w-3` + `gap-2.5`;
   * ņem vērā header `max-w` + `px-6` centrējumu.
   */
  const logoRailMarginClass = alignLogoWithDesktopRail
    ? "lg:ml-[calc(max(0.5rem,env(safe-area-inset-left,0px))+1.75rem-(100vw-min(100vw,64rem))/2-1.5rem)]"
    : null;

  /**
   * Sākumlapas pilna platuma headeris (dark + light): logo ass salāgota ar sliedes marķieri.
   * Novērš situāciju, kad light režīmā logo aizslīd ārpus kreisās malas.
   */
  const logoHomeRailAlignClass =
    isHome && alignLogoWithDesktopRail
      ? "lg:ml-[calc(max(0.5rem,env(safe-area-inset-left,0px))+1.875rem-max(1rem,env(safe-area-inset-left,0px)))]"
      : null;

  /**
   * Sākumlapas hero ar pilna platuma headeri: vecā `lg:ml-[calc(…-(100vw-min(100vw,64rem))/2-1.5rem)]`
   * kompensēja centrētu `max-w` kasti — pilnam platumam tā rada milzīgu negatīvu nobīdi un „izzūd” PROVIN.
   * Sliežu lapām (nav hero) marķieris paliek kā līdz šim.
   */
  const logoClass = [
    headerChromeDark
      ? "flex min-h-11 min-w-11 shrink-0 items-center text-[28.98px] font-bold tracking-tight text-white transition-colors hover:text-white/90 sm:min-h-0 sm:min-w-0"
      : "flex min-h-11 min-w-11 shrink-0 items-center text-[28.98px] font-bold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:min-h-0 sm:min-w-0",
    !isDarkHeaderSurface && !isHome && !isDemoPath ? logoRailMarginClass : null,
    logoHomeRailAlignClass,
  ]
    .filter(Boolean)
    .join(" ");

  const mobileRailOnDark = isDarkHeaderSurface;

  /** Labās malas atkāpe = kreisās (kas logo): `max(1rem, safe-area)` — dark un light. */
  const desktopHeaderRowClass = [
    "mx-auto flex min-h-12 w-full items-center gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:min-h-11 sm:gap-3",
    isHome ? "max-w-none" : "max-w-[980px] lg:max-w-[1024px]",
    logoAlignWithRailSakums ? "hidden md:flex" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className={`sticky top-0 z-[42] isolate w-full ${headerSurface}`}>
        {/* Mobilā „sliežu” lapa: PROVIN + izvēlne, kas izslīd uz leju (nav pilnekrāna) */}
        {logoAlignWithRailSakums ? (
          <div className="relative z-[50] w-full md:hidden">
            <div className="flex w-full items-center justify-between gap-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.25rem,env(safe-area-inset-top,0px))] pb-2">
              <Link
                href="/"
                className={`flex shrink-0 items-center text-[26px] font-bold tracking-tight ${mobileRailOnDark ? "text-white" : "text-[#1d1d1f]"}`}
                aria-label="PROVIN"
              >
                <span className={mobileRailOnDark ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
                <span className="text-provin-accent">VIN</span>
              </Link>
              <div className="flex min-w-0 shrink-0 items-center justify-end gap-1">
                <SiteThemeHeaderButton
                  className={mobileRailOnDark ? themeBtnOnDarkHeroClass : themeBtnLightChromeClass}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className={desktopHeaderRowClass}>
          <Link href="/" className={logoClass} aria-label={isHome ? "PROVIN" : "PROVIN.LV"}>
            <span className={headerChromeDark ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
            <span className="text-provin-accent">VIN</span>
            {isHome ? null : <span className={headerChromeDark ? "text-white" : "text-[#1d1d1f]"}>.LV</span>}
          </Link>

          <nav className="ml-auto hidden min-w-0 shrink-0 items-center justify-end gap-2 md:flex">
            <SiteThemeHeaderButton
              className={
                isDemoGraphiteHeader
                  ? themeBtnGraphiteClass
                  : headerChromeDark
                    ? themeBtnOnDarkHeroClass
                    : themeBtnLightChromeClass
              }
            />
          </nav>

        </div>
      </header>
    </>
  );
}
