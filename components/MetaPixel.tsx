"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { buildMetaPixelInitSnippet, trackMetaRoute } from "@/lib/meta-pixel";

/**
 * fbevents.js only after analytics consent (parent already gated).
 * PageView on every App Router path change; ViewContent on pricing / dealer-data.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname() ?? "/";
  const snippet = buildMetaPixelInitSnippet(pixelId);

  useEffect(() => {
    if (!snippet) return undefined;
    const fire = () => trackMetaRoute(pathname);
    if (fire()) return undefined;
    const interval = window.setInterval(() => {
      if (fire()) window.clearInterval(interval);
    }, 300);
    const stop = window.setTimeout(() => window.clearInterval(interval), 8_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [pathname, snippet]);

  if (!snippet) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {snippet}
    </Script>
  );
}
