/**
 * Black Friday CTA bez lapas pārlādes: sākumlapā izvēlas dīlera datus, uzritina uz pasūtījuma
 * formu un ieliek fokusu VIN laukā. Citās lapās saite ved uz `/?plan=dealer#home-hero`.
 */
import { HERO_SECTION_ID } from "@/lib/hero-prefill";

export const BF_SELECT_DEALER_EVENT = "provin:bf-select-dealer";
/** Hero pasūtījuma kartītes atzīme (kapsula slēpjas, kamēr tā redzama). */
export const BF_HERO_CARD_ATTR = "data-hero-order-card";

/** `true`, ja sākumlapas hero ir šajā lapā un notikums nosūtīts. */
export function requestBlackFridayDealer(): boolean {
  if (typeof window === "undefined") return false;
  if (!document.getElementById(HERO_SECTION_ID)) return false;
  window.dispatchEvent(new CustomEvent(BF_SELECT_DEALER_EVENT));
  return true;
}

/** Uzritina uz hero kartīti un pēc mirkļa ieliek fokusu VIN laukā. */
export function focusHeroVinField(): void {
  if (typeof window === "undefined") return;
  const card = document.querySelector<HTMLElement>(`[${BF_HERO_CARD_ATTR}]`);
  if (!card) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  window.setTimeout(() => card.querySelector<HTMLInputElement>('input[name="vin"]')?.focus({ preventScroll: true }), reduce ? 0 : 450);
}

/** Vai klients jau raksta hero formā (tad logu nerāda). */
export function isHeroFormInUse(): boolean {
  if (typeof document === "undefined") return false;
  const hero = document.getElementById(HERO_SECTION_ID);
  if (!hero) return false;
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && hero.contains(active)) return true;
  return Array.from(hero.querySelectorAll<HTMLInputElement>("input")).some((i) => i.value.trim() !== "");
}

/** Logs ne biežāk kā reizi 7 dienās. */
export const BF_POPUP_STORAGE_KEY = "bf26-pop-b4";
export const BF_POPUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function popupDueAt(lastShownMs: number | null, nowMs: number): boolean {
  if (lastShownMs == null || !Number.isFinite(lastShownMs) || lastShownMs <= 0) return true;
  return nowMs - lastShownMs >= BF_POPUP_INTERVAL_MS;
}
