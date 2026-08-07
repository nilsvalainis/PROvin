import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { contactMailtoHref } from "@/lib/contact";
import { CompanyLegalOneLine } from "@/components/CompanyLegalOneLine";
import { renderProvinText } from "@/lib/provin-wordmark";

const linkClass =
  "home-footer-link text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white";

const legalLinkClass =
  "home-footer-link underline decoration-white/20 underline-offset-2 transition hover:text-provin-accent hover:decoration-provin-accent/50";

/**
 * Kompakta kājene — tā pati 80rem / 7+5 asimetrija un diskrētā līnija kā atsauksmes + BUJ.
 */
export async function Footer() {
  const t = await getTranslations("Footer");
  const mailHref = contactMailtoHref();
  const year = new Date().getFullYear();

  return (
    <footer id="kontakti" className="home-footer-rule relative scroll-mt-14 bg-transparent sm:scroll-mt-16">
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-6 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-7 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
          <div className="min-w-0 lg:col-span-7">
            <Link
              href="/"
              className="home-footer-ink inline-flex text-[15px] font-semibold tracking-tight transition hover:text-provin-accent"
            >
              <span className="provin-wordmark-pro">PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>
            <p className="home-footer-ink mt-3 max-w-[36rem] text-[12px] font-normal leading-[1.55] text-white/45 sm:text-[13px] sm:leading-[1.5]">
              {t("body")}
            </p>
          </div>

          <div className="min-w-0 border-t border-white/[0.08] pt-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="w-full max-w-[27.5rem] lg:ml-auto">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                {t("contacts")}
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                <a href={mailHref} className={linkClass}>
                  {t("emailCta")}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-7 space-y-2.5 border-t border-white/[0.08] pt-5 sm:mt-8"
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          <p className="home-footer-ink max-w-[65ch] text-[9px] font-normal leading-relaxed text-white/35 sm:text-[10px]">
            {t("disclaimer")}
          </p>
          <p className="home-footer-ink flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-normal leading-relaxed text-white/40 sm:text-[10px]">
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
          <div className="pt-0.5 text-left [&_p]:mx-0 [&_p]:max-w-none [&_p]:text-left [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-white/30">
            <CompanyLegalOneLine omitPrefix variant="pakalpojums" tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
