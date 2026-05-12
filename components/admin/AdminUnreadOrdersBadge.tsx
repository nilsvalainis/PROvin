"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readOpenedSessionIds, seedOpenedSessionsIfFirstRun } from "@/lib/admin-opened-sessions";

const POLL_MS = 45_000;

export function AdminUnreadOrdersBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/admin/orders/unread-ids", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data: unknown = await res.json().catch(() => ({}));
      const ids =
        typeof data === "object" &&
        data !== null &&
        "ids" in data &&
        Array.isArray((data as { ids: unknown }).ids)
          ? (data as { ids: unknown[] }).ids.filter((x): x is string => typeof x === "string")
          : [];
      seedOpenedSessionsIfFirstRun(ids);
      const opened = readOpenedSessionIds();
      const unread = ids.filter((id) => !opened.has(id)).length;
      setCount(unread);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    const onCustom = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("provin-admin-opened-sessions-changed", onCustom);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("provin-admin-opened-sessions-changed", onCustom);
    };
  }, [pathname, refresh]);

  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/35 bg-red-600 text-white shadow-sm"
      title={`Jauni apmaksātie pasūtījumi: ${count}`}
      aria-label={`Jauni apmaksātie pasūtījumi: ${count}`}
      role="status"
    >
      <Bell className="h-[17px] w-[17px]" strokeWidth={2.25} aria-hidden />
      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-0.5 text-[10px] font-bold leading-none text-red-600 ring-2 ring-red-600">
        {label}
      </span>
    </span>
  );
}
