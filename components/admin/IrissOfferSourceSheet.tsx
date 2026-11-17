"use client";

import { Car, ClipboardPaste, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  IRISS_AUCTION_LINK_LABEL,
  irissAuctionLinkPlatformHint,
  irissAuctionLinkSupported,
  parseIrissAuctionLink,
  type IrissAuctionLinkPlatform,
} from "@/lib/iriss-auction-link";
import { filterOfferSourceCars, type OfferSourceCarRow } from "@/lib/iriss-offer-source-cars";
import { offerSourceRefString, type OfferSourceKind } from "@/lib/iriss-stock-photos";

type Tab = OfferSourceKind | "link" | "empty";

const TAB_LABEL: Record<Tab, string> = { autoparks: "Autoparks", logistics: "Loģistika", link: "No saites", empty: "Tukšs" };

type Props = {
  onClose: () => void;
  /** from = "autoparks:<id>" | "logistics:<id>"; tukšs - forma no nulles. */
  onOpen: (from: string) => void;
  /** j56: ielīmēta Auto1/Openlane saite -> melnraksts. Bez šī cilne "No saites" netiek rādīta. */
  onOpenLink?: (url: string) => void;
};

type RelaySession = "ok" | "login_required" | "unknown" | "not_configured" | "unreachable";

