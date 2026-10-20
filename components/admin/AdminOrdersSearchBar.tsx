"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * PRO pasūtījumu meklēšana (VIN, marka/modelis, e-pasts, vārds) + kārtošana — servera pusē caur URL (?q=&sort=).
 * Galddatorā rīkjoslā; telefonā piestiprināta apakšā virs cilņu joslas (labās rokas īkšķim).
 */
export function AdminOrdersSearchBar() {
  const router = useRouter();
  const pathname = usePathname() || "/admin/dashboard";
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);
  const sort = sp.get("sort") === "oldest" ? "oldest" : "newest";

  const push = (next: { q?: string; sort?: string }) => {
    const p = new URLSearchParams(sp.toString());
    const nq = next.q ?? q;
    if (nq.trim()) p.set("q", nq.trim());
    else p.delete("q");
    const ns = next.sort ?? sort;
    if (ns === "oldest") p.set("sort", "oldest");
    else p.delete("sort");
    p.delete("limit");
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => push({ q }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const input = (
    <input
      type="search"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      spellCheck={false}
      value={q}
      onChange={(e) => setQ(e.target.value)}
      aria-label="Meklēt pasūtījumus"
      className="h-11 min-w-0 flex-1 rounded-lg border border-[#d2d2d7] bg-white px-3 text-[16px] text-[#1d1d1f] focus:border-[#1d1d1f] focus:outline-none md:h-7 md:w-56 md:flex-none md:text-[13px]"
    />
  );
  const sortSelect = (
    <select
      value={sort}
      onChange={(e) => push({ sort: e.target.value })}
      aria-label="Kārtot"
      className="h-11 rounded-lg border border-[#d2d2d7] bg-white px-2 text-[14px] text-[#1d1d1f] md:h-7 md:text-[12px]"
    >
      <option value="newest">Jaunākie</option>
      <option value="oldest">Vecākie</option>
    </select>
  );

  return (
    <>
      <div className={`hidden items-center gap-1.5 md:flex ${pending ? "opacity-60" : ""}`}>
        {input}
        {sortSelect}
      </div>
      {null}
    </>
  );
}
