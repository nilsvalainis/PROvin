"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Props = {
  compact?: boolean;
};

export function IrissNewOfferMenuButton({ compact = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const createOfferOnly = useCallback(async () => {
    if (busy) return;
    setBusy(true);
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
      if (!res.ok || !id) return;
      router.push(`/admin/iriss/pasutijumi/${encodeURIComponent(id)}?newOffer=1&noClientPdf=1`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  return (
    <button
      type="button"
      onClick={() => void createOfferOnly()}
      disabled={busy}
      className={
        compact
          ? "inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/50 px-3 py-2.5 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80 disabled:opacity-60"
          : "inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/50 px-3 py-2.5 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80 disabled:opacity-60"
      }
      title="Jauns piedāvājums bez klienta datiem"
      aria-label="Jauns piedāvājums bez klienta datiem"
    >
      <Plus className="h-4 w-4" aria-hidden />
      {busy ? "Veido…" : "PIEDĀVĀJUMS"}
    </button>
  );
}
