import { getRequestConfig } from "next-intl/server";
import { isAppLocale } from "./locales";
import { routing } from "./routing";
import { loadAppMessages } from "@/lib/i18n/load-app-messages";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!isAppLocale(locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: await loadAppMessages(locale),
  };
});
