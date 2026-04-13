"use client";

import { usePathname } from "@/i18n/navigation";
import { normalizeSitePath } from "@/lib/site-rail-sections";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";
import { SiteThemeHeaderButton } from "@/components/site-theme/SiteThemeHeaderButton";

/**
 * Demo lapās nav globālā headera — fiksēta tēmas poga, lai gaišo/tumšo var pārslēgt arī tur.
 */
export function DemoPathThemeToggle() {
  const pathname = usePathname() ?? "";
  const p = normalizeSitePath(pathname);
  const { theme } = useSiteTheme();

  if (p !== "/demo" && !p.startsWith("/demo/")) return null;

  const shell =
    theme === "dark"
      ? "border-white/15 bg-[#0a0a0c]/92 text-white shadow-[0_8px_28px_rgba(0,0,0,0.42)] backdrop-blur-md focus-visible:ring-[#0066ff]/45 focus-visible:ring-offset-[#050505]"
      : "border-black/[0.08] bg-white/95 text-[#1d1d1f] shadow-[0_6px_22px_rgba(0,0,0,0.12)] backdrop-blur-md focus-visible:ring-[rgb(255_90_0/0.35)] focus-visible:ring-offset-white";

  return (
    <div className="pointer-events-auto fixed bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-[max(1rem,env(safe-area-inset-left,0px))] z-[45] md:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
      <SiteThemeHeaderButton className={`h-11 w-11 ${shell}`} />
    </div>
  );
}
