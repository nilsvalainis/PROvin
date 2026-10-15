"use client";

import { useEffect } from "react";
import { IRISS_PWA_SCOPE, IRISS_PWA_SW_PATH } from "@/lib/iriss-pwa";

export function IrissPwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register(IRISS_PWA_SW_PATH, { scope: IRISS_PWA_SCOPE, type: "module" }).catch(() => undefined);
  }, []);
  return null;
}
