import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroVisual } from "@/components/HeroVisual";
import { WhatsAppBrandIcon } from "@/components/WhatsAppBrandIcon";
import { contactMailtoHref, whatsappChatUrl } from "@/lib/contact";
import { homePath } from "@/lib/paths";
import { CompanyLegalDisclosure } from "@/components/CompanyLegalDisclosure";

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

export async function Footer() {
  const t = await getTranslations("Footer");
  const locale = await getLocale();
  const mailHref = contactMailtoHref();
  const waHref = whatsappChatUrl();
  const homeHref = homePath(locale);

  const linkRow =
    "group inline-flex items-center gap-2 rounded-lg py-1 text-[13px] font-medium text-[#1d1d1f] transition-colors hover:text-provin-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent";

  return (
    <footer className="relative overflow-hidden border-t border-black/[0.06]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <HeroVisual />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-white/75 via-white/40 to-transparent" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.28]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto min-w-0 max-w-[1200px] px-4 py-6 sm:px-6 sm:py-7 lg:py-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-stretch sm:gap-0">
          <div className="min-w-0 flex-1 sm:pr-6 lg:pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-provin-accent sm:text-[12px]">
              {t("contacts")}
            </p>
            <p className="mt-2 text-[12px] font-normal leading-snug text-[#424245] sm:mt-2.5 sm:text-[13px] sm:leading-relaxed">
              {t("contactsHint")}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
              <a href={mailHref} className={linkRow}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-provin-accent/10 text-provin-accent transition group-hover:bg-provin-accent/15">
                  <MailIcon className="h-4 w-4" />
                </span>
                <span className="border-b border-dashed border-black/[0.12] pb-px group-hover:border-black/[0.22]">
                  {t("emailCta")}
                </span>
              </a>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className={linkRow}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-provin-accent/10 text-provin-accent transition group-hover:bg-provin-accent/15">
                  <WhatsAppBrandIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="border-b border-dashed border-black/[0.12] pb-px group-hover:border-black/[0.22]">
                  {t("whatsapp")}
                </span>
              </a>
            </div>
          </div>

          <div
            className="hidden shrink-0 self-stretch sm:block sm:w-[2px] sm:rounded-full sm:bg-black/[0.1]"
            aria-hidden
          />

          <div className="min-w-0 flex-1 sm:pl-6 lg:pl-8">
            <Link
              href={homeHref}
              className="inline-flex text-[18px] font-semibold tracking-tight text-[#1d1d1f] transition-colors hover:text-provin-accent sm:text-[19px]"
            >
              <span>PRO</span>
              <span className="text-provin-accent">VIN</span>
            </Link>

            <p className="mt-2.5 max-w-[42rem] text-[12px] font-normal leading-snug text-[#424245] sm:mt-3 sm:text-[13px] sm:leading-relaxed">
              {t("body")}
            </p>
          </div>
        </div>

        <div
          className="mx-auto mt-6 max-w-[1200px] space-y-4 border-t border-black/[0.08] pt-5 text-center sm:mt-8 sm:space-y-3 sm:pt-6"
          role="region"
          aria-label={t("legalRegionLabel")}
        >
          <div className="mx-auto max-w-[65ch] text-left">
            <div className="max-sm:rounded-xl max-sm:border max-sm:border-black/[0.08] max-sm:bg-white/[0.72] max-sm:px-3 max-sm:py-3.5 max-sm:shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <CompanyLegalDisclosure className="not-italic text-[10px] leading-snug text-[#6e6e73] sm:text-[11px] sm:leading-relaxed" />
            </div>
          </div>
          <p className="mx-auto max-w-[65ch] text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
            {t("disclaimer")}
          </p>
          <p className="mx-auto flex max-w-[65ch] flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-black/[0.06] pt-4 text-[10px] font-normal leading-snug text-[#aeaeb2] sm:border-t-0 sm:pt-0 sm:text-[11px]">
            <Link
              href="/lietosanas-noteikumi"
              className="text-[#86868b] underline decoration-black/[0.15] underline-offset-2 transition hover:text-provin-accent hover:decoration-provin-accent/40"
            >
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="text-[#d2d2d7]">
              ·
            </span>
            <Link
              href="/privatuma-politika"
              className="text-[#86868b] underline decoration-black/[0.15] underline-offset-2 transition hover:text-provin-accent hover:decoration-provin-accent/40"
            >
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="text-[#d2d2d7]">
              ·
            </span>
            <span>{t("gdpr", { year: new Date().getFullYear() })}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
