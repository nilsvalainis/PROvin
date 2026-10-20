"use client";

import { useEffect, useRef } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: "dark" | "light" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

function getTurnstileApi(): TurnstileApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  return api ?? null;
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  const existing = getTurnstileApi();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const prev = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const onReady = () => {
      const api = getTurnstileApi();
      if (api) resolve(api);
      else reject(new Error("turnstile_missing"));
    };
    if (prev) {
      prev.addEventListener("load", onReady, { once: true });
      prev.addEventListener("error", () => reject(new Error("turnstile_script")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile_script")), { once: true });
    document.head.appendChild(script);
  });
}

type Props = {
  onToken: (token: string | null) => void;
  resetKey: number;
  ariaLabel: string;
};

export function B2bTurnstile({ onToken, resetKey, ariaLabel }: Props) {
  const siteKey = getTurnstileSiteKey();
  const hostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !hostRef.current) return;
    let cancelled = false;
    onToken(null);
    void loadTurnstileScript()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        if (widgetIdRef.current) {
          try {
            api.reset(widgetIdRef.current);
          } catch {
            /* widget already gone */
          }
          return;
        }
        widgetIdRef.current = api.render(hostRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) onToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [siteKey, resetKey, onToken]);

  if (!siteKey) return null;

  return <div ref={hostRef} className="min-h-[65px]" aria-label={ariaLabel} />;
}

export function partnerLoginNeedsTurnstile(): boolean {
  return Boolean(getTurnstileSiteKey());
}
