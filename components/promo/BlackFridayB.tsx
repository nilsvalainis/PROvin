"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useBlackFridayPlanPrice } from "@/components/promo/BlackFridayPromo";
import {
  blackFridayCountdownLine,
  blackFridayCountdownParts,
  getBlackFridayCopy,
} from "@/lib/promo/black-friday-copy";
import {
  blackFridaySavingsLine,
  formatPromoEur,
  omnibusLowestPriceLine,
  type BlackFridayPlanPrice,
} from "@/lib/promo/black-friday";
import {
  BF_HERO_CARD_ATTR,
  BF_POPUP_STORAGE_KEY,
  isHeroFormInUse,
  popupDueAt,
  requestBlackFridayDealer,
} from "@/lib/promo/black-friday-hero";
import s from "./black-friday-b.module.css";

/** Dīlera datu pasūtījums sākumlapas hero (next-intl pieliek valodas prefiksu). */
export const BF_DEALER_HREF = "/?plan=dealer#home-hero";
/** Lapas, kur logu un kapsulu nerāda (B2B partneru lapa, pasūtījuma/maksājuma plūsma, juridiskie teksti). */
const NO_OVERLAY_PREFIXES = ["/partneriem", "/paldies", "/pasutit", "/apmaksa", "/lietosanas-noteikumi", "/privatuma-politika", "/dev"];

/** Logs: pēc 8 s vai 40 % ritinājuma. */
const POPUP_DELAY_MS = 8000;
const POPUP_SCROLL_RATIO = 0.4;

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

/** Saite uz dīlera datu pasūtījumu: sākumlapā bez pārlādes (izvēle + VIN lauks), citur - parasta saite. */
export function BfDealerLink({
  className,
  children,
  onNavigate,
}: {
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    onNavigate?.();
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (requestBlackFridayDealer()) e.preventDefault();
  };
  return (
    <Link href={BF_DEALER_HREF} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

/** «-30 %» -> «-30» + augšā mazs «%». */
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
    <span className={s.cdl} role="timer" aria-label={c.timerAria}>
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

function SaveCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

/** 1. Augšējā josla B4. */
export function BlackFridayTopBarB() {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div className={`${s.root} ${s.top}`} role="region" aria-label={c.regionAria} data-promo-banner={promo.promoId}>
      <div className={s.topIn}>
        <span className={`${s.g} ${s.gLead}`}>
          <span className={s.eb}>{c.eyebrow}</span>
          <span className={`${s.pct} ${s.shine}`}>{promo.discountLabel}</span>
          <span className={s.sep} aria-hidden />
          <span className={s.topName}>{c.dealerLong}</span>
        </span>
        <span className={`${s.g} ${s.gPrice}`}>
          <span className={s.topPrice}>
            <span className={s.topNameM}>{c.dealerShort}</span>
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
          <BfDealerLink className={s.cta}>{c.order}</BfDealerLink>
        </span>
      </div>
    </div>
  );
}

function overlayAllowed(pathname: string): boolean {
  const p = pathname || "/";
  return !NO_OVERLAY_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

/** Kapsula slēpjas, kamēr hero pasūtījuma kartīte redzama. */
function useHeroCardVisible(active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active || typeof IntersectionObserver === "undefined") return;
    const card = document.querySelector(`[${BF_HERO_CARD_ATTR}]`);
    if (!card) return;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => setVisible(en.isIntersecting)), { threshold: 0.25 });
    io.observe(card);
    return () => io.disconnect();
  }, [active]);
  return visible;
}

/** 3. Telefona apakšējā stikla kapsula (tikai ≤720px, CSS). */
export function BlackFridayCapsuleB() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const promo = useBlackFridayPlanPrice("dealer");
  const allowed = Boolean(promo) && overlayAllowed(pathname);
  const heroVisible = useHeroCardVisible(allowed);
  if (!promo || !allowed) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div
      className={`${s.root} ${s.cap}${heroVisible ? ` ${s.capOff}` : ""}`}
      role="region"
      aria-label={c.regionAria}
      aria-hidden={heroVisible || undefined}
      data-promo-capsule
    >
      <span className={s.capL}>
        <span className={s.capT}>
          <span className={s.chip}>{promo.discountLabel}</span>
          {c.dealerShort}
          <b className={s.capPrice}>{formatPromoEur(promo.promoCents, locale)}</b>
          <s>{formatPromoEur(promo.regularCents, locale)}</s>
        </span>
        <span className={s.capTm}>
          <CountdownLine promo={promo} />
        </span>
        <span className={s.omni}>{omnibusLowestPriceLine(promo.lowest30dCents, locale)}</span>
      </span>
      <BfDealerLink className={s.cta}>{c.order}</BfDealerLink>
    </div>
  );
}

