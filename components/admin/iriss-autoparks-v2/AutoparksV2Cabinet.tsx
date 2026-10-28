"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AUTOPARKS_STATUS_LV, type AutoparksStatus } from "@/lib/iriss-autoparks";
import { AUTOPARKS_V2_STATUS_ORDER, V2_STATUS_UNDO_CLIENT_MS, type AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import {
  allowedTabs,
  CABINET_TAB_LABEL,
  resolveCabinetTab,
  type CabinetPaneKey,
  type CabinetTab,
} from "@/lib/iriss-autoparks-v2-cabinet-tabs";
import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import { IrissSaitesPanel } from "@/components/admin/iriss-saites/IrissSaitesPanel";
import type { AutoparksTransit } from "@/lib/iriss-autoparks-transit";
import { AutoparksV2Cela } from "./AutoparksV2Cela";
import { AutoparksV2Csdd } from "./AutoparksV2Csdd";
import { AutoparksV2History } from "./AutoparksV2History";
import { AutoparksV2OfferActions } from "./AutoparksV2OfferActions";
import { AutoparksV2Pamatdati } from "./AutoparksV2Pamatdati";
import { AutoparksV2PhotoPicker } from "./AutoparksV2PhotoPicker";
import { AutoparksV2Waybill } from "./AutoparksV2Waybill";
import { CABINET_PANES } from "./panes";
import { CarImg, VinCopy, yearColor } from "./ui";

export type { CabinetTab } from "@/lib/iriss-autoparks-v2-cabinet-tabs";
export { allowedTabs } from "@/lib/iriss-autoparks-v2-cabinet-tabs";

export type CabinetPaneProps = { carId: string; perms: AutoparksV2Perms; basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void };

/** Fāzēs pievienotās cilnes (F5a Iegāde, F6 Serviss, F7 Izdevumi + Cenu lapa). */
export type CabinetPanes = Partial<Record<CabinetPaneKey, (p: CabinetPaneProps) => ReactNode>>;

const BASE = "/admin/iriss/autoparks-v2";

export function AutoparksV2Cabinet({
  initialBasics,
  perms,
  canCreateOffer = false,
  canWaybill = false,
  transit = null,
  transitCanWrite = false,
}: {
  initialBasics: AutoparksV2Basics;
  /** «Ceļā» posms (Nils 27.10): Loģistikas dati, ja auto ir aktīvs Loģistikas ieraksts un ir Loģistikas tiesība. */
  transit?: AutoparksTransit | null;
  transitCanWrite?: boolean;
  perms: AutoparksV2Perms;
  canCreateOffer?: boolean;
  /** Poga «Pavadzīme» (Nils 27.10): tikai ar Pavadzīmju sadaļas tiesību. */
  canWaybill?: boolean;
}) {
  const panes = CABINET_PANES;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [basics, setBasics] = useState(initialBasics);
  const [sheet, setSheet] = useState(false);
  const [photoPicker, setPhotoPicker] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [toast, setToast] = useState<{ historyId: string; status: AutoparksStatus; left: number } | null>(null);
  const [statusErr, setStatusErr] = useState("");
  const tabs = allowedTabs(perms, panes, { transit: Boolean(transit) });
  const tab = resolveCabinetTab(params.get("t"), tabs, perms.vesture);
  const compact = tab !== "pamatdati";

  const go = (t: CabinetTab) => router.replace(`${pathname}?t=${t}`, { scroll: false });

  // Atsaukšanas taimeris (T10): 5, 4, ... 1, tad toast pazūd.
  useEffect(() => {
    if (!toast) return;
    if (toast.left <= 0) {
      setToast(null);
      return;
    }
    const t = setTimeout(() => setToast((cur) => (cur ? { ...cur, left: cur.left - 1 } : cur)), 1000);
    return () => clearTimeout(t);
  }, [toast]);

  async function setStatus(s: AutoparksStatus) {
    setSheet(false);
    if (s === basics.status) return;
    setStatusErr("");
    const prev = basics;
    setBasics({ ...basics, status: s, statusLabel: AUTOPARKS_STATUS_LV[s] });
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}/statuss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { historyId?: string } | null;
    if (!res?.ok || !data?.historyId) {
      setBasics(prev);
      setStatusErr("Statusu neizdevās mainīt");
      return;
    }
    setToast({ historyId: data.historyId, status: s, left: Math.round(V2_STATUS_UNDO_CLIENT_MS / 1000) });
  }

  async function undo() {
    if (!toast) return;
    const t = toast;
    setToast(null);
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}/statuss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ undo: t.historyId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { status?: AutoparksStatus } | null;
    if (res?.ok && data?.status) setBasics((b) => ({ ...b, status: data.status!, statusLabel: AUTOPARKS_STATUS_LV[data.status!] }));
    else setStatusErr("Atsaukt vairs nevar - statuss jau mainīts");
  }

  const onBasics = useCallback((b: AutoparksV2Basics) => setBasics(b), []);
  const statusBtn = (cls: string) =>
    perms.pamatdati ? (
      <button type="button" className={`ap2-statusbtn st-${basics.status} ${cls}`} onClick={() => setSheet(true)}>
        <span className="l">{basics.statusLabel}</span>
        <small>›</small>
      </button>
    ) : (
      <div className={`ap2-statusbtn st-${basics.status} ${cls}`}>
        <span className="l">{basics.statusLabel}</span>
      </div>
    );

  const onHome = tab === (tabs.includes("pamatdati") ? "pamatdati" : (tabs[0] ?? tab));
  const pane = tab === "vesture" || tab === "pamatdati" || tab === "csdd" || tab === "cela" ? null : panes[tab];

  return (
    <div className="ap2 ap2-cab">
      <div className="ap2-bar">
        <Link href={BASE} className="ap2-back" aria-label="Atpakaļ uz Autoparks">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span>Autoparks</span>
        </Link>
        <h2>{compact ? basics.title : "Auto kabinets"}</h2>
        {compact ? (
          <button type="button" className={`ap2-pill st-${basics.status}`} style={{ border: 0 }} onClick={() => perms.pamatdati && setSheet(true)}>
            {basics.statusLabel}
          </button>
        ) : null}
      </div>
      <Link href={BASE} className="ap2-crumb">
        ‹ Autoparks
      </Link>

      <div className={`ap2-carhead ${compact ? "compact" : ""}`}>
        <div className="ap2-carhead-main">
          <CarImg carId={basics.id} version={photoVersion} onEditPhoto={!compact && perms.pamatdati ? () => setPhotoPicker(true) : undefined} />
          <div className="nm">
            <b>{basics.title}</b>
            <div className="meta">
              <span>{yearColor(basics.year, basics.color)}</span>
              <OwnerBadge basics={basics} canEdit={perms.pamatdati} onBasics={onBasics} />
              {basics.clientOrder ? <span className="ap2-client-badge">Pasūtījums</span> : null}
              <VinCopy vin={basics.vin} className="ap2-dvin" />
            </div>
          </div>
          {onHome ? statusBtn("ap2-dstatus") : null}
        </div>
        <VinCopy vin={basics.vin} className="ap2-mvin" />
      </div>
      <nav className="ap2-tabs" style={{ ["--tabs" as string]: tabs.length }} aria-label="Sadaļas">
        {tabs.length > 1 || perms.vesture
          ? tabs.map((t) => (
              <button key={t} type="button" className={`ap2-tab ${tab === t ? "on" : ""}`} onClick={() => go(t)}>
                <span className="ap2-m">{CABINET_TAB_LABEL[t].m}</span>
                <span className="ap2-d">{CABINET_TAB_LABEL[t].d}</span>
              </button>
            ))
          : null}
        {perms.vesture ? (
          <button type="button" className={`ap2-tab ap2-tab-hist ${tab === "vesture" ? "on" : ""}`} onClick={() => go("vesture")}>
            Vēsture
          </button>
        ) : null}
      </nav>

      {/* Nils 27.10: statuss, pavadzīme un saites tikai Pamatdatos; pārējās cilnēs tikai pašas sadaļas saturs.
          Pamatdati pēc kabineta maketa (27.10): datorā pa kreisi Auto + Tehniskie dati, pa labi saites, CSDD, dzēšana. */}
      {onHome && tab !== "pamatdati" ? (
        <>
          {statusBtn("ap2-mstatus")}
          {statusErr ? <p className="ap2-err">{statusErr}</p> : null}
          {canWaybill ? <AutoparksV2Waybill car={{ title: basics.title, vin: basics.vin }} /> : null}
          <IrissSaitesPanel from="autoparks" id={basics.id} vehicle={basics.title} />
        </>
      ) : null}
      {tab === "pamatdati" ? (
        <div className="ap2-pd-layout">
          <div className="ap2-pd-top">
            {statusBtn("ap2-mstatus")}
            {statusErr ? <p className="ap2-err">{statusErr}</p> : null}
            {canWaybill ? <AutoparksV2Waybill car={{ title: basics.title, vin: basics.vin }} /> : null}
            <IrissSaitesPanel from="autoparks" id={basics.id} vehicle={basics.title} />
          </div>
          <div className="ap2-pd-main">
            <AutoparksV2Pamatdati basics={basics} onBasics={onBasics} />
          </div>
          <div className="ap2-pd-bottom">
            <AutoparksV2Csdd basics={basics} />
            {perms.admin ? <DeleteCarButton carId={basics.id} title={basics.title} /> : null}
          </div>
        </div>
      ) : null}
      {tab === "cela" && transit ? <AutoparksV2Cela transit={transit} canWrite={transitCanWrite} /> : null}
      {tab === "vesture" ? <AutoparksV2History carId={basics.id} /> : null}
      {pane ? pane({ carId: basics.id, perms, basics, onBasics }) : null}
      {canCreateOffer && tab === "cenu_lapa" ? <AutoparksV2OfferActions carId={basics.id} /> : null}

      {sheet ? <StatusSheet current={basics.status} onPick={setStatus} onClose={() => setSheet(false)} /> : null}
      {photoPicker ? (
        <AutoparksV2PhotoPicker
          carId={basics.id}
          onClose={() => setPhotoPicker(false)}
          onPicked={(b) => {
            onBasics(b);
            setPhotoVersion((v) => v + 1);
          }}
        />
      ) : null}
      {toast ? (
        <div className="ap2-toast" role="status">
          <span>
            <span className="cdn">{toast.left}</span>
            {AUTOPARKS_STATUS_LV[toast.status]}
          </span>
          <button type="button" onClick={() => void undo()}>
            Atsaukt
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatusSheet({ current, onPick, onClose }: { current: AutoparksStatus; onPick: (s: AutoparksStatus) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="ap2-dim" onClick={onClose} />
      <div className="ap2-sheet" ref={ref} role="dialog" aria-label="Statuss">
        <div className="ap2-grab" />
        <h4>Statuss</h4>
        {AUTOPARKS_V2_STATUS_ORDER.map((s) => (
          <button key={s} type="button" className={`ap2-opt st-${s} ${s === current ? "cur" : ""}`} onClick={() => onPick(s)}>
            {AUTOPARKS_STATUS_LV[s]}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Create => delete (LAW 26.10): auto dzēšana ar visu istabu (faili, piezīmes, tāme). Tikai administrators;
 * apstiprinājums pirms dzēšanas, jo to nevar atsaukt. API tā pati, ko lietoja vecais Autoparks (v1).
 */
export function DeleteCarButton({ carId, title }: { carId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function remove() {
    if (!window.confirm(`Dzēst "${title}" ar visiem failiem, piezīmēm un tāmi? To nevar atsaukt.`)) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/iriss-logistics/autoparks/${encodeURIComponent(carId)}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErr("Neizdevās dzēst auto.");
      return;
    }
    router.push(BASE);
    router.refresh();
  }
  return (
    <div className="ap2-delete">
      <button type="button" className="iriss-btn iriss-btn--danger-outline iriss-btn--sm" disabled={busy} onClick={() => void remove()}>
        {busy ? "Dzēš..." : "Dzēst auto"}
      </button>
      {err ? <p className="ap2-err">{err}</p> : null}
    </div>
  );
}

/**
 * Īpašnieks galvenes joslā (Nils 27.10): izcelts - Dzintarzeme oranžs, ĪRISS zaļš. Ar Pamatdatu tiesību - maināms.
 */
/** Pilni nosaukumi (Nils 27.10). */
export const OWNER_FULL_LV = { IRISS: "SIA IRISS", DZA: "SIA Dzintarzeme Auto" } as const;

export function OwnerBadge({ basics, canEdit, onBasics }: { basics: AutoparksV2Basics; canEdit: boolean; onBasics: (b: AutoparksV2Basics) => void }) {
  const [err, setErr] = useState(false);
  const cls = `ap2-owner-badge ${basics.owner === "DZA" ? "dza" : "iriss"}`;
  const label = OWNER_FULL_LV[basics.owner === "DZA" ? "DZA" : "IRISS"];
  const face = (
    <>
      <i aria-hidden className="dot" />
      <span>{label}</span>
    </>
  );
  if (!canEdit) return <span className={cls}>{face}</span>;
  async function change(next: string) {
    if (next === basics.owner) return;
    setErr(false);
    const res = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(basics.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: next }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { basics?: AutoparksV2Basics } | null;
    if (res?.ok && data?.basics) onBasics(data.basics);
    else setErr(true);
  }
  // Makets B (Nils 27.10): kontūra + krāsains punkts; izvēle ir neredzama virs žetona (atveras kā parasts saraksts).
  return (
    <label className={`${cls} edit`} title={err ? "Neizdevās saglabāt" : "Mainīt īpašnieku"}>
      {face}
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
      <select aria-label="Īpašnieks" value={basics.owner} onChange={(e) => void change(e.target.value)}>
        <option value="IRISS">{OWNER_FULL_LV.IRISS}</option>
        <option value="DZA">{OWNER_FULL_LV.DZA}</option>
      </select>
    </label>
  );
}
