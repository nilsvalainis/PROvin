"use client";

/**
 * «Izsoļu arhīvs dīlera datu vietā» admin daļa (makets 1. un 5. solis):
 * - `useAuctionArchiveState` - piedāvājuma stāvoklis no `/api/admin/auction-archive-offer`;
 * - `AuctionArchiveSendSection` - sūtīšanas loga 4. situācija (kopsavilkums, 2 bilžu izvēle, manuāls avots);
 * - `AdminAuctionArchivePanel` - pasūtījuma dīlera blokā: laika josla, «Sūtīt izsoļu arhīvu», «Atzīmēt manuāli: 1 / 2».
 * Klientam šeit nekas netiek sūtīts - tikai sūtīšanas logā pēc Nila pogas.
 */
import { useCallback, useEffect, useState } from "react";
import {
  AUCTION_ARCHIVE_MARK_ZONES,
  formatEurCents,
  formatEurWhole,
  formatIsoDayLv,
  formatKm,
  lvCount,
  type AuctionArchiveManualSource,
  type AuctionArchiveMarkZone,
  type AuctionArchiveOfferPublic,
  type AuctionArchiveOperatorMark,
  type AuctionArchiveSummary,
  type AuctionArchiveTone,
} from "@/lib/auction-archive-offer";
import { formatRigaDayTime } from "@/lib/order-client-marks";

export type AuctionArchivePhotoOption = {
  id: string;
  auctionKey: string;
  date: string;
  caption: string;
  thumb: string | null;
};

export type AuctionArchiveState = {
  offer: AuctionArchiveOfferPublic | null;
  eligible: boolean;
  summary: AuctionArchiveSummary;
  paidCents: number | null;
  refunded: boolean;
  photos: AuctionArchivePhotoOption[];
};

const API = "/api/admin/auction-archive-offer";

export async function postAuctionArchive(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

export function useAuctionArchiveState(sessionId: string, active: boolean, refreshKey = 0) {
  const [state, setState] = useState<AuctionArchiveState | null>(null);
  const reload = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}?sessionId=${encodeURIComponent(sessionId)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      setState((await res.json()) as AuctionArchiveState);
    } catch {
      /* nav kritiski */
    }
  }, [sessionId]);
  useEffect(() => {
    if (active) void reload();
  }, [active, reload, refreshKey]);
  return { state, setState, reload };
}

/** Kļūdu teksti latviski (bez tehniskiem kodiem). */
export function auctionArchiveErrorLv(code: unknown): string {
  switch (code) {
    case "already_chosen":
      return "Klients jau izvēlējās - jaunu piedāvājumu nesūta.";
    case "closed":
    case "already_sent":
      return "Piedāvājums jau noslēgts (PDF nosūtīts vai atmaksāts).";
    case "already_refunded":
      return "Maksājums jau atmaksāts.";
    case "not_chosen":
      return "PDF sūta tikai pēc klienta «Jā» (izvēle «Izsoļu arhīvs»).";
    case "no_archive_data":
      return "Izsoļu arhīvā nav ierakstu.";
    case "no_vin":
      return "Pasūtījumā nav VIN.";
    case "email_failed":
      return "E-pasts netika nosūtīts.";
    case "pdf_failed":
      return "PDF netika izveidots.";
    case "pdf_missing":
      return "Vispirms sagatavo PDF («Skatīt PDF»).";
    case "order_not_eligible":
      return "Nepieciešams derīgs klienta e-pasts.";
    default:
      return "Neizdevās.";
  }
}

