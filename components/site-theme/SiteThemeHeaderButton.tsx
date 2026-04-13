"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";

type Props = {
  className?: string;
};

export function SiteThemeHeaderButton({ className }: Props) {
  const { theme, toggleTheme } = useSiteTheme();
  const t = useTranslations("Header");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[
        "inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isDark ? t("themeSwitchToLight") : t("themeSwitchToDark")}
    >
      {isDark ? (
        <Sun className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
