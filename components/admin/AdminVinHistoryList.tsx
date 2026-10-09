"use client";

import type { VinHistoryEntry } from "@/lib/vin-history";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** „Šis VIN jau pārbaudīts”: kad, kam un kādi dati ir; viens klikšķis pārnes nopirktos datus. */
export function AdminVinHistoryList({
  entries,
  busyId,
  onReuse,
}: {
  entries: VinHistoryEntry[];
  busyId: string | null;
  onReuse: (fromId: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-950">
      <p className="font-semibold">Šis VIN jau pārbaudīts ({entries.length})</p>
      <ul className="mt-1.5 space-y-1.5">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{e.kind === "order" ? "Pasūtījums" : "Ātrais vērtējums"}</span>
            <span>{fmt(e.createdAt)}</span>
            <span className="text-amber-800/80">· {e.who}</span>
            {e.status ? <span className="text-amber-800/80">· {e.status}</span> : null}
            <span className="w-full text-[11px] text-amber-900/80 sm:w-auto">
              {e.labels.length > 0
                ? `Nopirkts: ${e.labels.join(", ")} (saglabāts ${fmt(e.savedAt)})`
                : e.dataKeys.length > 0
                  ? "Tikai bezmaksas avoti"
                  : "Datu nav"}
            </span>
            {e.purchasedKeys.length > 0 ? (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => onReuse(e.id)}
                className="rounded-lg bg-amber-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                title="Pārnes tikai transportlīdzekļa datus (bez klienta datiem); bezmaksas avotus ielasa no jauna"
              >
                {busyId === e.id ? "Pārnes…" : "Izmantot šos datus"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
