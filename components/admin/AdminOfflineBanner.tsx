"use client";

import { useEffect, useState } from "react";

/** Neliela josla augšā, kad nav interneta. Pazūd, kad savienojums atgriežas. */
export function AdminOfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 6px)" }}
    >
      <span className="rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-lg">
        Nav interneta. Izmaiņas var nesaglabāties.
      </span>
    </div>
  );
}