const TONE_CLS: Record<AuctionArchiveTone, string> = {
  wait: "border-amber-200 bg-amber-50 text-amber-800",
  todo: "border-sky-200 bg-sky-50 text-sky-800",
  alert: "border-rose-200 bg-rose-50 text-rose-700",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

export function AuctionArchiveStatusBadge({ label, tone }: { label: string; tone: AuctionArchiveTone }) {
  return <span className={`inline-flex rounded border px-1.5 py-px text-[10.5px] font-medium ${TONE_CLS[tone]}`}>{label}</span>;
}

/* ---------- Sūtīšanas logs ---------- */

export function AuctionArchiveSendSection({
  state,
  previewIds,
  onPreviewIds,
  manualSources,
  onManualSources,
  disabled,
}: {
  state: AuctionArchiveState;
  previewIds: string[];
  onPreviewIds: (ids: string[]) => void;
  manualSources: AuctionArchiveManualSource[];
  onManualSources: (list: AuctionArchiveManualSource[]) => void;
  disabled: boolean;
}) {
  const [link, setLink] = useState("");
  const s = state.summary;
  const offer = state.offer;
  const ready = offer?.status === "chose_archive";
  const photos = state.photos.filter((p) => p.thumb).slice(0, 48);
  const togglePhoto = (id: string) => {
    if (previewIds.includes(id)) onPreviewIds(previewIds.filter((x) => x !== id));
    else onPreviewIds([...previewIds, id].slice(-2));
  };
  const addLink = () => {
    const url = link.trim();
    if (!/^https:\/\//i.test(url)) return;
    let label = url;
    try {
      label = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    onManualSources([...manualSources, { kind: (/\.pdf(\?|$)/i.test(url) ? "pdf" : "link") as AuctionArchiveManualSource["kind"], label, url }].slice(0, 10));
    setLink("");
  };

  return (
    <div className="space-y-2" data-archive-section>
      <div className="amx-card rounded-lg border border-slate-200 px-3 py-2">
        <div className="amx-tx flex flex-wrap items-baseline justify-between gap-2 text-[12.5px] font-semibold text-slate-900 max-md:text-[15px]">
          <span>
            {lvCount(s.auctions.length, "izsole", "izsoles")} · {lvCount(s.photoCount, "bilde", "bildes")}
          </span>
          {offer ? <AuctionArchiveStatusBadge label={offer.statusLabel} tone={offer.tone} /> : null}
        </div>
        <ul className="mt-1 space-y-0.5">
          {s.auctions.map((a) => (
            <li key={a.key} className="amx-mut flex flex-wrap gap-x-2 text-[11.5px] text-slate-600 max-md:text-[13px]">
              <span className="amx-tx font-medium text-slate-800">
                {[formatIsoDayLv(a.date), a.platform].filter(Boolean).join(" · ") || "Izsole"}
              </span>
              {a.km != null ? <span>{formatKm(a.km)}</span> : null}
              {a.priceEur != null ? <span>{formatEurWhole(a.priceEur)}</span> : null}
              <span className={a.photos ? "" : "text-rose-600"}>{a.photos ? lvCount(a.photos, "bilde", "bildes") : "bilžu nav"}</span>
            </li>
          ))}
        </ul>
        <p className="amx-mut mt-1 text-[11px] text-slate-500">
          Samaksāts {formatEurCents(state.paidCents) || "-"} · {state.refunded ? "atmaksāts" : "neatmaksāts"}
        </p>
      </div>

      {!ready ? (
        <>
          {photos.length > 0 ? (
            <div>
              <p className="amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">
                2 bildes ziņā (izplūdinātas) · {previewIds.length}/2
              </p>
              <div className="grid grid-cols-6 gap-1 max-md:grid-cols-4">
                {photos.map((p) => {
                  const on = previewIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => togglePhoto(p.id)}
                      title={[formatIsoDayLv(p.date), p.caption].filter(Boolean).join(" · ")}
                      className={`relative aspect-[4/3] overflow-hidden rounded border ${on ? "border-[#0061D2] ring-2 ring-[#0061D2]" : "border-slate-200"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumb!} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {on ? (
                        <span className="absolute right-0.5 top-0.5 rounded bg-[#0061D2] px-1 text-[9px] font-bold text-white">
                          {previewIds.indexOf(p.id) + 1}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div>
            <p className="amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">
              Manuāli: checkcar.vin u.c.
            </p>
            {manualSources.length ? (
              <ul className="mb-1 space-y-0.5">
                {manualSources.map((m, i) => (
                  <li key={`${m.url ?? m.label}-${i}`} className="amx-tx flex items-center justify-between gap-2 text-[11.5px] text-slate-700">
                    <span className="truncate">
                      {m.label}
                      {m.kind === "pdf" ? " (PDF)" : ""}
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-rose-600"
                      disabled={disabled}
                      onClick={() => onManualSources(manualSources.filter((_, j) => j !== i))}
                    >
                      Noņemt
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-1.5">
              <input
                className="amx-fld min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900"
                placeholder="https://… (saite vai PDF)"
                value={link}
                disabled={disabled}
                onChange={(e) => setLink(e.target.value)}
              />
              <button
                type="button"
                className="amx-btn amx-btn--sm min-h-8 rounded-md border border-slate-300 bg-white px-2 text-[11.5px] text-slate-700"
                disabled={disabled || !/^https:\/\//i.test(link.trim())}
                onClick={addLink}
              >
                + Pievienot
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------- Pasūtījuma dīlera bloks ---------- */

const EVENT_LV: Record<string, string> = {
  offer_sent: "Piedāvājums nosūtīts",
  choice: "Klients izvēlējās",
  manual_choice: "Atzīmēts manuāli",
  archive_sent: "Izsoļu arhīvs nosūtīts",
  refunded: "Atzīmēts: atmaksāts",
  withdrawn: "Piedāvājums atsaukts",
  admin_reminded: "Atgādinājums Nilam (3 d bez izvēles)",
};

const ZONE_LV: Record<AuctionArchiveMarkZone, string> = {
  front: "Priekšpuse",
  rear: "Aizmugure",
  left: "Kreisā puse",
  right: "Labā puse",
  roof: "Jumts",
};

const small =
  "amx-btn amx-btn--sm rounded-md border border-slate-300 bg-white px-2 py-1 text-[10.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function AdminAuctionArchivePanel({
  sessionId,
  refreshKey = 0,
  onOpenSend,
}: {
  sessionId: string;
  refreshKey?: number;
  /** Atver sūtīšanas logu ar situāciju «Izsoļu arhīvs». */
  onOpenSend: () => void;
}) {
  const { state, setState, reload } = useAuctionArchiveState(sessionId, true, refreshKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [markZone, setMarkZone] = useState<AuctionArchiveMarkZone>("rear");
  const [markNote, setMarkNote] = useState("");
  const offer = state?.offer ?? null;
  if (!state || !offer) return null;

  const act = async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setMsg(null);
    const r = await postAuctionArchive({ action, sessionId, ...extra });
    setBusy(null);
    if (!r.ok) {
      setMsg(auctionArchiveErrorLv(r.data.error));
      return;
    }
    if (action === "delete") setState({ ...state, offer: null });
    else if (r.data.offer) setState({ ...state, offer: r.data.offer as AuctionArchiveOfferPublic });
    if (action === "pdf" && typeof r.data.url === "string") {
      window.open(r.data.url, "_blank", "noopener,noreferrer");
      const miss = Number(r.data.missingPhotos) || 0;
      setMsg(miss > 0 ? `PDF gatavs, ${miss} bildes neizdevās ielasīt.` : "PDF gatavs.");
    }
  };

  const firstAuction = offer.summary.auctions[offer.summary.auctions.length - 1]?.key ?? "manual";
  const marks = offer.marks ?? [];
  const saveMarks = (next: AuctionArchiveOperatorMark[]) => void act("marks", { marks: next });
  const open = offer.status === "pending" || offer.status === "chose_archive" || offer.status === "chose_refund";

  return (
    <div className="amx-card mt-2 rounded-lg border border-slate-200 px-3 py-2" data-archive-panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="amx-tx text-[12px] font-semibold text-slate-900">Izsoļu arhīva piedāvājums</p>
        <AuctionArchiveStatusBadge label={offer.statusLabel} tone={offer.tone} />
      </div>
      <ul className="mt-1 space-y-0.5">
        {offer.history.map((h, i) => (
          <li key={`${h.at}-${i}`} className="amx-mut text-[11px] text-slate-600">
            <span className="tabular-nums">{formatRigaDayTime(h.at)}</span> {EVENT_LV[h.event] ?? h.event}
            {h.choice ? `: ${h.choice === "archive" ? "izsoļu arhīvs" : "atmaksa"}` : ""}
            {h.event === "choice" ? " · saite" : ""}
            {h.channel ? ` · ${h.channel === "email" ? "e-pasts" : "WhatsApp"}` : ""}
          </li>
        ))}
        {offer.status === "chose_archive" ? <li className="text-[11px] text-sky-700">- PDF vēl nav nosūtīts</li> : null}
        {offer.status === "chose_refund" ? (
          <li className="text-[11px] font-medium text-rose-700">- Jāatmaksā {formatEurCents(offer.paidCents)} (esošā poga «Atgriezt maksājumu»)</li>
        ) : null}
        {offer.photosMissing > 0 ? (
          <li className="text-[11px] text-rose-600">{offer.photosMissing} bildes neizdevās saglabāt (avots vairs nedod)</li>
        ) : null}
      </ul>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className={small} disabled={busy !== null || offer.status !== "chose_archive"} onClick={onOpenSend}>
          Sūtīt izsoļu arhīvu
        </button>
        {open ? (
          <>
            <button type="button" className={small} disabled={busy !== null} onClick={() => void act("manual_choice", { choice: "archive" }, "Atzīmēt: klients izvēlējās izsoļu arhīvu (1)?")}>
              Atzīmēt manuāli: 1
            </button>
            <button type="button" className={small} disabled={busy !== null} onClick={() => void act("manual_choice", { choice: "refund" }, "Atzīmēt: klients izvēlējās atmaksu (2)?")}>
              2
            </button>
          </>
        ) : null}
        <button type="button" className={small} disabled={busy !== null} onClick={() => void act("pdf")}>
          {busy === "pdf" ? "Gatavo PDF…" : "Skatīt PDF"}
        </button>
        {open ? (
          <button type="button" className={small} disabled={busy !== null} onClick={() => void act("mark_refunded", {}, "Atzīmēt, ka atmaksa veikta?")}>
            Atmaksāts
          </button>
        ) : null}
        {open ? (
          <button type="button" className={small} disabled={busy !== null} onClick={() => void act("withdraw", {}, "Atsaukt piedāvājumu? Klienta saite vairs nedarbosies.")}>
            Atsaukt
          </button>
        ) : null}
        <button
          type="button"
          className={`${small} text-rose-700`}
          disabled={busy !== null}
          onClick={() => void act("delete", {}, "Dzēst piedāvājumu un saglabātās bilžu kopijas? Izsoļu bloks pasūtījumā paliek.")}
        >
          Dzēst
        </button>
        <button type="button" className={small} disabled={busy !== null} onClick={() => void reload()}>
          Atjaunot
        </button>
      </div>

      <details className="mt-1.5">
        <summary className="amx-mut cursor-pointer text-[11px] text-slate-600">«Redzams bildē» atzīmes PDF ({marks.length})</summary>
        <ul className="mt-1 space-y-0.5">
          {marks.map((m, i) => (
            <li key={`${m.zone}-${i}`} className="amx-tx flex items-center justify-between gap-2 text-[11px] text-slate-700">
              <span>
                {ZONE_LV[m.zone]}
                {m.note ? ` - ${m.note}` : ""}
              </span>
              <button type="button" className="text-rose-600" disabled={busy !== null} onClick={() => saveMarks(marks.filter((_, j) => j !== i))}>
                Noņemt
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <select
            className="amx-fld rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-900"
            value={markZone}
            onChange={(e) => setMarkZone(e.target.value as AuctionArchiveMarkZone)}
          >
            {AUCTION_ARCHIVE_MARK_ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LV[z]}
              </option>
            ))}
          </select>
          <input
            className="amx-fld min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900"
            placeholder="piem. pēdas aizmugurējās durvīs"
            value={markNote}
            onChange={(e) => setMarkNote(e.target.value)}
          />
          <button
            type="button"
            className={small}
            disabled={busy !== null}
            onClick={() => {
              saveMarks([...marks, { auctionKey: firstAuction, zone: markZone, ...(markNote.trim() ? { note: markNote.trim() } : {}) }]);
              setMarkNote("");
            }}
          >
            + Atzīme
          </button>
        </div>
      </details>
      {msg ? <p className="amx-mut mt-1 text-[11px] text-slate-600">{msg}</p> : null}
    </div>
  );
}
