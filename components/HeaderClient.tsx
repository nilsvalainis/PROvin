"use client";

import { useEffect, useMemo, useState } from "react";
import { LogIn, Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  buildSiteRailSections,
  normalizeSitePath,
  type SiteRailLabelKey,
} from "@/lib/site-rail-sections";
import { renderProvinText } from "@/lib/provin-wordmark";
import { AzvinLocaleSwitcher } from "@/components/demo/azvin/AzvinLocaleSwitcher";
import { AzvinAboutNavLink } from "@/components/demo/azvin/AzvinAboutNavLink";

/** Mājas navigācijas rindkopas kā `/#…` vai `/biezi-jautajumi`. */
export function HeaderClient() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const targetLocale = locale === "lv" ? "en" : "lv";
  /** Rāda tekošās valodas karogu; klikšķis joprojām pārslēdz uz otru valodu. */
  const localeFlag = locale === "lv" ? "🇱🇻" : "🇬🇧";
  const localeLabel = locale === "lv" ? "Switch to English" : "Pārslēgt uz latviešu valodu";
  const normalizedPath = normalizeSitePath(pathname);
  const isProvinSelectPieteikums = normalizedPath === "/provin-select-pieteikums";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tHeader = useTranslations("Header");
  const tRail = useTranslations("SiteRail");

  const isHome = normalizedPath === "/" || normalizedPath === "";
  const isPakalpojumi = normalizedPath === "/pakalpojumi";
  const isParMums = normalizedPath === "/par-mums";
  const isBlogs = normalizedPath === "/blogs" || normalizedPath.startsWith("/blogs/");
  const isFaqPage = normalizedPath === "/biezi-jautajumi";
  const isPartneriem = normalizedPath === "/partneriem" || normalizedPath.startsWith("/partneriem/");
  /** Tās pašas lapas kā kreisā slide — arī šeit navigācijas saraksts. */
  const showHomeNavRail =
    isHome ||
    normalizedPath === "/pasutit" ||
    isFaqPage ||
    isPakalpojumi ||
    isParMums ||
    isBlogs ||
    normalizedPath === "/partneriem";

  const isAzvinDemo = pathname.includes("/demo/azvin");
  /**
   * Tumšais headeris — sākums / pakalpojumi / Par mums / blogs / BUJ / SELECT / azvin.
   */
  const isDarkHeaderSurface =
    isHome ||
    isProvinSelectPieteikums ||
    isAzvinDemo ||
    isPakalpojumi ||
    isParMums ||
    isBlogs ||
    isFaqPage ||
    isPartneriem;
  const headerChromeDark = isDarkHeaderSurface;

  const headerSurface = isDarkHeaderSurface
    ? "border-b border-white/[0.08] bg-[#07080a]/96 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-[#07080a]/92"
    : "border-b border-black/[0.06] bg-white/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/75";

  const logoClass = headerChromeDark
    ? "flex min-h-9 min-w-9 shrink-0 items-center text-[23.18px] font-bold tracking-tight text-white transition-colors hover:text-white/90 lg:min-h-0 lg:min-w-0 lg:text-[28.98px]"
    : "flex min-h-9 min-w-9 shrink-0 items-center text-[23.18px] font-bold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent lg:min-h-0 lg:min-w-0 lg:text-[28.98px]";

  const navSections = useMemo(() => buildSiteRailSections(normalizedPath), [normalizedPath]);

  /** Tādas pašas PROVIN krāsas kā kreisās sliedes tekstiem. */
  const navLabelForKey = (labelKey: SiteRailLabelKey) => {
    const raw = tRail(labelKey);
    return raw.includes("PROVI")
      ? renderProvinText(raw, {
          proAndSuffixClassName: "provin-wordmark-pro--rail-inherit",
          vinAmberOnlyBeforeSelect: true,
        })
      : raw;
  };

  const navLabelWithHint = (labelKey: SiteRailLabelKey) => (
    <span className="inline-flex items-center gap-1">
      <span>{navLabelForKey(labelKey)}</span>
      {labelKey === "b2b" ? <LogIn className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden /> : null}
    </span>
  );

  const navLinkInactive = headerChromeDark
    ? "text-white/[0.88] hover:text-white"
    : "text-[#1d1d1f]/80 hover:text-[#0066ff]";

  /** Mobilā pilnekrāna izvēļņu panelis — vienots fons ar header režīmu */
  const mobilePanelBg = headerChromeDark
    ? "border-white/[0.08] bg-[#07080a]/96 backdrop-blur-md"
    : "border-black/[0.08] bg-white/95 backdrop-blur-md";

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  /** Aizver izvēlni navigācijas maiņās */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isFullBleedSiteNav =
    isHome ||
    isProvinSelectPieteikums ||
    isAzvinDemo ||
    isPakalpojumi ||
    isParMums ||
    isBlogs ||
    isFaqPage ||
    isPartneriem;

  const headerInnerClass = [
    "mx-auto flex min-h-[2.4rem] w-full min-w-0 items-center gap-1.5 pl-[max(0.8rem,env(safe-area-inset-left,0px))] pr-[max(0.8rem,env(safe-area-inset-right,0px))] sm:min-h-9 lg:min-h-11 lg:gap-3 lg:pl-[max(1rem,env(safe-area-inset-left,0px))] lg:pr-[max(1rem,env(safe-area-inset-right,0px))]",
    isFullBleedSiteNav ? "max-w-none" : "max-w-[980px] lg:max-w-[1024px]",
  ].join(" ");

  const logoShowsLvSuffix = !(
    isHome ||
    isPakalpojumi ||
    isParMums ||
    isBlogs ||
    isFaqPage ||
    isPartneriem
  );

  return (
    <header className={`sticky top-0 z-[42] isolate w-full ${headerSurface}`}>
      <div className={headerInnerClass}>
        {isAzvinDemo ? (
          <Link href="/demo/azvin" className={logoClass} aria-label="AZ.VIN">
            <span className={headerChromeDark ? "text-white" : "text-[#1d1d1f]"}>AZ.</span>
            <span className="text-provin-accent">VIN</span>
          </Link>
        ) : (
          <Link href="/" className={logoClass} aria-label={logoShowsLvSuffix ? "PROVIN.LV" : "PROVIN"}>
            <span className={headerChromeDark ? "text-white" : "text-[#1d1d1f]"}>PRO</span>
            <span className="text-provin-accent">VIN</span>
            {logoShowsLvSuffix ? (
              <span className={headerChromeDark ? "text-white" : "text-[#1d1d1f]"}>.LV</span>
            ) : null}
          </Link>
        )}

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 lg:gap-3">
          {showHomeNavRail ? (
            <nav
              className="relative z-[52] mr-1 ml-auto hidden min-w-0 flex-wrap items-center justify-end gap-x-4 lg:flex xl:gap-x-6"
              aria-label={tRail("navAria")}
            >
              {navSections.map((s) => (
                <Link
                  key={`${s.labelKey}:${s.href}`}
                  href={s.href}
                  prefetch={false}
                  className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] no-underline transition-colors ${navLinkInactive}`}
                  aria-label={s.labelKey === "b2b" ? tRail("b2bLoginAria") : undefined}
                >
                  {navLabelWithHint(s.labelKey)}
                </Link>
              ))}
            </nav>
          ) : null}

          {showHomeNavRail ? (
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="header-mobile-nav-panel"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className={`lg:hidden relative z-[52] inline-flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent p-0 outline-none shadow-none transition focus-visible:ring-2 focus-visible:ring-[#0066ff]/45 focus-visible:ring-offset-2 hover:bg-transparent ${
                headerChromeDark ? "text-white focus-visible:ring-offset-[#050505]" : "text-[#1d1d1f] focus-visible:ring-offset-white"
              }`}
              aria-label={mobileMenuOpen ? tHeader("menuClose") : tHeader("menuOpen")}
            >
              {mobileMenuOpen ? <X className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            </button>
          ) : null}

          {isAzvinDemo ? (
            <>
              <AzvinAboutNavLink
                className={`relative z-[52] mr-1 hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] no-underline transition-colors sm:inline-flex ${navLinkInactive}`}
              />
              <AzvinLocaleSwitcher dark={headerChromeDark} />
            </>
          ) : (
            <Link
              href={pathname as never}
              locale={targetLocale}
              className={`relative z-[52] inline-flex min-h-[1.8rem] min-w-[1.8rem] shrink-0 items-center justify-center text-[13.8px] leading-none no-underline transition lg:min-h-[2.25rem] lg:min-w-[2.25rem] lg:text-[calc(17px*1.15)] ${
                headerChromeDark ? "text-white hover:text-white/80" : "text-[#1d1d1f] hover:text-[#111827]"
              }`}
              aria-label={localeLabel}
              title={localeLabel}
            >
              <span aria-hidden>{localeFlag}</span>
            </Link>
          )}
        </div>
      </div>

      {showHomeNavRail && mobileMenuOpen ? (
        <div id="header-mobile-nav-panel" className={`relative z-[44] lg:hidden ${mobilePanelBg} border-t`}>
          <nav aria-label={tRail("navAria")} className="flex flex-col gap-px py-2.5 pr-[max(0.8rem,env(safe-area-inset-right))] pl-[max(0.8rem,env(safe-area-inset-left))] lg:py-3 lg:pl-[max(1rem,env(safe-area-inset-left))] lg:pr-[max(1rem,env(safe-area-inset-right))]">
            {navSections.map((s) => (
              <Link
                key={`mob-${s.labelKey}:${s.href}`}
                href={s.href}
                prefetch={false}
                onClick={() => setMobileMenuOpen(false)}
                className={`min-h-[2.4rem] shrink-0 content-center px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] no-underline outline-none ring-inset transition focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#0066ff]/35 lg:min-h-[3rem] lg:py-2.5 lg:text-[12px] ${navLinkInactive}`}
                aria-label={s.labelKey === "b2b" ? tRail("b2bLoginAria") : undefined}
              >
                {navLabelWithHint(s.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
