import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MessageCircle } from "lucide-react";
import { HeroVisual } from "@/components/HeroVisual";
import { contactMailtoHref, whatsappChatUrl } from "@/lib/contact";
import { homePath } from "@/lib/paths";
import { CompanyLegalOneLine } from "@/components/CompanyLegalOneLine";

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
  "group inline-flex min-h-11 items-center gap-3 rounded-lg py-2 text-[13px] font-medium text-[#b8bcc4] transition-all duration-300 ease-in-out hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-0 sm:py-2.5";

const contactIconShellClass =
  "flex h-9 w-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[#b8bcc4] transition-all duration-300 ease-in-out will-change-[box-shadow,border-color] group-hover:border-provin-accent/45 group-hover:bg-white/[0.08] group-hover:text-white group-hover:shadow-[0_0_18px_rgba(59,130,246,0.45)]";

export async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const mailHref = contactMailtoHref();
  const waHref = whatsappChatUrl();
  const homeHref = homePath(locale);
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-transparent">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.12]">
        <HeroVisual />
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#050505]/95 via-[#050505]/85 to-[#050505]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.14]" aria-hidden />

      <div className="relative z-10 mx-auto min-w-0 max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-14 lg:gap-20">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-provin-accent sm:text-[12px]">
              {t("contacts")}
            </p>
            <p className="mt-2 text-[12px] font-normal leading-relaxed text-[#b8bcc4] sm:mt-2.5 sm:text-[13px]">
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
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={contactLinkClass}
              >
                <span className={contactIconShellClass}>
                  <MessageCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="border-b border-dashed border-white/20 pb-px transition-colors duration-300 group-hover:border-provin-accent/50">
                  {t("whatsapp")}
                </span>
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <Link
              href={homeHref}
              className="inline-flex text-[18px] font-semibold tracking-tight text-white transition-all duration-300 ease-in-out hover:text-provin-accent sm:text-[19px]"
            >
              <span>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>

            <p className="mt-3 max-w-[42rem] text-[11px] font-normal leading-[1.8] text-[#b8bcc4] sm:mt-4 sm:text-[12px]">
              {t("body")}
            </p>
          </div>
        </div>

        <div
          className="mx-auto mt-10 max-w-[1200px] space-y-4 border-t border-white/10 pt-8 text-center sm:mt-12 sm:space-y-3 sm:pt-10"
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          <p className="mx-auto max-w-[65ch] text-[9px] font-normal leading-relaxed text-[#b8bcc4]/75 sm:text-[10px]">
            {t("disclaimer")}
          </p>
          <p className="mx-auto flex max-w-[65ch] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[9px] font-normal leading-relaxed text-[#b8bcc4]/70 sm:text-[10px]">
            <Link
              href="/lietosanas-noteikumi"
              className="text-[#b8bcc4]/85 underline decoration-white/20 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/50"
            >
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="text-white/25">
              ·
            </span>
            <Link
              href="/privatuma-politika"
              className="text-[#b8bcc4]/85 underline decoration-white/20 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/50"
            >
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="text-white/25">
              ·
            </span>
            <span>{t("gdpr", { year: new Date().getFullYear() })}</span>
          </p>
          <div className="pt-2 text-center">
            <CompanyLegalOneLine variant="pakalpojums" tone="dark" />
          </div>
        </div>
      </div>
    </footer>
  );
}
