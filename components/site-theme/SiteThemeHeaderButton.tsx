"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { applySiteThemeToDocument, writeSiteTheme } from "@/lib/site-theme";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";

type Props = {
  className?: string;
};

export function SiteThemeHeaderButton({ className }: Props) {
  const { theme, setTheme } = useSiteTheme();
  const t = useTranslations("Header");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const next = isDark ? "light" : "dark";
        // Tieša atribūta maiņa novērš situāciju, kad redzams tikai daļējs pārslēgums.
        applySiteThemeToDocument(next);
        writeSiteTheme(next);
        setTheme(next);
      }}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isDark ? t("themeSwitchToLight") : t("themeSwitchToDark")}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      ) : (
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      )}
    </button>
  );
}
