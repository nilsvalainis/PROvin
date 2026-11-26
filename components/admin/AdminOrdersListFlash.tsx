"use client";

import { useEffect, useState } from "react";
import { takeOrdersListFlash } from "@/lib/admin-orders-list-flash";

/** Pasūtījumu sarakstā: īss apstiprinājums (piem. «Nosūtīts klientam · VIN …8215»), pazūd pats. */
export function AdminOrdersListFlash() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const t = takeOrdersListFlash();
    if (!t) return;
    setText(t);
    const id = window.setTimeout(() => setText(null), 5000);
    return () => window.clearTimeout(id);
  }, []);
  if (!text) return null;
  return (
    <div
      role="status"
      data-orders-list-flash
      className="fixed left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-semibold text-white shadow-lg"
      onClick={() => setText(null)}
    >
      {text}
    </div>
  );
}
