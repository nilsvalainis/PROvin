import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["lv", "en", "ru", "az"],
  defaultLocale: "lv",
  localePrefix: "as-needed",
});
