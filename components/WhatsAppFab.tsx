"use client";

import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { whatsappAppUrl, whatsappWebUrl } from "@/lib/contact";
import { isAzvinPublicPath } from "@/lib/azvin-public-path";
import { normalizeSitePath } from "@/lib/site-rail-sections";
import { CONSENT_STORAGE_KEY, PROVIN_CONSENT_UPDATED_EVENT, parseConsent } from "@/lib/cookie-consent";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20l1.3-4A8 8 0 1 1 8 18.8z" />
      <path d="M9 9.5c.3 2 1.8 3.7 4 4.6l1.2-1.2 1.8.8c-.2 1.2-1.1 1.8-2.2 1.7-3-.4-5.6-3-6-6-.1-1.1.5-2 1.7-2.2l.8 1.8z" />
    </svg>
  );
}

function isMobileHandset(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** Lapas, kur apakšējā pasūtīšanas poga nav vajadzīga (pasūtīšana, paldies, juridiskās). */
const NO_ORDER_BAR = ["/paldies", "/pasutit", "/lietosanas-noteikumi", "/privatuma-politika", "/apmaksa"];

/**
 * Telefonā: apakšējā josla «Pasūtīt auditu · 99,99 €» + WhatsApp (balta kontūra).
 * Datorā: maza, mierīga WhatsApp ikona labajā apakšā. Abi parādās pēc hero, paslēpjas pie kājenes,
 * telefonā arī ritinot uz leju, un tikai pēc sīkdatņu izvēles (lai nepārklājas ar sīkdatņu kartīti).
 */
export function WhatsAppFab() {
  const t = useTranslations("Misc");
  const pathname = usePathname() ?? "";
  const path = normalizeSitePath(pathname);
  const webHref = whatsappWebUrl();
  const [on, setOn] = useState(false);
  const [consentDone, setConsentDone] = useState(false);

  useEffect(() => {
    const readConsent = () => {
      try {
        setConsentDone(parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY)) !== null);
      } catch {
        setConsentDone(true);
      }
    };
    readConsent();
    window.addEventListener(PROVIN_CONSENT_UPDATED_EVENT, readConsent);
    return () => window.removeEventListener(PROVIN_CONSENT_UPDATED_EVENT, readConsent);
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    let down = false;
    const update = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 6) {
        down = y > lastY;
        lastY = y;
      }
      const footer = document.getElementById("kontakti");
      const nearFooter = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      const mobile = window.innerWidth <= 760;
      setOn(y > 520 && !nearFooter && (!down || !mobile));
    };
    /** Viens aprēķins kadrā: ritinot neizsaucam layout katram scroll notikumam. */
    let raf = 0;
    const schedule = () => {
      if (!raf) {
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          update();
        });
      }
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [pathname]);

  if (isAzvinPublicPath(pathname)) return null;
  if (path === "/partneriem" || path.startsWith("/partneriem/")) return null;

  const visible = on && consentDone;
  const showOrder = !NO_ORDER_BAR.some((p) => path === p || path.startsWith(`${p}/`));

  const onWhatsApp = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isMobileHandset()) return;
    e.preventDefault();
    window.location.href = whatsappAppUrl();
    window.setTimeout(() => {
      window.location.href = webHref;
    }, 700);
  };

  /* `aside` = landmark (axe "region"); elementi ir `position: fixed`, tāpēc ietinums izkārtojumu nemaina. */
  return (
    <aside aria-label={t("whatsappFab")}>
      <div className={`provin-order-bar${visible ? " is-on" : ""}`} aria-hidden={!visible}>
        <span className="provin-order-bar__slot" aria-hidden />
        {showOrder ? (
          <Link href="/#home-hero" className="provin-order-bar__cta provin-press" tabIndex={visible ? 0 : -1}>
            {t("orderBarCta")}
          </Link>
        ) : null}
        <a
          href={webHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWhatsApp}
          aria-label={t("whatsappFab")}
          className="provin-order-bar__wa provin-press"
          tabIndex={visible ? 0 : -1}
        >
          <WhatsAppIcon />
        </a>
      </div>
      <a
        href={webHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onWhatsApp}
        aria-label={t("whatsappFab")}
        className={`provin-whatsapp-fab2${visible ? " is-on" : ""}`}
        tabIndex={visible ? 0 : -1}
      >
        <WhatsAppIcon />
      </a>
    </aside>
  );
}
