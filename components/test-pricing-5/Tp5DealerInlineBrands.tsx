"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  TP5_DEALER_BRAND_DARK_PLATE,
  TP5_DEALER_BRAND_LOGO_SRC,
  TP5_DEALER_BRAND_ROWS,
} from "@/lib/test-pricing-5-mobile";

export function Tp5DealerInlineBrands({ brandsAria }: { brandsAria: string }) {
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchMovedRef = useRef(false);

  useEffect(() => {
    if (!openBrand) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpenBrand(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenBrand(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openBrand]);

  return (
    <div ref={rootRef} className={styles.dealerInlineBrands} aria-label={brandsAria}>
      {TP5_DEALER_BRAND_ROWS.flat().map((brand) => {
        const src = TP5_DEALER_BRAND_LOGO_SRC[brand];
        const darkPlate = TP5_DEALER_BRAND_DARK_PLATE.has(brand);
        const open = openBrand === brand;
        return (
          <div
            key={brand}
            role="button"
            tabIndex={0}
            className={`${styles.dealerInlineBrandCell}${open ? ` ${styles.dealerInlineBrandCellOpen}` : ""}`}
            aria-label={brand}
            aria-expanded={open}
            onMouseEnter={() => setOpenBrand(brand)}
            onMouseLeave={() => setOpenBrand((prev) => (prev === brand ? null : prev))}
            onFocus={() => setOpenBrand(brand)}
            onBlur={() => setOpenBrand((prev) => (prev === brand ? null : prev))}
            onTouchStart={() => {
              touchMovedRef.current = false;
            }}
            onTouchMove={() => {
              touchMovedRef.current = true;
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              setOpenBrand((prev) => (prev === brand ? null : brand));
            }}
            onClick={() => {
              if (touchMovedRef.current) return;
              if (
                typeof window !== "undefined" &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches
              ) {
                return;
              }
              setOpenBrand((prev) => (prev === brand ? null : brand));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className={`${styles.dealerInlineBrandLogo}${darkPlate ? ` ${styles.dealerInlineBrandLogoDarkPlate}` : ""}`}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <span className={styles.dealerInlineBrandTip} role="tooltip">
              {brand}
            </span>
          </div>
        );
      })}
    </div>
  );
}
