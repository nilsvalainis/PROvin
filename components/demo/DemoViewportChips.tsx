"use client";

import { Link, usePathname } from "@/i18n/navigation";
import styles from "@/app/[locale]/demo/page.module.css";

const VARIANTS = [
  { href: "/demo", label: "Standarta" },
  { href: "/demo/mobile-narrow", label: "Šaurais mobilais" },
  { href: "/demo/mobile-wide", label: "Platais mobilais" },
  { href: "/demo/twin-hero", label: "Divas kartītes (atsevišķi)" },
] as const;

function pathActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (href === "/demo") return p === "/demo";
  if (href === "/demo/twin-hero") return p === "/demo/twin-hero";
  return p === href;
}

export function DemoViewportChips() {
  const pathname = usePathname();

  return (
    <nav className={styles.demoViewportChips} aria-label="Demo mobilie skati">
      <div className={styles.demoViewportChipsInner}>
        {VARIANTS.map(({ href, label }) => {
          const active = pathActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? styles.demoViewportChipActive : styles.demoViewportChip}
              prefetch={false}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
