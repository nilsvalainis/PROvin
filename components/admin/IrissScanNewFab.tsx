"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  /** Tukšajā saraksta kartītē: redzama „+” poga teksta blakus (nav `fixed`). */
  withEmptyCardProminence?: boolean;
};

export function IrissScanNewFab({ withEmptyCardProminence = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/iriss-scan", {
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
        setErr(errorMsg ?? `Neizdevās izveidot (${res.status}).`);
        return;
      }
      router.push(`/admin/iriss/scan/${encodeURIComponent(id)}`);
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
          className="fixed bottom-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] left-3 right-3 z-[85] rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-center text-[12px] font-medium text-amber-950 shadow-lg sm:left-auto sm:right-5 sm:max-w-sm"
          role="alert"
        >
          {err}
          <button type="button" className="ml-2 underline" onClick={() => setErr(null)}>
            Aizvērt
          </button>
        </div>
      ) : null}
      {withEmptyCardProminence ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/20 bg-[var(--color-provin-accent)]/88 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm backdrop-blur-xl transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
            aria-label="Jauns SCAN ieraksts"
          >
            {busy ? (
              <span className="h-5 w-5 animate-pulse rounded-md bg-white/40" aria-hidden />
            ) : (
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
            )}
            Jauns ieraksts
          </button>
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void create()}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-[65] flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-[var(--color-provin-accent)]/88 text-white shadow-sm backdrop-blur-xl transition hover:opacity-95 active:scale-95 disabled:opacity-60 sm:bottom-6 sm:right-5"
        aria-label="Jauns SCAN ieraksts"
        title="Jauns SCAN ieraksts"
      >
        {busy ? <span className="h-5 w-5 animate-pulse rounded-md bg-white/40" aria-hidden /> : <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />}
      </button>
    </>
  );
}
