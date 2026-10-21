"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AdminMobileSearchField, AdminMobileSegments } from "@/components/admin/mobile/AdminMobileChrome";

type TabId = "pending" | "completed" | "rejected" | "all";

export function AdminListingPeekMobileFilters({
  tab,
  q,
  counts,
}: {
  tab: TabId;
  q: string;
  counts: Record<TabId, number>;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/atras-vertesanas";
  const [query, setQuery] = useState(q);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  const push = (next: { tab?: TabId; q?: string }) => {
    const p = new URLSearchParams();
    const nt = next.tab ?? tab;
    if (nt !== "pending") p.set("tab", nt);
    const nq = (next.q ?? query).trim();
    if (nq) p.set("q", nq);
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => push({ q: query }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className={`px-4 md:hidden ${pending ? "opacity-60" : ""}`}>
      <AdminMobileSegments
        value={tab}
        onChange={(id) => push({ tab: id as TabId })}
        items={[
          { id: "pending", label: `Gaida ${counts.pending}` },
          { id: "completed", label: `Pabeigti ${counts.completed}` },
          { id: "rejected", label: `Noraidīti ${counts.rejected}` },
          { id: "all", label: "Visi" },
        ]}
      />
      <div className="mt-2">
        <AdminMobileSearchField
          value={query}
          onChange={setQuery}
          placeholder="VIN, e-pasts, tālrunis, saite"
          onSubmit={() => push({ q: query })}
        />
      </div>
    </div>
  );
}
