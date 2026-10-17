"use client";

import Link from "next/link";
import type { VinHistoryEntry } from "@/lib/vin-history";

function fmt(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Riga" });
}

export function vinHistoryEntryHref(e: VinHistoryEntry): string {
  return e.kind === "quick" ? `/admin/atras-vertesanas/${encodeURIComponent(e.id.replace(/^qe:/, ""))}` : `/admin/orders/${encodeURIComponent(e.id)}`;
}

/** Nopirktie avoti, kas jau ir citos darbos (jaunākais darbs katram avotam) — tos nav jāpērk vēlreiz. */
export function vinHistoryReusable(entries: VinHistoryEntry[]): { label: string; at: string | null }[] {
  const seen = new Map<string, string | null>();
  for (const e of entries) for (const l of e.labels) if (!seen.has(l)) seen.set(l, e.savedAt ?? e.createdAt);
  return [...seen.entries()].map(([label, at]) => ({ label, at }));
}

/**
 * „Atkārtots VIN” (obligāts paziņojums, H2 mierīgais stils): kas par šo VIN jau ir (pasūtījumi, ātrie
 * vērtējumi, nopirktās atskaites), ar datumiem un saitēm; ko var izmantot atkārtoti un nav jāpērk.
 * Klienta personas dati netiek kopēti.
 */
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
  const reusable = vinHistoryReusable(entries);
  return (
    <div className="rounded-xl border border-[#e5e5ea] bg-white px-3.5 py-2.5 text-[12.5px] text-[#3a3a3c]">
      <p className="text-[13px] font-semibold text-[#1d1d1f]">
        ↻ Atkārtots VIN <span className="font-normal text-[#8e8e93]">· jau {entries.length} citā(-os) darbā(-os)</span>
      </p>
      {reusable.length > 0 ? (
        <p className="mt-1 text-[12.5px]">
          <span className="font-semibold text-[#1d1d1f]">Nav jāpērk atkārtoti:</span>{" "}
          {reusable.map((r, i) => (
            <span key={r.label}>
              {i > 0 ? ", " : ""}
              {r.label} <span className="text-[#8e8e93]">({fmt(r.at)})</span>
            </span>
          ))}
          <span className="text-[#8e8e93]"> - izmanto „Pārnest datus” zemāk.</span>
        </p>
      ) : (
        <p className="mt-1 text-[#8e8e93]">Nopirktu atskaišu nav - iepriekš izmantoti tikai bezmaksas avoti.</p>
      )}
      <ul className="mt-2 divide-y divide-[#f0f0f2] border-t border-[#f0f0f2]">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
            <Link href={vinHistoryEntryHref(e)} className="admin-nav-link font-medium text-[#1d1d1f] underline decoration-[#d1d1d6] underline-offset-2 hover:decoration-[#8e8e93]">
              {e.kind === "order" ? "Pasūtījums" : "Ātrais vērtējums"} {fmt(e.createdAt)}
            </Link>
            <span className="text-[#8e8e93]">· {e.who}</span>
            {e.status ? <span className="text-[#8e8e93]">· {e.status}</span> : null}
            <span className="w-full text-[11.5px] text-[#6e6e73] sm:w-auto">
              {e.labels.length > 0
                ? `Nopirkts: ${e.labels.join(", ")} · saglabāts ${fmt(e.savedAt)}`
                : e.dataKeys.length > 0
                  ? "Tikai bezmaksas avoti"
                  : "Datu nav"}
            </span>
            {e.purchasedKeys.length > 0 ? (
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => onReuse(e.id)}
                className="ml-auto rounded-lg border border-[#d1d1d6] bg-white px-2 py-0.5 text-[11.5px] font-medium text-[#1d1d1f] hover:bg-[#f2f2f7] disabled:opacity-50"
                title="Pārnes tikai transportlīdzekļa datus (bez klienta datiem); bezmaksas avotus ielasa no jauna"
              >
                {busyId === e.id ? "Pārnes…" : "Pārnest datus"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
