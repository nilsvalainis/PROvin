"use client";

import Link from "next/link";
import { IrissCreateOfferButton } from "@/components/admin/IrissCreateOfferButton";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AUTOPARKS_STATUS_LV, type AutoparksStatus } from "@/lib/iriss-autoparks";
import { AUTOPARKS_V2_STATUS_ORDER, V2_STATUS_UNDO_CLIENT_MS, type AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import { AutoparksV2History } from "./AutoparksV2History";
import { AutoparksV2Pamatdati } from "./AutoparksV2Pamatdati";
import { AutoparksV2PhotoPicker } from "./AutoparksV2PhotoPicker";
import { CABINET_PANES } from "./panes";
import { CarImg, VinCopy, yearColor } from "./ui";

export type CabinetTab = "pamatdati" | "iegade" | "serviss" | "izdevumi" | "cenu_lapa" | "vesture";

/** Cilnes: telefonā īsi (vietas dēļ), datorā pilni nosaukumi (j17 10.1). */
const TAB_LABEL: Record<Exclude<CabinetTab, "vesture">, { m: string; d: string }> = {
  pamatdati: { m: "Pamatdati", d: "Pamatdati" },
  iegade: { m: "Iegāde", d: "Iegādes dokumenti" },
  serviss: { m: "Serviss", d: "Serviss" },
  izdevumi: { m: "Izdevumi", d: "Citi izdevumi" },
  cenu_lapa: { m: "Cenu lapa", d: "Cenu lapa" },
};

export type CabinetPaneProps = { carId: string; perms: AutoparksV2Perms; basics: AutoparksV2Basics; onBasics: (b: AutoparksV2Basics) => void };

/** Fāzēs pievienotās cilnes (F5a Iegāde, F6 Serviss, F7 Izdevumi + Cenu lapa). */
export type CabinetPanes = Partial<Record<Exclude<CabinetTab, "pamatdati" | "vesture">, (p: CabinetPaneProps) => ReactNode>>;

const BASE = "/admin/iriss/autoparks-v2";

export function allowedTabs(perms: AutoparksV2Perms, panes: CabinetPanes): Array<Exclude<CabinetTab, "vesture">> {
  const out: Array<Exclude<CabinetTab, "vesture">> = [];
  if (perms.pamatdati) out.push("pamatdati");
  if (perms.iegade && panes.iegade) out.push("iegade");
  if (perms.serviss && panes.serviss) out.push("serviss");
  if (perms.izdevumi && panes.izdevumi) out.push("izdevumi");
  if (perms.cenuLapa && panes.cenu_lapa) out.push("cenu_lapa");
  return out;
}

export function AutoparksV2Cabinet({
  initialBasics,
  perms,
  canCreateOffer = false,
}: {
  initialBasics: AutoparksV2Basics;
  perms: AutoparksV2Perms;
  canCreateOffer?: boolean;
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
  const tabs = allowedTabs(perms, panes);
  const want = params.get("t") as CabinetTab | null;
  const tab: CabinetTab = want === "vesture" && perms.vesture ? "vesture" : tabs.includes(want as never) ? (want as CabinetTab) : (tabs[0] ?? "pamatdati");
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

  const pane = tab === "vesture" ? null : tab === "pamatdati" ? null : panes[tab];

  return (
    <div className="ap2">
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
        <CarImg carId={basics.id} version={photoVersion} onEditPhoto={!compact && perms.pamatdati ? () => setPhotoPicker(true) : undefined} />
        <div className="nm">
          <b>{basics.title}</b>
          <div className="meta">
            <span>{yearColor(basics.year, basics.color)}</span>
            <span className={`ap2-owner ${basics.owner === "DZA" ? "dza" : ""}`}>{basics.owner === "DZA" ? "DZINTARZEME" : "ĪRISS"}</span>
            <VinCopy vin={basics.vin} className="ap2-dvin" />
          </div>
          <VinCopy vin={basics.vin} className="ap2-mvin" />
        </div>
        {statusBtn("ap2-dstatus")}
      </div>
      {statusBtn("ap2-mstatus")}
      {statusErr ? <p className="ap2-err">{statusErr}</p> : null}
      {canCreateOffer ? (
        <div style={{ margin: "10px 0", display: "grid" }}>
          <IrissCreateOfferButton from="autoparks" id={basics.id} className="ap2-btn dark" />
        </div>
      ) : null}

      <nav className="ap2-tabs" style={{ ["--tabs" as string]: tabs.length }} aria-label="Sadaļas">
        {tabs.length > 1 || perms.vesture
          ? tabs.map((t) => (
              <button key={t} type="button" className={`ap2-tab ${tab === t ? "on" : ""}`} onClick={() => go(t)}>
                <span className="ap2-m">{TAB_LABEL[t].m}</span>
                <span className="ap2-d">{TAB_LABEL[t].d}</span>
              </button>
            ))
          : null}
        {perms.vesture ? (
          <button type="button" className={`ap2-tab ap2-tab-hist ${tab === "vesture" ? "on" : ""}`} onClick={() => go("vesture")}>
            Vēsture
          </button>
        ) : null}
      </nav>

      {tab === "pamatdati" ? <AutoparksV2Pamatdati basics={basics} onBasics={onBasics} /> : null}
      {tab === "vesture" ? <AutoparksV2History carId={basics.id} /> : null}
      {pane ? pane({ carId: basics.id, perms, basics, onBasics }) : null}

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
