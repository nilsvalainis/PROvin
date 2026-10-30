import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CONTACT_PHONE_DISPLAY, CONTACT_PHONE_TEL, contactMailtoHref, contactTelHref, whatsappWebUrl } from "@/lib/contact";
import { CompanyLegalOneLine } from "@/components/CompanyLegalOneLine";
import { renderProvinText } from "@/lib/provin-wordmark";
import { homeFooterColumnClass } from "@/lib/home-layout";

const linkClass =
  "home-footer-link text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white";

const navPillClass =
  "home-footer-link inline-flex min-h-[40px] items-center rounded-full border border-white/[0.12] px-4 text-[13px] font-semibold text-zinc-100 no-underline transition hover:border-white/30 hover:text-white";

const footerGhostBtn =
  "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 no-underline transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white";

const legalLinkClass =
  "home-footer-link underline decoration-white/20 underline-offset-2 transition hover:text-provin-accent hover:decoration-provin-accent/50";

function BrandWordmark({ large = false }: { large?: boolean }) {
  return (
    <Link
      href="/"
      className={`home-footer-ink inline-flex font-extrabold tracking-tight transition hover:text-provin-accent ${large ? "text-[1.6rem]" : "text-[15px]"}`}
    >
      <span className="provin-wordmark-pro">PRO</span>
      <span className="text-provin-accent">VIN</span>
    </Link>
  );
}

/**
 * Kompakta kājene — tā pati 80rem / 7+5 asimetrija un diskrētā līnija kā atsauksmes + BUJ.
 * B2B: PROVIN ir kājenes teksta virsraksts, kontakti vienā līnijā.
 */
export async function Footer({ variant = "public" }: { variant?: "public" | "b2b" } = {}) {
  const t = await getTranslations("Footer");
  const mailHref = contactMailtoHref();
  const phoneHref = contactTelHref();
  const year = new Date().getFullYear();
  const isB2b = variant === "b2b";

  const contacts = isB2b ? (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
      <span>{t("contacts")}</span>
      <a href={mailHref} className={linkClass}>
        {t("emailCta")}
      </a>
      <a href={phoneHref} className={linkClass} aria-label={t("phoneAria")}>
        {CONTACT_PHONE_TEL}
      </a>
    </p>
  ) : (
    <div className="flex flex-col gap-4 rounded-[20px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 sm:p-7">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{t("contacts")}</p>
      <p className="text-[1.15rem] font-bold text-zinc-50">{t("contactsHint")}</p>
      <div className="flex flex-wrap gap-2">
        <a href={whatsappWebUrl()} target="_blank" rel="noopener noreferrer" className={footerGhostBtn}>
          {t("whatsapp")}
        </a>
        <a href={mailHref} className={footerGhostBtn}>
          {t("emailShort")}
        </a>
      </div>
      <p className="text-[15px] text-zinc-400">
        {t("phoneLabel")}{" "}
        <a href={phoneHref} aria-label={t("phoneAria")} className="font-semibold text-zinc-50 no-underline transition hover:text-[#5c9dff]">
          {CONTACT_PHONE_DISPLAY}
        </a>
      </p>
    </div>
  );

  return (
    <footer id="kontakti" className="home-footer-rule relative scroll-mt-14 bg-transparent sm:scroll-mt-16">
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div className={`${homeFooterColumnClass} ${isB2b ? "py-5 lg:pb-6" : "py-10 sm:py-12 lg:pb-10 lg:pt-14"}`}>
        {isB2b ? null : (
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
            <div className="min-w-0 lg:col-span-7">
              <BrandWordmark large />
              <p className="home-footer-ink mt-4 max-w-[36rem] text-[15px] font-normal leading-[1.65] text-zinc-300">
                {t("body")}
              </p>
              <nav aria-label={t("navAria")} className="mt-6 flex flex-wrap gap-2">
                <Link href="/" className={navPillClass}>
                  {t("navHome")}
                </Link>
                <Link href="/pakalpojumi" className={navPillClass}>
                  {t("navServices")}
                </Link>
                <Link href="/vin-koda-parbaude" className={navPillClass}>
                  {t("navVinCheck")}
                </Link>
                <Link href="/biezi-jautajumi" className={navPillClass}>
                  {t("navFaq")}
                </Link>
                <Link href="/par-mums" className={navPillClass}>
                  {t("navAbout")}
                </Link>
                <Link href="/blogs" className={navPillClass}>
                  {t("navBlog")}
                </Link>
              </nav>
            </div>

            <div className="min-w-0 lg:col-span-5">
              {contacts}
            </div>
          </div>
        )}

        <div
          className={
            isB2b
              ? "space-y-2.5"
              : "mt-10 space-y-3 border-t border-[#1d2130] pt-7 sm:mt-12"
          }
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          {isB2b ? (
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <BrandWordmark />
              {contacts}
            </div>
          ) : null}
          <p className={`home-footer-ink max-w-[65ch] font-normal leading-relaxed ${isB2b ? "text-[9px] text-white/35 sm:text-[10px]" : "text-[12px] text-zinc-400"}`}>
            {t("disclaimer")}
          </p>
          <p className={`home-footer-ink flex flex-wrap items-center gap-x-2 gap-y-1 font-normal leading-relaxed ${isB2b ? "text-[9px] text-white/40 sm:text-[10px]" : "text-[12px] text-zinc-400"}`}>
            <Link href="/lietosanas-noteikumi" className={legalLinkClass}>
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <Link href="/privatuma-politika" className={legalLinkClass}>
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="text-white/20">
              ·
            </span>
            <span>{renderProvinText(t("gdpr", { year }))}</span>
          </p>
          <details className="group pt-0.5">
            <summary className="inline-flex cursor-pointer list-none select-none text-[9px] font-normal text-white/20 transition hover:text-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20 [&::-webkit-details-marker]:hidden">
              {t("serviceProviderDisclosureSummary")}
            </summary>
            <div className="mt-1 [&_p]:mx-0 [&_p]:max-w-none [&_p]:text-left [&_p]:text-[9px] [&_p]:leading-relaxed [&_p]:text-white/30">
              <CompanyLegalOneLine omitPrefix variant="pakalpojums" tone="dark" />
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
