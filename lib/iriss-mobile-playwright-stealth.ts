import "server-only";

export { getChromiumWithStealth } from "@/lib/iriss-playwright-extra-stealth";

/** Vienots reālistisks desktop Chrome UA — jāsaskan ar `scripts/auth-mobile.mjs`. */
export const MOBILE_DE_PLAYWRIGHT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS = ["--disable-blink-features=AutomationControlled"] as const;
