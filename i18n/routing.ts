import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["lv"],
  defaultLocale: "lv",
  localeDetection: false,
  localePrefix: "as-needed",
});
