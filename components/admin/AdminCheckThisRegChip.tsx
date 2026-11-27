"use client";

import { useEffect, useState } from "react";

type Chip = { text: string; tone: "ok" | "missing" | "manual" };

const TONE: Record<Chip["tone"], string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  // Datu trūkums - sarkans (admin likums).
  missing: "border-rose-200 bg-rose-50 text-rose-700",
  manual: "border-amber-200 bg-amber-50 text-amber-700",
};

/** CheckThisReg automātiskās ievades statuss dīlera blokā (27.11): «dati ievadīti DD.MM» / «nav datu». */
export function AdminCheckThisRegChip({ sessionId }: { sessionId: string }) {
  const [chip, setChip] = useState<Chip | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    void fetch(`/api/admin/dealer-data/checkthisreg?sessionId=${encodeURIComponent(sessionId)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json().catch(() => ({})))
      .then((b: { chip?: Chip | null }) => {
        if (alive) setChip(b?.chip ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sessionId]);
  if (!chip) return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE[chip.tone]}`} data-ctr-chip={chip.tone}>
      {chip.text}
    </span>
  );
}
