"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type Props = {
  slug: string;
};

/**
 * Reģistrē bloga ieraksta lasījumu vienreiz sesijā (fire-and-forget).
 * Izvairās no refresh/bot double-count RSC renderos.
 */
export function BlogViewTracker({ slug }: Props) {
  useEffect(() => {
    const key = `provin-blog-view:${slug}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — joprojām mēģinām reģistrēt */
    }

    try {
      track("blog_view", { slug });
    } catch {
      /* ignore */
    }

    const body = JSON.stringify({ slug });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/blog-views", blob)) return;
      }
    } catch {
      /* fall through */
    }

    void fetch("/api/blog-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [slug]);

  return null;
}
