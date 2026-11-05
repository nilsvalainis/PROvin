import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { contactMailtoHref, whatsappWebUrl } from "@/lib/contact";
import { LegalReveal, companyLegalLine } from "@/components/LegalReveal";
import { getCompanyLegal } from "@/lib/company";
import { FooterWordmarkReveal } from "@/components/FooterWordmarkReveal";
import { renderProvinText } from "@/lib/provin-wordmark";
import { homeFooterColumnClass } from "@/lib/home-layout";

const linkClass =
  "home-footer-link text-[11px] font-semibold uppercase tracking-[0.16em] text-provin-accent no-underline transition hover:text-white";

const legalLinkClass = "home-footer-link font-semibold text-zinc-300 no-underline transition hover:text-white";

const ctaBtn =
  "provin-press inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-bold no-underline transition hover:-translate-y-0.5";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z" />
      <path d="M9 9.5c.3 2 1.8 3.7 4 4.6l1.2-1.2 1.8.8c-.2 1.2-1.1 1.8-2.2 1.7-3-.4-5.6-3-6-6-.1-1.1.5-2 1.7-2.2l.8 1.8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18v12H3z" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

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
 * Kājene M2 (03.11): liels «Jautājumi? Sazinies ar mums.», WhatsApp + e-pasts, lapas sarakstā,
 * apakšā nogriezta PROVIN vārdzīme. Tālruni nerāda (Nils 03.11). B2B: kompakta rinda.
 */
export async function Footer({ variant = "public" }: { variant?: "public" | "b2b" } = {}) {
  const t = await getTranslations("Footer");
  const mailHref = contactMailtoHref();
  const year = new Date().getFullYear();

  if (variant === "b2b") {
    return (
      <footer id="kontakti" className="home-footer-rule relative scroll-mt-14 bg-transparent sm:scroll-mt-16">
        <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" aria-hidden />
        <div className={`${homeFooterColumnClass} space-y-2.5 py-5 lg:pb-6`} role="region" aria-label={t("legalRegionLabel")}>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <BrandWordmark />
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
              <span>{t("contacts")}</span>
              <a href={mailHref} className={linkClass}>
                {t("emailCta")}
              </a>
            </p>
          </div>
          <p className="home-footer-ink max-w-[65ch] text-[9px] font-normal leading-relaxed text-white/35 sm:text-[10px]">{t("disclaimer")}</p>
          <p className="home-footer-ink flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-normal leading-relaxed text-white/40 sm:text-[10px]">
            <Link href="/lietosanas-noteikumi" className={legalLinkClass}>
              {t("termsOfService")}
            </Link>
            <span aria-hidden className="text-white/20">·</span>
            <Link href="/privatuma-politika" className={legalLinkClass}>
              {t("privacyPolicy")}
            </Link>
            <span aria-hidden className="text-white/20">·</span>
            <span>{renderProvinText(t("gdpr", { year }))}</span>
          </p>
        </div>
      </footer>
    );
  }

  const nav: { href: string; label: string }[] = [
    { href: "/", label: t("navHome") },
    { href: "/pakalpojumi", label: t("navServices") },
    { href: "/vin-koda-parbaude", label: t("navVinCheck") },
    { href: "/biezi-jautajumi", label: t("navFaq") },
    { href: "/par-mums", label: t("navAbout") },
    { href: "/blogs", label: t("navBlog") },
  ];
  const [hintA, ...hintRest] = t("contactsHint").split(" ");

  return (
    <footer id="kontakti" className="home-footer-rule provin-footer relative scroll-mt-14 overflow-hidden bg-transparent sm:scroll-mt-16">
      <div className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" aria-hidden />
      <div className={`${homeFooterColumnClass} pt-12 sm:pt-16 lg:pt-[4.5rem]`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t("contacts")}</p>
        <p className="provin-footer-hint mt-4 text-[clamp(2.6rem,8vw,6rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-white [text-wrap:balance]">
          {hintA}
          <br />
          <span className="provin-footer-hint__grad">{hintRest.join(" ")}</span>
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={whatsappWebUrl()} target="_blank" rel="noopener noreferrer" className={`${ctaBtn} bg-white text-[#0a0a0a]`}>
            <WhatsAppIcon />
            {t("whatsapp")}
          </a>
          <a href={mailHref} className={`${ctaBtn} border border-white/20 text-white hover:border-white`}>
            <MailIcon />
            {t("emailShort")}
          </a>
        </div>

        <div className="mt-14 grid gap-9 border-t border-white/[0.08] pt-9 sm:mt-[4.5rem] lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <BrandWordmark large />
            <p className="home-footer-ink mt-3.5 max-w-[29rem] text-[15px] font-normal leading-[1.65] text-zinc-400">{t("body")}</p>
          </div>
          <nav aria-label={t("navAria")} className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{t("pagesLabel")}</p>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-5 sm:gap-x-8">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="home-footer-link group flex items-center justify-between border-b border-white/[0.08] py-3.5 text-[15px] font-semibold text-zinc-200 no-underline transition-[color,padding] hover:pl-1 hover:text-white"
                  >
                    {n.label}
                    <span className="text-zinc-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white">
                      <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div role="region" aria-label={t("legalRegionLabel")} className="mt-10 space-y-4">
          <p className="home-footer-ink max-w-[860px] text-[12px] font-normal leading-[1.65] text-zinc-500">{t("disclaimer")}</p>
          <div className="flex flex-col gap-2.5 border-t border-white/[0.08] pt-4 text-[12px] leading-relaxed text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap gap-x-[18px] gap-y-1">
              <Link href="/lietosanas-noteikumi" className={legalLinkClass}>
                {t("termsOfService")}
              </Link>
              <Link href="/privatuma-politika" className={legalLinkClass}>
                {t("privacyPolicy")}
              </Link>
            </p>
            <p className="home-footer-ink">{renderProvinText(t("gdpr", { year }))}</p>
          </div>
          <LegalReveal line={companyLegalLine(getCompanyLegal(), t("companyRegNo"))} tone="dark" />
        </div>

        <FooterWordmarkReveal />
      </div>
    </footer>
  );
}
