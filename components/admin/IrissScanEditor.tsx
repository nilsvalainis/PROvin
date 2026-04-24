"use client";

import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import {
  buildListingPlatformChips,
  IR_LISTING_ALL_CHIP_STYLE,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

export function IrissScanEditor({ initialRecord }: { initialRecord: IrissScanRecord }) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissScanRecord>(initialRecord);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const chips = useMemo(() => buildListingPlatformChips(rec, 5), [rec]);

  const patchRecord = useCallback((patch: Partial<IrissScanRecord>) => setRec((r) => ({ ...r, ...patch })), []);

  const save = useCallback(async () => {
    setBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rec),
      });
      if (!res.ok) {
        setSaveMsg(`Kļūda ${res.status}`);
        return;
      }
      const data = (await res.json()) as { record?: IrissScanRecord };
      if (data.record) setRec(data.record);
      setSaveMsg("Saglabāts.");
    } catch {
      setSaveMsg("Tīkla kļūda.");
    } finally {
      setBusy(false);
    }
  }, [rec]);

  return (
    <div className="mx-auto w-full max-w-[1200px] bg-white px-3 pb-8 sm:px-6 lg:px-10">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-col gap-2">
          <Link href="/admin/iriss/scan" title="Atpakaļ" aria-label="Atpakaļ" className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.3} aria-hidden />
            <span>Atpakaļ</span>
          </Link>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">IRISS · SCAN</p>
            <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">SCAN ieraksts</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--color-provin-accent)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-50">
              <Save className="h-4 w-4" aria-hidden />
              {busy ? "Saglabā..." : "Saglabāt"}
            </button>
          </div>
        </div>
        {saveMsg ? <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]">{saveMsg}</p> : null}
      </AdminDashboardHeaderWithMenu>

      <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-5">
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          {chips.length > 0 ? (
            <div className={`mb-3 ${LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}`}>
              {chips.map((c, i) => (
                <a key={`${c.href}-${i}`} href={c.href} target="_blank" rel="noopener noreferrer" title={c.title} className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} style={c.chipStyle}>
                  {c.letter}
                </a>
              ))}
              <button type="button" onClick={() => chips.forEach((chip) => window.open(chip.href, "_blank", "noopener,noreferrer"))} title="Atvērt visas saites" aria-label="Atvērt visas saites" className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} style={IR_LISTING_ALL_CHIP_STYLE}>
                ALL
              </button>
            </div>
          ) : null}
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Marka modelis</span>
            <input className={fieldClass} value={rec.brandModel} onChange={(e) => patchRecord({ brandModel: e.target.value })} />
          </label>

          <div className="mt-3 border-t border-slate-200/80 pt-3">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">Sludinājumu saites</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Mobile</span>
                <input className={fieldClass} type="url" value={rec.listingLinkMobile} onChange={(e) => patchRecord({ listingLinkMobile: e.target.value })} />
              </label>
              <label className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Autobid</span>
                <input className={fieldClass} type="url" value={rec.listingLinkAutobid} onChange={(e) => patchRecord({ listingLinkAutobid: e.target.value })} />
              </label>
              <label className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Openline</span>
                <input className={fieldClass} type="url" value={rec.listingLinkOpenline} onChange={(e) => patchRecord({ listingLinkOpenline: e.target.value })} />
              </label>
              <label className="min-w-0">
                <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Auto1</span>
                <input className={fieldClass} type="url" value={rec.listingLinkAuto1} onChange={(e) => patchRecord({ listingLinkAuto1: e.target.value })} />
              </label>
            </div>
            <div className="mt-2 space-y-2">
              {rec.listingLinksOther.map((line, idx) => (
                <input
                  key={idx}
                  className={fieldClass}
                  type="url"
                  value={line}
                  onChange={(e) => {
                    const next = [...rec.listingLinksOther];
                    next[idx] = e.target.value;
                    patchRecord({ listingLinksOther: next });
                  }}
                  placeholder="Citi: https://..."
                />
              ))}
              <button
                type="button"
                onClick={() => patchRecord({ listingLinksOther: [...rec.listingLinksOther, ""] })}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
              >
                Pievienot rindu
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-red-100/80 bg-red-50/20 p-4 shadow-sm sm:p-5">
          <p className="text-[12px] leading-snug text-red-950/90">Neatgriezeniski dzēst šo SCAN ierakstu.</p>
          <button type="button" onClick={() => setDeleteOpen(true)} className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 shadow-sm transition hover:bg-red-50">
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
            Dzēst ierakstu
          </button>
        </section>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" onClick={() => setDeleteOpen(false)} role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">Vai tiešām vēlaties neatgriezeniski dzēst šo SCAN ierakstu?</h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50">
                Atcelt
              </button>
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`, { method: "DELETE", credentials: "include" });
                    if (!res.ok) return;
                    router.push("/admin/iriss/scan");
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800"
              >
                Dzēst
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
