import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroVisual } from "@/components/HeroVisual";
import { contactMailtoHref } from "@/lib/contact";
import { homePath } from "@/lib/paths";
import { CompanyLegalOneLine } from "@/components/CompanyLegalOneLine";
import { homeContentMaxClass } from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

const contactLinkClass =
  "home-footer-link group inline-flex min-h-11 items-center gap-3 rounded-lg py-2 text-[13px] font-medium transition-all duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-0 sm:py-2.5";

const contactIconShellClass =
  "flex h-9 w-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[#b8bcc4] transition-all duration-300 ease-in-out will-change-[box-shadow,border-color] group-hover:border-provin-accent/45 group-hover:bg-white/[0.08] group-hover:text-white group-hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]";

export async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const mailHref = contactMailtoHref();
  const homeHref = homePath(locale);
  return (
    <footer
      id="kontakti"
      className="home-footer-rule relative scroll-mt-14 overflow-hidden border-t border-transparent bg-transparent sm:scroll-mt-16"
    >
      <div className="home-footer-scrim pointer-events-none absolute inset-0 z-0 opacity-[0.12]">
        <HeroVisual />
      </div>
      <div
        className="home-footer-scrim pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#050505]/95 via-[#050505]/85 to-[#050505]"
        aria-hidden
      />
      <div className="home-footer-scrim pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.14]" aria-hidden />

      <div className={`relative z-10 ${homeContentMaxClass} px-4 pb-3 pt-8 sm:px-6 sm:pb-4 sm:pt-10 lg:pb-5 lg:pt-12`}>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-14 lg:gap-20">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-provin-accent sm:text-[12px]">
              {t("contacts")}
            </p>
            <p className="home-footer-ink mt-2 text-[12px] font-normal leading-relaxed sm:mt-2.5 sm:text-[13px]">
              {t("contactsHint")}
            </p>
            <div className="mt-4 flex flex-col gap-1 sm:mt-5">
              <a href={mailHref} className={contactLinkClass}>
                <span className={contactIconShellClass}>
                  <MailIcon className="h-4 w-4" />
                </span>
                <span className="border-b border-dashed border-white/20 pb-px transition-colors duration-300 group-hover:border-provin-accent/50">
                  {t("emailCta")}
                </span>
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <Link
              href={homeHref}
              className="home-footer-ink inline-flex text-[18px] font-semibold tracking-tight transition-all duration-300 ease-in-out hover:text-provin-accent sm:text-[19px]"
            >
              <span>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>

            <p className="home-footer-ink mt-3 max-w-[42rem] text-[11px] font-normal leading-[1.8] sm:mt-4 sm:text-[12px]">
              {t("body")}
            </p>
          </div>
        </div>

        <div
          className={`home-footer-rule mx-auto mt-10 ${homeContentMaxClass} space-y-4 border-t border-transparent pt-8 text-center sm:mt-12 sm:space-y-3 sm:pt-10`}
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          <p className="home-footer-ink mx-auto max-w-[65ch] text-[9px] font-normal leading-relaxed opacity-90 sm:text-[10px]">
            {t("disclaimer")}
          </p>
          <p className="home-footer-ink mx-auto flex max-w-[65ch] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[9px] font-normal leading-relaxed opacity-85 sm:text-[10px]">
            <Link
              href="/lietosanas-noteikumi"
              className="home-footer-link underline decoration-white/25 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/50"
            >
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="opacity-35">
              ·
            </span>
            <Link
              href="/privatuma-politika"
              className="home-footer-link underline decoration-white/25 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/50"
            >
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="opacity-35">
              ·
            </span>
            <span>{renderProvinText(t("gdpr", { year: new Date().getFullYear() }))}</span>
          </p>
          <details className="group mx-auto pt-2 pb-0 text-center">
            <summary className="mx-auto inline-flex cursor-pointer list-none select-none items-center justify-center rounded-md px-2 py-1 text-[10px] font-normal uppercase tracking-[0.14em] text-[#3f4248] transition-colors hover:bg-white/[0.04] hover:text-[#55585f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/20 [&::-webkit-details-marker]:hidden">
              {t("serviceProviderDisclosureSummary")}
            </summary>
            <div className="mt-2 border-t border-white/[0.06] pt-2 pb-0">
              <CompanyLegalOneLine omitPrefix variant="pakalpojums" tone="dark" />
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
