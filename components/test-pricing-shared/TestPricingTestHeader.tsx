"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const NAV = [
  { href: "#kas-ir-iriss", label: "KAS IR PROVIN?" },
  { href: "#biezi-jautajumi", label: "BUJ" },
  { href: "#kontakti", label: "KONTAKTI" },
] as const;

export function TestPricingTestHeader() {
  const tHeader = useTranslations("Header");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const headerSurface = "border-b border-white/[0.05] bg-transparent pt-[env(safe-area-inset-top,0px)]";
  const logoClass =
    "flex min-h-11 shrink-0 items-center text-[28.98px] font-bold tracking-tight text-white transition-colors hover:text-white/90";
  const navInactive = "text-white/[0.88] hover:text-white";
  const mobilePanelBg = "border-white/[0.08] bg-[#07080a]/96 backdrop-blur-md";

  return (
    <header className={`sticky top-0 z-[42] isolate w-full ${headerSurface}`}>
      <div className="mx-auto flex min-h-10 w-full min-w-0 max-w-none items-center gap-2 py-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:min-h-11 md:py-0 md:gap-3">
        <Link href="/" className={logoClass} aria-label="PROVIN">
          <span className="text-white">PRO</span>
          <span className="text-provin-accent">VIN</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <nav
            className="mr-1 hidden min-w-0 flex-wrap items-center justify-end gap-x-4 lg:flex xl:gap-x-6"
            aria-label="Lapas navigācija"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] no-underline transition-colors ${navInactive}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="test-pricing-2-mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden relative z-[52] inline-flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-white outline-none shadow-none transition hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[#0066ff]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
            aria-label={mobileOpen ? tHeader("menuClose") : tHeader("menuOpen")}
          >
            {mobileOpen ? (
              <X className="h-[22px] w-[22px]" strokeWidth={1.75} />
            ) : (
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="test-pricing-2-mobile-nav" className={`relative z-[44] lg:hidden ${mobilePanelBg} border-t`}>
          <nav aria-label="Lapas navigācija" className="flex flex-col gap-px py-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="min-h-11 shrink-0 content-center px-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/[0.88] no-underline outline-none transition hover:text-white focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#0066ff]/35"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
