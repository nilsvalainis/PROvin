"use client";

import { AdminShell } from "@/components/admin/AdminShell";

const ROWS = Array.from({ length: 24 }, (_, i) => ({
  id: `row-${String(i + 1).padStart(2, "0")}`,
  title: `BMW 530d xDrive ${i + 1}`,
  meta: `Klients ${i + 1} · 18 000 €`,
}));

/** Playwright / vizuālais tests. Nav produkcijas izvēlnē. */
export default function AdminMobileShellTestPage() {
  return (
    <AdminShell workspace="iriss">
      <div className="bg-[#F8F8F9]">
        <h1 className="mb-2 text-[34px] font-bold leading-none tracking-tight text-[var(--color-apple-text)]">
          Pasūtījumi
        </h1>
        <label className="relative mb-2 block">
          <span className="sr-only">Meklēt</span>
          <input
            type="search"
            placeholder="Vārds, tālrunis, marka"
            className="h-9 w-full rounded-[10px] border-0 bg-[#e5e5ea] px-3 text-base outline-none"
          />
        </label>
        <ul className="overflow-hidden rounded-xl bg-white" data-testid="admin-mobile-order-list">
          {ROWS.map((row, i) => (
            <li
              key={row.id}
              data-testid={`order-row-${row.id}`}
              data-last-row={i === ROWS.length - 1 ? "1" : undefined}
              className="flex min-h-[88px] items-center border-b border-[#e5e5ea] px-3 last:border-b-0"
            >
              <div>
                <p className="text-[17px] font-semibold">{row.title}</p>
                <p className="text-[13px] text-[#8e8e93]">{row.meta}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
