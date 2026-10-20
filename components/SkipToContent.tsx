"use client";

import { useLenis } from "lenis/react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";

export function SkipToContent() {
  const t = useTranslations("Header");
  const lenis = useLenis();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById("main-content");
    if (!main) return;
    event.preventDefault();
    main.focus({ preventScroll: true });
    if (lenis) {
      lenis.scrollTo(main, { immediate: true });
      return;
    }
    main.scrollIntoView({ behavior: "auto", block: "start" });
  };

  return (
    <a href="#main-content" className="provin-skip-to-content" onClick={onClick}>
      {t("skipToContent")}
    </a>
  );
}