function readLastShown(): number | null {
  try {
    const v = Number(window.localStorage.getItem(BF_POPUP_STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function markShown(): void {
  try {
    window.localStorage.setItem(BF_POPUP_STORAGE_KEY, String(Date.now()));
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
      <div ref={dialogRef} className={s.box} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
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
          <span className={s.facts}>
            <span className={s.star} aria-hidden>
              ★
            </span>
            {c.factRating}
            <span className={s.factDot} aria-hidden />
            {c.factTurnaround}
            <span className={`${s.factDot} ${s.factBreak}`} aria-hidden />
            {c.factInput}
          </span>
          <span className={s.omni} data-omnibus>
            {omnibusLowestPriceLine(promo.lowest30dCents, locale)}
          </span>
          <CountdownCells promo={promo} />
          <BfDealerLink className={s.cta} onNavigate={onClose}>
            {c.orderDealerDash(price)}
          </BfDealerLink>
          <button type="button" className={s.no} onClick={onClose}>
            {c.noThanks}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Logs (B4): arī telefonā; ne biežāk kā reizi 7 dienās; pēc 8 s vai 40 % ritinājuma;
 * nerāda, kamēr klients raksta hero formā. ×, «Nē, paldies», Esc, klikšķis ārpusē.
 */
export function BlackFridayPopupB({ delayMs = POPUP_DELAY_MS }: { delayMs?: number }) {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const promo = useBlackFridayPlanPrice("dealer");
  const allowed = Boolean(promo) && overlayAllowed(pathname);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!allowed || !popupDueAt(readLastShown(), Date.now())) return;
    let fired = false;
    const fire = () => {
      if (fired || !popupDueAt(readLastShown(), Date.now()) || isHeroFormInUse()) return;
      fired = true;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      markShown();
      setOpen(true);
    };
    const timer = window.setTimeout(fire, delayMs);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY > max * POPUP_SCROLL_RATIO) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [allowed, delayMs]);

  const close = useCallback(() => {
    markShown();
    setOpen(false);
    returnFocus.current?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
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

/** 4. Hero dīlera rindas cena: «-30 %» čips + pārsvītrotā, lielā jaunā cena, «Ietaupi 7,50 €». */
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
      <span className={s.emSave}>{blackFridaySavingsLine(promo, locale)}</span>
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

/** Hero dīlera rindas «BLACK FRIDAY» lente (redzama, kad rinda izvēlēta). */
export function BlackFridayHeroRibbonB() {
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  return (
    <span className={s.rib} aria-hidden>
      Black Friday
    </span>
  );
}

/** Klases hero dīlera rindai akcijas laikā (izcelšana, spilgtāka zaļā). */
export const bfHeroClasses = {
  dealer: s.heroDealer,
  radio: s.heroRadio,
  green: s.greenBright,
  dsGuarantee: s.dsGuarantee,
};

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

/** 4. #dilera-dati cenu bloks B4 (simetrisks: -30% | līnija | cena). */
export function BlackFridayDealerBoxB() {
  const locale = useLocale();
  const promo = useBlackFridayPlanPrice("dealer");
  if (!promo) return null;
  const c = getBlackFridayCopy(locale);
  return (
    <div className={`${s.root} ${s.dbox}`} data-promo-box>
      <Pct label={promo.discountLabel} className={`${s.dboxBig} ${s.shine}`} />
      <span className={s.vr} aria-hidden />
      <span>
        <span className={s.dboxK}>
          <span className={s.dot} aria-hidden />
          <span className={s.eb}>{c.eyebrow}</span>
        </span>
        <span className={s.dboxPr}>
          <b>{formatPromoEur(promo.promoCents, locale)}</b>
          <s>{formatPromoEur(promo.regularCents, locale)}</s>
        </span>
        <span className={s.save}>
          <SaveCheck />
          {blackFridaySavingsLine(promo, locale)}
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