/** T1 (j44 makets): saites lauks, platformas zīme, releja sesijas stāvoklis. */
function OfferLinkCard({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [sessions, setSessions] = useState<Partial<Record<IrissAuctionLinkPlatform, RelaySession>>>({});
  const hint = irissAuctionLinkPlatformHint(url);
  const link = parseIrissAuctionLink(url);
  const supported = Boolean(link && irissAuctionLinkSupported(link.platform));
  const session = hint ? sessions[hint] : undefined;

  useEffect(() => {
    if (!hint || !irissAuctionLinkSupported(hint) || sessions[hint]) return;
    const platform = hint;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/iriss-offer-seed/from-link?platform=${platform}`, { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as { session?: RelaySession };
        if (!cancelled) setSessions((s) => ({ ...s, [platform]: res.ok && data.session ? data.session : "unknown" }));
      } catch {
        if (!cancelled) setSessions((s) => ({ ...s, [platform]: "unknown" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hint, sessions]);

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setUrl(text.trim());
    } catch {
      /* pārlūks neļauj - ielīmē ar roku */
    }
  };

  return (
    <div className="mt-3 rounded-[14px] border border-[#e5e5ea] bg-white p-3.5">
      <label htmlFor="iriss-offer-link-input" className="mb-[7px] block text-[13px] font-semibold text-[#1d1d1f]">
        Izsoles saite
      </label>
      <div className="flex gap-2">
        <input
          id="iriss-offer-link-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && link && supported) onSubmit(link.url);
          }}
          placeholder="https://www.auto1.com/..."
          className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] border-[#e5e5ea] bg-white px-3 text-[14px] text-[#1d1d1f] outline-none focus:border-[#0066ff] focus:shadow-[0_0_0_3px_#e8f2fc]"
        />
        <button
          type="button"
          onClick={() => void paste()}
          aria-label="Ielīmēt saiti"
          title="Ielīmēt"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#f5f5f7] text-[#6e6e73]"
        >
          <ClipboardPaste className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      {url.trim() ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5" aria-live="polite">
          {hint ? (
            <span className="inline-flex items-center gap-[5px] rounded-full bg-[#f5f5f7] px-2.5 py-[5px] text-[11.5px] font-semibold text-[#6e6e73]">
              <span className={`h-[7px] w-[7px] rounded-full ${irissAuctionLinkSupported(hint) ? "bg-[#0066ff]" : "bg-[#86868b]"}`} aria-hidden />
              {IRISS_AUCTION_LINK_LABEL[hint]} -{" "}
              {!irissAuctionLinkSupported(hint) ? "vēl netiek atbalstīts" : link ? "atpazīts" : "nav auto detaļu saite"}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-[#f5f5f7] px-2.5 py-[5px] text-[11.5px] font-semibold text-[#6e6e73]">
              Nav Auto1 vai Openlane saite
            </span>
          )}
        </div>
      ) : null}
      <button
        type="button"
        disabled={!supported}
        onClick={() => link && onSubmit(link.url)}
        className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#0066ff] text-[15px] font-semibold text-white disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
      >
        Izveidot melnrakstu →
      </button>
      <p className="mt-2 text-[12px] leading-[1.4] text-[#6e6e73]">
        Atpazīst Auto1 un Openlane detaļu lapu saites.
        {session === "ok" ? " Ielogošanās jau ir aktīva (Releja sesija: ✓ pieslēgts)." : ""}
      </p>
      {session === "login_required" ? (
        <p className="mt-2 rounded-[10px] border border-[#f0d77a] bg-[#fff7d6] px-2.5 py-2 text-[12px] leading-[1.4] text-[#5a4a00]" role="status">
          Sesija beigusies - jāielogojas. IRISS{" "}
          <Link href="/admin/iriss/sludinajumi" className="font-semibold underline">
            Sludinājumos
          </Link>{" "}
          spied Ielogoties.
        </p>
      ) : null}
    </div>
  );
}

/** Klienta kabinetā "Izveidot piedāvājumu": auto izvēle Autoparks | Loģistika | Tukšs (telefonā apakšējā lapa). */
export function IrissOfferSourceSheet({ onClose, onOpen, onOpenLink }: Props) {
  const [tab, setTab] = useState<Tab>("autoparks");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");
  const [rows, setRows] = useState<Partial<Record<OfferSourceKind, OfferSourceCarRow[]>>>({});
  const [errors, setErrors] = useState<Partial<Record<OfferSourceKind, string>>>({});

  useEffect(() => {
    if (tab === "empty" || tab === "link" || rows[tab] || errors[tab]) return;
    const kind = tab;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/iriss-offer-seed/cars?kind=${kind}`, { credentials: "include" });
        const data = (await res.json().catch(() => ({}))) as { rows?: OfferSourceCarRow[] };
        if (cancelled) return;
        if (res.status === 403) setErrors((e) => ({ ...e, [kind]: `Nav piekļuves sadaļai ${TAB_LABEL[kind]}.` }));
        else if (!res.ok || !Array.isArray(data.rows)) setErrors((e) => ({ ...e, [kind]: "Sarakstu neizdevās ielādēt." }));
        else setRows((r) => ({ ...r, [kind]: data.rows }));
      } catch {
        if (!cancelled) setErrors((e) => ({ ...e, [kind]: "Tīkla kļūda." }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, rows, errors]);

  const list = tab === "empty" || tab === "link" ? [] : rows[tab];
  const visible = useMemo(() => filterOfferSourceCars(list ?? [], query).slice(0, 100), [list, query]);
  const canOpen = tab === "empty" || Boolean(picked && visible.some((r) => r.id === picked));
  const backdropClose = useModalBackdropClose(onClose);

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" role="presentation" {...backdropClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-offer-source-title"
        className="flex max-h-[85dvh] w-full flex-col rounded-t-[22px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-xl sm:max-w-md sm:rounded-[22px] sm:pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
        <h3 id="iriss-offer-source-title" className="text-center text-[17px] font-semibold text-[var(--color-apple-text)]">
          Izveidot piedāvājumu
        </h3>
        <div className={`mt-3 grid gap-2 ${onOpenLink ? "grid-cols-4" : "grid-cols-3"}`} role="tablist" aria-label="Auto avots">
          {(onOpenLink ? (["autoparks", "logistics", "link", "empty"] as const) : (["autoparks", "logistics", "empty"] as const)).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPicked("");
                setQuery("");
              }}
              className={`h-11 rounded-xl font-semibold ${onOpenLink ? "px-1 text-[13px]" : "text-[14px]"} ${tab === t ? "bg-[#373b45] text-white" : "border border-slate-200 bg-white text-[var(--color-apple-text)]"}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {tab === "link" ? (
          onOpenLink ? <OfferLinkCard onSubmit={onOpenLink} /> : null
        ) : tab === "empty" ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-[14px] text-slate-600">Tukša forma - dati un bildes jāievada pašam.</p>
        ) : (
          <>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Marka, modelis vai VIN"
                aria-label="Meklēt auto"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-slate-400"
              />
            </label>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-200" role="radiogroup" aria-label="Auto">
              {errors[tab] ? (
                <p className="px-4 py-3 text-[13px] text-red-700">{errors[tab]}</p>
              ) : !list ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Ielādē...</p>
              ) : visible.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-slate-500">Nekas nav atrasts.</p>
              ) : (
                visible.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={picked === r.id}
                    onClick={() => setPicked(r.id)}
                    className={`flex min-h-[60px] w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-b-0 ${picked === r.id ? "bg-[#eef3fd]" : "bg-white"}`}
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${picked === r.id ? "border-[#2563eb] bg-[radial-gradient(circle,#2563eb_45%,transparent_50%)]" : "border-slate-300"}`}
                      aria-hidden
                    />
                    <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400" aria-hidden>
                      <Car className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-[var(--color-apple-text)]">{r.title}</span>
                      {r.sub ? <span className="block truncate text-[13px] text-slate-500">{r.sub}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        {tab === "link" ? null : (
          <button
            type="button"
            disabled={!canOpen}
            onClick={() => onOpen(tab === "empty" ? "" : offerSourceRefString({ kind: tab, id: picked }))}
            className="mt-3 h-12 w-full shrink-0 rounded-xl bg-[#373b45] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            Atvērt
          </button>
        )}
      </div>
    </div>
  );
}
