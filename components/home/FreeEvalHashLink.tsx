"use client";

import type { ReactNode } from "react";
import { useLenis } from "lenis/react";
import { Link } from "@/i18n/navigation";
import { FREE_EVAL_SECTION_ID, freeEvalHref } from "@/lib/paths";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Iekšlapas saite uz bezmaksas VIN / sludinājuma novērtējumu.
 * Ja mērķis ir šajā dokumentā, ritina ar `scroll-margin-top` (headeris nenosedz).
 * Citā lapā: `/#bezmaksas-novertejums`.
 */
export function FreeEvalHashLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const lenis = useLenis();

  return (
    <Link
      href={freeEvalHref()}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(FREE_EVAL_SECTION_ID);
        if (!el) return;
        e.preventDefault();
        const reduce = prefersReducedMotion();
        const headerOffset = parseFloat(window.getComputedStyle(el).scrollMarginTop) || 76;
        if (lenis) {
          lenis.scrollTo(el, {
            offset: -headerOffset,
            duration: reduce ? 0 : 0.7,
            immediate: reduce,
          });
        } else {
          el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
        const nextHash = `#${FREE_EVAL_SECTION_ID}`;
        if (window.location.hash !== nextHash) {
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
        }
      }}
    >
      {children}
    </Link>
  );
}
