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
  "group inline-flex items-center gap-3 rounded-lg py-2 text-[13px] font-medium text-[#374151] transition-all duration-300 ease-in-out hover:text-provin-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:py-2.5";

const contactIconShellClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-all duration-300 ease-in-out group-hover:bg-provin-accent/10 group-hover:text-provin-accent";

export async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const mailHref = contactMailtoHref();
  const waHref = whatsappChatUrl();
  const homeHref = homePath(locale);
  return (
    <footer className="relative overflow-hidden border-t border-[#ececec] bg-white">
      <div className="pointer-events-none absolute inset-0 z-0">
        <HeroVisual />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/85 via-white/55 to-white" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.2]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto min-w-0 max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-14 lg:gap-20">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-provin-accent sm:text-[12px]">
              {t("contacts")}
            </p>
            <p className="mt-2 text-[12px] font-normal leading-relaxed text-[#6b7280] sm:mt-2.5 sm:text-[13px]">
              {t("contactsHint")}
            </p>
            <div className="mt-4 flex flex-col gap-1 sm:mt-5">
              <a href={mailHref} className={contactLinkClass}>
                <span className={contactIconShellClass}>
                  <MailIcon className="h-4 w-4" />
                </span>
                <span className="border-b border-dashed border-neutral-300 pb-px transition-colors duration-300 group-hover:border-provin-accent/40">
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
                <span className="border-b border-dashed border-neutral-300 pb-px transition-colors duration-300 group-hover:border-provin-accent/40">
                  {t("whatsapp")}
                </span>
              </a>
            </div>
          </div>

          <div className="min-w-0">
            <Link
              href={homeHref}
              className="inline-flex text-[18px] font-semibold tracking-tight text-[#1d1d1f] transition-all duration-300 ease-in-out hover:text-provin-accent sm:text-[19px]"
            >
              <span>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>

            <p className="mt-3 max-w-[42rem] text-[11px] font-normal leading-[1.8] text-[#6b7280] sm:mt-4 sm:text-[12px]">
              {t("body")}
            </p>
          </div>
        </div>

        <div
          className="mx-auto mt-10 max-w-[1200px] space-y-4 border-t border-[#ececec] pt-8 text-center sm:mt-12 sm:space-y-3 sm:pt-10"
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          <p className="mx-auto max-w-[65ch] text-[9px] font-normal leading-relaxed text-[#9ca3af] sm:text-[10px]">
            {t("disclaimer")}
          </p>
          <p className="mx-auto flex max-w-[65ch] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[9px] font-normal leading-relaxed text-[#b0b0b8] sm:text-[10px]">
            <Link
              href="/lietosanas-noteikumi"
              className="text-[#9ca3af] underline decoration-neutral-300 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/40"
            >
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="text-[#d8d8dc]">
              ·
            </span>
            <Link
              href="/privatuma-politika"
              className="text-[#9ca3af] underline decoration-neutral-300 underline-offset-2 transition-all duration-300 ease-in-out hover:text-provin-accent hover:decoration-provin-accent/40"
            >
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="text-[#d8d8dc]">
              ·
            </span>
            <span>{t("gdpr", { year: new Date().getFullYear() })}</span>
          </p>
          <div className="pt-2 text-center">
            <CompanyLegalOneLine variant="pakalpojums" />
          </div>
        </div>
      </div>
    </footer>
  );
}
