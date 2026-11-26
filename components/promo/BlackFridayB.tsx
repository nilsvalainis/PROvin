"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useBlackFridayPlanPrice } from "@/components/promo/BlackFridayPromo";
import {
  blackFridayCountdownLine,
  blackFridayCountdownParts,
  getBlackFridayCopy,
} from "@/lib/promo/black-friday-copy";
import { formatPromoEur, omnibusLowestPriceLine, type BlackFridayPlanPrice } from "@/lib/promo/black-friday";
import s from "./black-friday-b.module.css";

/** Dīlera datu pasūtījums sākumlapas hero (next-intl pieliek valodas prefiksu). */
export const BF_DEALER_HREF = "/?plan=dealer#home-hero";
/** Logs tikai vienreiz sesijā. */
export const BF_POPUP_SESSION_KEY = "bf26-pop";
/** Lapas, kur logu un kapsulu nerāda (B2B partneru lapa, pasūtījuma/maksājuma plūsma, juridiskie teksti). */
const NO_OVERLAY_PREFIXES = ["/partneriem", "/paldies", "/pasutit", "/apmaksa", "/lietosanas-noteikumi", "/privatuma-politika", "/dev"];

function useNowEverySecond(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** «-30 %» -> «-30» + mazs «%». */
function Pct({ label, className }: { label: string; className?: string }) {
  const m = /^(.*?)\s*%$/.exec(label);
  if (!m) return <span className={className}>{label}</span>;
  return (
    <span className={className} aria-label={label}>
      {m[1]}
      <small className={s.pctSmall}>%</small>
    </span>
  );
}

function CountdownLine({ promo }: { promo: BlackFridayPlanPrice | null }) {
  const locale = useLocale();
  const c = getBlackFridayCopy(locale);
  const now = useNowEverySecond(Boolean(promo));
  return (
    <span className={s.cdl} role="timer" aria-label={c.timerAria} suppressHydrationWarning>
      {now == null ? "" : blackFridayCountdownLine(now, locale)}
    </span>
  );
}

function CountdownCells({ promo }: { promo: BlackFridayPlanPrice | null }) {
  const locale = useLocale();
  const c = getBlackFridayCopy(locale);
  const now = useNowEverySecond(Boolean(promo));
  const parts = now == null ? null : blackFridayCountdownParts(now);
  return (
    <span className={s.cells} role="timer" aria-label={c.timerAria}>
      {parts
        ? parts.map((v, i) => (
            <span key={c.units[i]} className={s.cell}>
              <b>{v}</b>
              <i>{c.units[i]}</i>
            </span>
          ))
        : null}
    </span>
  );
}

/** 1. Augšējā josla B. */
export function BlackFridayTopBarB() {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div className={`${s.root} ${s.top}`} role="region" aria-label={c.regionAria} data-promo-banner={promo.promoId}>
      <div className={s.topIn}>
        <span className={s.g}>
          <span className={s.eb}>{c.eyebrow}</span>
          <span className={`${s.pct} ${s.shine}`}>{promo.discountLabel}</span>
          <span className={s.sep} aria-hidden />
          <span className={s.topName}>{c.dealerLong}</span>
        </span>
        <span className={`${s.g} ${s.gPrice}`}>
          <span className={s.topPrice}>
            {formatPromoEur(promo.promoCents, locale)}
            <s>{formatPromoEur(promo.regularCents, locale)}</s>
          </span>
          <span className={s.omni}>{omnibusLowestPriceLine(promo.lowest30dCents, locale)}</span>
        </span>
        <span className={`${s.g} ${s.g2}`}>
          <span>
            <span className={s.lab}>{c.endsIn}</span>
            <CountdownLine promo={promo} />
          </span>
          <Link href={BF_DEALER_HREF} className={s.cta}>
            {c.order}
          </Link>
        </span>
      </div>
    </div>
  );
}

function overlayAllowed(pathname: string): boolean {
  const p = pathname || "/";
  return !NO_OVERLAY_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

/** 3. Telefona apakšējā stikla kapsula (tikai ≤720px, CSS). */
export function BlackFridayCapsuleB() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo || !overlayAllowed(pathname)) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div className={`${s.root} ${s.cap}`} role="region" aria-label={c.regionAria} data-promo-capsule>
      <span className={s.capL}>
        <span className={s.capT}>
          <span className={s.chip}>{promo.discountLabel}</span>
          {c.dealerShort}
        </span>
        <span className={s.capTm}>
          <CountdownLine promo={promo} />
        </span>
        <span className={s.omni}>{omnibusLowestPriceLine(promo.lowest30dCents, locale)}</span>
      </span>
      <Link href={BF_DEALER_HREF} className={s.cta}>
        {c.orderWithPrice(formatPromoEur(promo.promoCents, locale))}
      </Link>
    </div>
  );
}

