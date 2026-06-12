"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2, Plus } from "lucide-react";

/**
 * Izveido tukšu manuālo pasūtījumu (pasūtījumiem, kas neienāk caur tiešsaistes formu).
 * Summa un Laiks pēc tam labojami tieši sarakstā.
 */
export function AdminCreateManualOrderButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/manual-orders", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Neizdevās izveidot pasūtījumu");
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tīkla kļūda");
    } finally {
      setCreating(false);
    }
  }, [router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void onCreate()}
        disabled={creating}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-[var(--color-provin-accent-soft)]/40 disabled:cursor-not-allowed disabled:opacity-60"
        title="Izveidot tukšu pasūtījumu manuāli (piem., individuālam piedāvājumam)"
      >
        {creating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        )}
        Jauns manuālais pasūtījums
      </button>
      {error ? <p className="max-w-[260px] text-right text-[10px] leading-snug text-red-600">{error}</p> : null}
    </div>
  );
}
