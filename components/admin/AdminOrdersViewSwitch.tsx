"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminOrdersViewSwitch({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname() || "/admin/dashboard";
  const sp = useSearchParams();
  const unpaid = sp.get("view") === "unpaid";
  const [count, setCount] = useState<number | null>(pendingCount ?? null);

  useEffect(() => {
    if (typeof pendingCount === "number") {
      setCount(pendingCount);
      return;
    }
    let cancelled = false;
    void fetch("/api/admin/unpaid-orders", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { orders?: unknown[] }) => {
        if (!cancelled && Array.isArray(data.orders)) setCount(data.orders.length);
      })
      .catch(() => {
        /* kešs / Stripe - slēdzis paliek bez skaita */
      });
    return () => {
      cancelled = true;
    };
  }, [pendingCount, unpaid]);

  const paidHref = (() => {
    const p = new URLSearchParams(sp.toString());
    p.delete("view");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();
  const unpaidHref = (() => {
    const p = new URLSearchParams();
    p.set("view", "unpaid");
    return `${pathname}?${p.toString()}`;
  })();

  const pill = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] transition sm:h-7 sm:px-3 sm:text-[12.5px] ${
      on ? "bg-white font-semibold text-[var(--color-apple-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"
    }`;

  return (
    <div
      role="tablist"
      aria-label="Pasūtījumu skats"
      className="flex min-w-0 overflow-x-auto rounded-[9px] bg-[#e9e9ee] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link href={paidHref} scroll={false} prefetch={false} role="tab" aria-selected={!unpaid} className={pill(!unpaid)}>
        Visi
      </Link>
      <Link href={unpaidHref} scroll={false} prefetch={false} role="tab" aria-selected={unpaid} className={pill(unpaid)}>
        Neapmaksāti
        {count != null && count > 0 ? (
          <span className="tabular-nums text-[#8e8e93]">{count}</span>
        ) : null}
      </Link>
    </div>
  );
}
