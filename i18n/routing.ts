import { defineRouting } from "next-intl/routing";
import { APP_LOCALES, DEFAULT_LOCALE } from "./locales";

export const routing = defineRouting({
  locales: APP_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localeDetection: false,
  /**
   * Viens `lv`: `as-needed` un `never` dev vidē deva 307 cilpu uz `/` (next-intl + viena lokalizācija).
   * `always` — `/` → `/lv` vienu reizi, tad lapa ielādējas (URL ar `/lv` prefiksu).
   * `de` un `ru` ir B2B lokalizācijas; publiskās lapas no tām middleware sūta uz `/en`.
   */
  localePrefix: "always",
});
