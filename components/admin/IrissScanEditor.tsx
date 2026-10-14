"use client";

import { ChevronLeft, ExternalLink, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import {
  addIrissListingLinkRow,
  coerceIrissListingLinkList,
  IRISS_LISTING_LINKS_PER_SOURCE_MAX,
  irissListingLinkUrlError,
  removeIrissListingLinkRow,
  setIrissListingLinkRow,
} from "@/lib/iriss-listing-link-lists";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import { IRISS_SCAN_SOURCES, type IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

/** min-7 stils: pelēks fons, baltas grupētas kartes, sīki pelēki virsraksti, akcenta teksts darbībām. */
function SourceGroup({
  label,
  logoKey,
  links,
  onChange,
}: {
  label: string;
  logoKey: import("@/lib/iriss-auction-logos").IrissAuctionLogoKey;
  links: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const rows = coerceIrissListingLinkList(links);
  const filled = rows.filter((r) => r.trim()).length;
  const canAdd = rows.length < IRISS_LISTING_LINKS_PER_SOURCE_MAX;
  return (
    <section>
      <div className="mb-1 flex items-center gap-1.5 px-1">
        <h2 className="inline-flex items-center" title={label}>
          <IrissAuctionLogo platform={logoKey} fallback={label} size="sm" />
          <span className="sr-only">{label}</span>
        </h2>
        <span className="text-[11px] text-[#aeaeb2]">{filled > 0 ? filled : ""}</span>
      </div>
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
        {rows.map((line, idx) => {
          const err = irissListingLinkUrlError(line);
          const open = line.trim() && !err ? line.trim() : null;
          return (
            <div key={idx} className="border-b border-[#e5e5ea] last:border-b-0">
              <div className="flex min-h-[44px] items-center gap-1 pl-3 pr-1">
                <input
                  className={`min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-[#c7c7cc] ${err ? "text-red-600" : "text-[var(--color-apple-text)]"}`}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://…"
                  value={line}
                  onChange={(e) => onChange(setIrissListingLinkRow(rows, idx, e.target.value))}
                  aria-label={`${label} — saite ${idx + 1}`}
                  aria-invalid={Boolean(err)}
                />
                {open ? (
                  <a href={open} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-provin-accent)] hover:bg-black/[0.04]" title="Atvērt" aria-label="Atvērt saiti">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => onChange(removeIrissListingLinkRow(rows, idx))}
                  disabled={rows.length <= 1 && !line.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#aeaeb2] transition hover:bg-red-50 hover:text-red-600 disabled:invisible"
                  title="Noņemt saiti"
                  aria-label="Noņemt saiti"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {err ? <p className="px-3 pb-2 text-[11px] text-red-600">{err}</p> : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(addIrissListingLinkRow(rows))}
          disabled={!canAdd}
          className="flex min-h-[44px] w-full items-center gap-1.5 border-t border-[#e5e5ea] px-3 text-left text-[14px] font-medium text-[var(--color-provin-accent)] transition hover:bg-black/[0.02] disabled:opacity-35"
        >
          <Plus className="h-4 w-4" aria-hidden /> Pievienot saiti
        </button>
      </div>
    </section>
  );
}

export function IrissScanEditor({
  initialRecord,
  unsavedDraft = false,
}: {
  initialRecord: IrissScanRecord;
  unsavedDraft?: boolean;
}) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissScanRecord>(initialRecord);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(Boolean(unsavedDraft && initialRecord.vin));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const persistedIdRef = useRef(unsavedDraft ? "" : initialRecord.id);
  const chips = useMemo(() => buildListingPlatformChips(rec, 50), [rec]);

  const patchRecord = useCallback((patch: Partial<IrissScanRecord>) => {
    setRec((r) => ({ ...r, ...patch }));
    setDirty(true);
    setSaveMsg(null);
  }, []);

  const save = useCallback(async () => {
    setBusy(true);
    setSaveMsg(null);
    try {
      const persistId = persistedIdRef.current;
      const isCreate = !persistId;
      const url = isCreate ? "/api/admin/iriss-scan" : `/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`;
      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCreate ? { record: rec } : rec),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveMsg(data.error === "empty_record" ? "Nav ko saglabāt. Ieraksti VIN, marku vai saiti." : `Kļūda ${res.status}`);
        return;
      }
      const data = (await res.json()) as { record?: IrissScanRecord; id?: string };
      if (data.record) {
        setRec(data.record);
        persistedIdRef.current = data.record.id;
        if (isCreate) router.replace(`/admin/iriss/scan/${encodeURIComponent(data.record.id)}`);
      } else if (typeof data.id === "string") {
        persistedIdRef.current = data.id;
        if (isCreate) router.replace(`/admin/iriss/scan/${encodeURIComponent(data.id)}`);
      }
      setDirty(false);
      setSaveMsg("Saglabāts");
    } catch {
      setSaveMsg("Tīkla kļūda");
    } finally {
      setBusy(false);
    }
  }, [rec, router]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-3 pb-10 sm:px-6">
      <AdminDashboardHeaderWithMenu>
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin/iriss/scan" className="inline-flex min-h-10 items-center gap-0.5 text-[15px] font-medium text-[var(--color-provin-accent)]">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden /> Radars
          </Link>
          <div className="flex items-center gap-2">
            {saveMsg ? <span className="text-[12px] text-[#8e8e93]">{saveMsg}</span> : dirty ? <span className="text-[12px] text-[#8e8e93]">Nesaglabātas izmaiņas</span> : null}
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => void save()}
              className="inline-flex h-9 items-center rounded-full bg-[var(--color-provin-accent)] px-4 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Saglabā…" : "Saglabāt"}
            </button>
          </div>
        </div>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-2 space-y-5">
        <div>
          <input
            className="w-full bg-transparent px-1 text-[1.6rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] outline-none placeholder:text-[#c7c7cc]"
            placeholder="Marka modelis"
            aria-label="Marka modelis"
            value={rec.brandModel}
            onChange={(e) => patchRecord({ brandModel: e.target.value })}
          />
          <input
            className="mt-2 w-full bg-transparent px-1 text-[15px] tracking-wide text-[var(--color-apple-text)] outline-none placeholder:text-[#c7c7cc]"
            placeholder="VIN"
            aria-label="VIN"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={rec.vin}
            onChange={(e) => patchRecord({ vin: e.target.value.toUpperCase() })}
          />
          <div className="mt-1 flex items-center gap-2 px-1 text-[12px] text-[#8e8e93]">
            <span>{chips.length} {chips.length === 1 ? "saite" : "saites"}</span>
            {chips.length > 0 ? (
              <>
                <span className="text-[#d1d1d6]">·</span>
                <button type="button" onClick={() => chips.forEach((c) => window.open(c.href, "_blank", "noopener,noreferrer"))} className="font-semibold text-[var(--color-provin-accent)]">
                  Atvērt visas
                </button>
              </>
            ) : null}
            <span className="text-[#d1d1d6]">·</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setSaveMsg(null);
                  try {
                    const persistId = persistedIdRef.current;
                    const res = await fetch("/api/admin/iriss-scan/ecarstrade-links", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(
                        persistId ? { apply: true, replace: true, id: persistId } : { apply: false, replace: true, record: rec },
                      ),
                    });
                    const data = (await res.json()) as {
                      saved?: IrissScanRecord[];
                      addedCount?: number;
                      updatedCount?: number;
                      results?: Array<{ added?: string[]; generated?: string[] }>;
                    };
                    if (!res.ok) {
                      setSaveMsg("eCarsTrade ģenerēšana neizdevās");
                      return;
                    }
                    const saved = data.saved?.[0];
                    if (persistId && saved) {
                      setRec(saved);
                      setDirty(false);
                      setSaveMsg(data.updatedCount || data.addedCount ? `Aizstātas eCarsTrade saites` : "eCarsTrade saite jau ir aktuāla");
                      return;
                    }
                    const generated = data.results?.[0]?.generated ?? data.results?.[0]?.added ?? [];
                    if (generated.length === 0) {
                      setSaveMsg("Nav eCarsTrade filtra no izsoles saites (Auto1/Openlane/Autobid)");
                      return;
                    }
                    patchRecord({ listingLinkEcarstrade: generated });
                    setSaveMsg(`Sagatavotas ${generated.length} eCarsTrade saites. Saglabā.`);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="font-semibold text-[var(--color-provin-accent)] disabled:opacity-40"
            >
              Atjaunot eCarsTrade
            </button>
          </div>
        </div>

        {IRISS_SCAN_SOURCES.map((s) => (
          <SourceGroup key={s.key} label={s.label} logoKey={s.logoKey} links={rec[s.key]} onChange={(next) => patchRecord({ [s.key]: next } as Pick<IrissScanRecord, IrissScanLinkKey>)} />
        ))}

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-white text-[15px] font-medium text-red-600 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] transition hover:bg-red-50/50"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Dzēst ierakstu
        </button>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" onClick={() => setDeleteOpen(false)} role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Dzēst šo radara ierakstu?</h2>
            <p className="mt-1 text-[13px] text-[#8e8e93]">Darbību nevar atsaukt.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="h-11 rounded-xl bg-[#f2f2f7] text-[15px] font-medium text-[var(--color-apple-text)]">
                Atcelt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (!persistedIdRef.current) {
                      router.push("/admin/iriss/scan");
                      return;
                    }
                    const res = await fetch(`/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`, { method: "DELETE", credentials: "include" });
                    if (!res.ok) return;
                    router.push("/admin/iriss/scan");
                    router.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-11 rounded-xl bg-red-600 text-[15px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