function readPopupSeen(): boolean {
  try {
    return window.sessionStorage.getItem(BF_POPUP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPopupSeen(): void {
  try {
    window.sessionStorage.setItem(BF_POPUP_SESSION_KEY, "1");
  } catch {
    /* privātais režīms - logs var parādīties vēlreiz */
  }
}

/** Logs ar fokusa slazdu (prezentācijas daļa, testējama bez efektiem). */
export function BlackFridayDialogB({
  promo,
  locale,
  onClose,
  dialogRef,
}: {
  promo: BlackFridayPlanPrice;
  locale: string;
  onClose: () => void;
  dialogRef?: Ref<HTMLDivElement>;
}) {
  const c = getBlackFridayCopy(locale);
  const titleId = useId();
  const price = formatPromoEur(promo.promoCents, locale);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    /** Esc apstrādā `document` klausītājs (`BlackFridayPopupB`). */
    if (e.key !== "Tab") return;
    const nodes = e.currentTarget.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !e.currentTarget.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className={`${s.root} ${s.pop}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-promo-popup
    >
      <div
        ref={dialogRef}
        className={s.box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <button type="button" className={s.x} aria-label={c.close} onClick={onClose} data-bf-close>
          ×
        </button>
        <div className={s.boxC}>
          <span className={s.eb} id={titleId}>
            {c.popEyebrow}
          </span>
          <Pct label={promo.discountLabel} className={`${s.boxBig} ${s.shine}`} />
          <span className={s.boxName}>{c.dealerLong}</span>
          <span className={s.boxPrice}>
            <b>{price}</b>
            <s>{formatPromoEur(promo.regularCents, locale)}</s>
          </span>
          <span className={s.omni}>{omnibusLowestPriceLine(promo.lowest30dCents, locale)}</span>
          <CountdownCells promo={promo} />
          <Link href={BF_DEALER_HREF} className={s.cta} onClick={onClose}>
            {c.orderPriceAfter(price)}
          </Link>
          <button type="button" className={s.no} onClick={onClose}>
            {c.noThanks}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 2. Elegantais logs: vienreiz sesijā pēc 2 s; ×, «Nē, paldies», Esc, klikšķis ārpusē. */
export function BlackFridayPopupB({ delayMs = 2000 }: { delayMs?: number }) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const promo = useBlackFridayPlanPrice("dealer");
  const allowed = Boolean(promo) && overlayAllowed(pathname);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!allowed || readPopupSeen()) return;
    const id = window.setTimeout(() => {
      if (readPopupSeen()) return;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    }, delayMs);
    return () => window.clearTimeout(id);
  }, [allowed, delayMs]);

  const close = useCallback(() => {
    markPopupSeen();
    setOpen(false);
    returnFocus.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    markPopupSeen();
    dialogRef.current?.querySelector<HTMLElement>("[data-bf-close]")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  if (!open || !promo || !allowed) return null;
  return createPortal(<BlackFridayDialogB promo={promo} locale={locale} onClose={close} dialogRef={dialogRef} />, document.body);
}

/** 4. Hero izvēlnes dīlera rindas cena B stilā: «-30 %» čips + pārsvītrotā, zem tām jaunā cena. */
export function BlackFridayHeroPriceB({ regularLabel }: { regularLabel: string }) {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return <>{regularLabel}</>;
  return (
    <span className={`${s.root} ${s.em}`} data-promo={promo.promoId}>
      <span className={s.emRow}>
        <span className={s.emChip}>{promo.discountLabel}</span>
        <s>{formatPromoEur(promo.regularCents, locale)}</s>
      </span>
      <span className={s.emNew}>{formatPromoEur(promo.promoCents, locale)}</span>
    </span>
  );
}

/** Hero dīlera rindas Omnibus rinda (zem apraksta). */
export function BlackFridayHeroOmnibusB() {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  return (
    <i className={`${s.root} ${s.omniSmall}`} data-omnibus>
      {omnibusLowestPriceLine(promo.lowest30dCents, locale)}
    </i>
  );
}

/** #dilera-dati virsraksta rinda: «Datu atskaite · ~~24,99 €~~ 17,49 € [-30 %]». */
export function BlackFridayDealerKickerB({ label, regularLabel }: { label: string; regularLabel: string }) {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) {
    return (
      <>
        {label} · {regularLabel}
      </>
    );
  }
  return (
    <>
      {label} · <s className={s.kickOld}>{formatPromoEur(promo.regularCents, locale)}</s>{" "}
      <span className={s.kickNew}>{formatPromoEur(promo.promoCents, locale)}</span>{" "}
      <span className={s.root} style={{ display: "inline" }}>
        <span className={`${s.chip} ${s.kickChip}`}>{promo.discountLabel}</span>
      </span>
    </>
  );
}

/** 4. #dilera-dati cenu bloks B. */
export function BlackFridayDealerBoxB() {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div className={`${s.root} ${s.dbox}`} data-promo-box>
      <span className={`${s.dboxBig} ${s.shine}`}>{promo.discountLabel}</span>
      <span>
        <span className={s.dboxK}>
          <span className={s.dot} aria-hidden />
          <span className={s.eb}>{c.eyebrow}</span>
        </span>
        <span className={s.dboxPr}>
          <b>{formatPromoEur(promo.promoCents, locale)}</b>
          <s>{formatPromoEur(promo.regularCents, locale)}</s>
        </span>
        <span className={s.omni} data-omnibus>
          {omnibusLowestPriceLine(promo.lowest30dCents, locale)}
        </span>
        <span className={s.omni}>{c.until}</span>
      </span>
    </div>
  );
}

/** Kapsula + logs (publiskajā layout, ārpus galvenā satura). */
export function BlackFridayOverlaysB() {
  return (
    <>
      <BlackFridayCapsuleB />
      <BlackFridayPopupB />
    </>
  );
}
