"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn } from "lucide-react";
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
import { AZVIN_PUBLIC_PATH, isAzvinPublicPath } from "@/lib/azvin-public-path";
import { B2bLocaleSwitcher } from "@/components/b2b/B2bLocaleSwitcher";

const HEADER_LANGS = [
  { code: "lv", name: "Latviešu" },
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "de", name: "Deutsch" },
] as const;

/** Valodas izvēle «LV ⌄» (makets): datorā; telefonā valodas ir izvēlnes panelī. */
function HeaderLangMenu({ locale, pathname, label }: { locale: string; pathname: string; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={`provin-hdr-lang${open ? " is-open" : ""}`}>
      <button type="button" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>
        {locale.toUpperCase()}
        <i aria-hidden />
      </button>
      <div className="provin-hdr-lang-menu" role="group" aria-label={label} hidden={!open}>
        {HEADER_LANGS.map((l) => (
          <Link
            key={l.code}
            href={pathname as never}
            locale={l.code}
            className={l.code === locale ? "is-on" : undefined}
            onClick={() => setOpen(false)}
          >
            {l.name} <b>{l.code.toUpperCase()}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Mājas navigācijas rindkopas kā `/#…` vai `/biezi-jautajumi`. */
export function HeaderClient() {
  const pathname = usePathname() ?? "";
  const locale = useLocale();
  const normalizedPath = normalizeSitePath(pathname);
  const isProvinSelectPieteikums = normalizedPath === "/provin-select-pieteikums";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);
  const tHeader = useTranslations("Header");
  const tRail = useTranslations("SiteRail");
  const tMisc = useTranslations("Misc");

  /** Pilna navigācija visām publiskajām lapām (makets), izņemot partneru kontu, azvin un iekšējās plūsmas. */
  const showHomeNavRail =
    (!isAzvinPublicPath(pathname) &&
      !normalizedPath.startsWith("/partneriem/") &&
      !normalizedPath.startsWith("/provin-select-pieteikums") &&
      ["/papildinajums", "/view", "/demo", "/dev"].every(
        (prefix) => normalizedPath !== prefix && !normalizedPath.startsWith(`${prefix}/`),
      ));

  const isAzvinDemo = isAzvinPublicPath(pathname);
  /**
   * Gaišais headeris paliek tikai iekšējām / vecajām plūsmām; visas publiskās lapas (arī 404) ir tumšas.
   */
  const isLightHeaderRoute = ["/pasutit", "/papildinajums", "/view", "/demo", "/dev"].some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
  const isDarkHeaderSurface = isAzvinDemo || isProvinSelectPieteikums || !isLightHeaderRoute;
  const headerChromeDark = isDarkHeaderSurface;

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
      {labelKey === "b2b" ? <LogIn className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden /> : null}
    </span>
  );


  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  /** Atvērtai izvēlnei lapa neritinās zem tās */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("provin-menu-open");
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("provin-menu-open");
    };
  }, [mobileMenuOpen]);

  /** Aizver izvēlni navigācijas maiņās */
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);


  const centerNav = navSections.filter((s) => s.labelKey !== "b2b");
  const partnerLabel = tRail("b2b");

  return (
    <header className={`provin-hdr relative z-[60] isolate w-full ${headerChromeDark ? "provin-hdr--dark" : "provin-hdr--light"}`}>
      <div className="provin-hdr-in">
        {isAzvinDemo ? (
          <Link href={AZVIN_PUBLIC_PATH} className="provin-hdr-logo" aria-label="AZ.VIN">
            <span>AZ.</span>
            <b>VIN</b>
          </Link>
        ) : (
          <Link href="/" className="provin-hdr-logo" aria-label="PROVIN">
            <span>PRO</span>
            <b>VIN</b>
          </Link>
        )}

        {showHomeNavRail ? (
          <nav className="provin-hdr-nav" aria-label={tRail("navAria")}>
            {centerNav.map((s) => {
              const active = normalizeSitePath(s.href) === normalizedPath;
              return (
                <Link
                  key={`${s.labelKey}:${s.href}`}
                  href={s.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  className={active ? "is-active" : undefined}
                >
                  {tRail(s.labelKey)}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <div className="provin-hdr-r">
          {isAzvinDemo ? (
            <>
              <AzvinAboutNavLink className="relative z-[52] mr-1 hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] no-underline transition-colors sm:inline-flex text-white/[0.88] hover:text-white" />
              <AzvinLocaleSwitcher dark={headerChromeDark} />
            </>
          ) : showHomeNavRail ? (
            <HeaderLangMenu locale={locale} pathname={pathname} label={tHeader("langGroupAria")} />
          ) : (
            <B2bLocaleSwitcher dark={headerChromeDark} compact />
          )}

          {showHomeNavRail ? (
            <Link href="/partneriem" prefetch={false} className="provin-hdr-partner provin-press" aria-label={tRail("b2bLoginAria")}>
              {partnerLabel} <span aria-hidden>→</span>
            </Link>
          ) : null}

          {showHomeNavRail ? (
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="header-mobile-nav-panel"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className={`provin-menu-btn lg:hidden relative z-[52] inline-flex h-11 w-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 outline-none shadow-none ${
                mobileMenuOpen ? "is-open" : ""
              } ${headerChromeDark ? "text-white" : "text-[#1d1d1f]"}`}
              aria-label={mobileMenuOpen ? tHeader("menuClose") : tHeader("menuOpen")}
            >
              <i aria-hidden />
              <i aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {showHomeNavRail && portalReady ? createPortal(
        <div
          id="header-mobile-nav-panel"
          className={`provin-menu-panel lg:hidden${mobileMenuOpen ? " is-open" : ""}`}
          aria-hidden={!mobileMenuOpen}
        >
          <nav aria-label={tRail("navAria")} className="provin-menu-nav">
            {navSections.map((s) => (
              <Link
                key={`mob-${s.labelKey}:${s.href}`}
                href={s.href}
                prefetch={false}
                tabIndex={mobileMenuOpen ? 0 : -1}
                onClick={() => setMobileMenuOpen(false)}
                className={normalizeSitePath(s.href) === normalizedPath ? "is-active" : undefined}
                aria-label={s.labelKey === "b2b" ? tRail("b2bLoginAria") : undefined}
              >
                {navLabelWithHint(s.labelKey)}
              </Link>
            ))}
          </nav>
          <div className="provin-menu-langs" role="group" aria-label={tHeader("langGroupAria")}>
              <Link
                href={pathname as never}
                locale="lv"
                className={`provin-menu-lang${locale === "lv" ? " is-on" : ""}`}
              >
                {tHeader("langLv")}
              </Link>
              <Link
                href={pathname as never}
                locale="en"
                className={`provin-menu-lang${locale === "en" ? " is-on" : ""}`}
              >
                {tHeader("langEn")}
              </Link>
              <Link
                href={pathname as never}
                locale="ru"
                className={`provin-menu-lang${locale === "ru" ? " is-on" : ""}`}
              >
                {tHeader("langRu")}
              </Link>
              <Link
                href={pathname as never}
                locale="de"
                className={`provin-menu-lang${locale === "de" ? " is-on" : ""}`}
              >
                {tHeader("langDe")}
              </Link>
          </div>
          <Link
            href="/#home-hero"
            tabIndex={mobileMenuOpen ? 0 : -1}
            onClick={() => setMobileMenuOpen(false)}
            className="provin-menu-cta provin-press"
          >
            {tMisc("orderBarCta")}
          </Link>
        </div>,
        document.body,
      ) : null}
    </header>
  );
}
