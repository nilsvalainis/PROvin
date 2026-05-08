import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["lv", "en"],
  defaultLocale: "lv",
  localeDetection: false,
  /**
   * Viens `lv`: `as-needed` un `never` dev vidē deva 307 cilpu uz `/` (next-intl + viena lokalizācija).
   * `always` — `/` → `/lv` vienu reizi, tad lapa ielādējas (URL ar `/lv` prefiksu).
   */
  localePrefix: "always",
});
