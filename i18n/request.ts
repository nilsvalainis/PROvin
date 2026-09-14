import { getRequestConfig } from "next-intl/server";
import { loadAppMessages, resolveAppLocale } from "@/lib/i18n/load-app-messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveAppLocale(await requestLocale);
  return {
    locale,
    messages: await loadAppMessages(locale),
  };
});
