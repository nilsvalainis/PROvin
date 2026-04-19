"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

/** Jauns pasūtījums — tikai POST (nav GET /new), lai izvairītos no prefetch / redirect problēmām. */
export function IrissPasutijumiNewFab() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/iriss-pasutijumi", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const data: unknown = await res.json().catch(() => ({}));
      const id =
        typeof data === "object" &&
        data !== null &&
        "id" in data &&
        typeof (data as { id: unknown }).id === "string"
          ? (data as { id: string }).id
          : null;
      const errorMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : null;

      if (!res.ok || !id) {
        if (errorMsg === "store_disabled") {
          setErr("Melnraksts izslēgts (ADMIN_IRISS_PASUTIJUMI_DIR).");
        } else {
          setErr(errorMsg ?? `Neizdevās izveidot (${res.status}).`);
        }
        return;
      }
      router.push(`/admin/iriss/pasutijumi/${encodeURIComponent(id)}`);
      router.refresh();
    } catch {
      setErr("Tīkla kļūda.");
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  return (
    <>
      {err ? (
        <div
          className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] left-3 right-3 z-50 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-center text-[12px] font-medium text-amber-950 shadow-lg sm:left-auto sm:right-5 sm:max-w-sm"
          role="alert"
        >
          {err}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setErr(null)}
          >
            Aizvērt
          </button>
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void create()}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-provin-accent)] text-white shadow-[0_8px_24px_rgba(239,125,26,0.45)] transition hover:opacity-95 active:scale-95 disabled:opacity-60 sm:bottom-6 sm:right-5"
        aria-label="Jauns pasūtījums"
        title="Jauns pasūtījums"
      >
        {busy ? (
          <span className="h-6 w-6 animate-pulse rounded-full bg-white/40" aria-hidden />
        ) : (
          <Plus className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        )}
      </button>
    </>
  );
}
