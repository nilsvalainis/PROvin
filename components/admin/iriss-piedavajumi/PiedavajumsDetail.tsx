"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PdAuto1Blocks, PdToggles, type PdToggleTarget } from "@/components/iriss-piedavajumi/PdAuto1Blocks";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { PdStatusChip } from "@/components/iriss-piedavajumi/PdStatusChip";
import { copyText, irissPdAbsoluteLink, usePdRebase } from "@/components/admin/iriss-piedavajumi/pd-actions";
import { PdImportPanel } from "@/components/admin/iriss-piedavajumi/PdImportPanel";
import {
  buildIrissPdPublicView,
  canRebaseIrissPd,
  filterIrissPdClientOptions,
  irissPdAvailableActions,
  irissPdMargin,
  irissPdSendBlockers,
  isIrissPdEditable,
  photoKey,
  type IrissPdAction,
  type IrissPdClientOption,
  type IrissPdViewMode,
} from "@/lib/iriss-piedavajumi";
import { irissPdAuto1BlockCount } from "@/lib/iriss-piedavajumi-auto1";
import { IRISS_PD_ADAPTERS } from "@/lib/iriss-piedavajumi-sources";
import {
  IRISS_PD_BLOCK_IDS,
  IRISS_PD_SOURCE_LV,
  IRISS_PD_STATUS_LV,
  irissPdNumberLabel,
  type IrissPdClient,
  type IrissPdPhoto,
  type IrissPdVehicle,
  type IrissPdVisibility,
  type IrissPiedavajums,
} from "@/lib/iriss-piedavajumi-types";
import { formatOfferValidUntilLv } from "@/lib/iriss-offer-valid-until";

type Tab = "internal" | "auto1" | "client" | "history";

const MORE_FIELDS: Array<[keyof IrissPdVehicle, string]> = [
  ["firstRegistration", "Pirmā reģistrācija"],
  ["fuel", "Degviela"],
  ["transmission", "Ātrumkārba"],
  ["powerKw", "Jauda (kW)"],
  ["engine", "Tilpums"],
  ["color", "Krāsa"],
  ["body", "Virsbūve"],
];

function stamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(",", "");
}

type Draft = {
  vehicle: IrissPdVehicle;
  price: string;
  validUntil: string;
  client: IrissPdClient;
  purchasePrice: string;
  internalNotes: string;
  photos: IrissPdPhoto[];
  visibility: IrissPdVisibility;
};

function draftOf(r: IrissPiedavajums): Draft {
  return {
    vehicle: { ...r.vehicle },
    price: r.price,
    validUntil: r.validUntil,
    client: { ...r.client },
    purchasePrice: r.purchasePrice,
    internalNotes: r.internalNotes,
    photos: [...r.photos],
    visibility: JSON.parse(JSON.stringify(r.visibility)) as IrissPdVisibility,
  };
}

function ClientPicker({
  value,
  options,
  disabled,
  onChange,
}: {
  value: IrissPdClient;
  options: IrissPdClientOption[];
  disabled: boolean;
  onChange: (c: IrissPdClient) => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => filterIrissPdClientOptions(options, value.name), [options, value.name]);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          id="pd-client"
          value={value.name}
          disabled={disabled}
          placeholder="Izvēlies klientu vai ieraksti vārdu"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => onChange({ name: e.target.value, phone: value.orderId ? "" : value.phone, email: value.orderId ? "" : value.email, orderId: "" })}
        />
        {value.name && !disabled ? (
          <button type="button" className="pd-btn" aria-label="Noņemt klientu" onClick={() => onChange({ name: "", phone: "", email: "", orderId: "" })}>
            ×
          </button>
        ) : null}
      </div>
      {value.orderId ? <p className="pd-hint">Piesaistīts IRISS pasūtījumam - piedāvājums redzams arī tur.</p> : null}
      {open && !disabled && matches.length > 0 ? (
        <div className="pd-card" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: 38, padding: 4, maxHeight: 260, overflowY: "auto" }} role="listbox">
          {matches.map((o) => (
            <button
              type="button"
              key={o.orderId}
              className="pd-carrow"
              style={{ padding: "6px 8px" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ name: o.name, phone: o.phone, email: o.email, orderId: o.orderId });
                setOpen(false);
              }}
            >
              <span className="pd-el">{o.name}</span>
              <span className="pd-mu pd-el" style={{ fontSize: 11.5 }}>{o.sub}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PiedavajumsDetail({
  initial,
  nowMs,
  clientOptions,
  note,
}: {
  initial: IrissPiedavajums;
  nowMs: number;
  clientOptions: IrissPdClientOption[];
  note: string;
}) {
  const router = useRouter();
  const [rec, setRec] = useState(initial);
  const [d, setD] = useState<Draft>(() => draftOf(initial));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(note);
  const [tab, setTab] = useState<Tab>("internal");
  const [previewMode, setPreviewMode] = useState<IrissPdViewMode>("link");
  const [moreOpen, setMoreOpen] = useState(false);
  const { rebase, rebaseBusy, rebaseError } = usePdRebase();

  const editable = isIrissPdEditable(rec.status);
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(rec));
  const merged: IrissPiedavajums = { ...rec, ...d };
  const view = buildIrissPdPublicView({ ...merged, status: merged.status === "approved" ? "approved" : "sent" }, previewMode, nowMs);
  const actions = irissPdAvailableActions(rec.status);
  const blockers = irissPdSendBlockers(merged, Date.now());
  const label = irissPdNumberLabel(rec.number);
  const margin = irissPdMargin(d.price, d.purchasePrice);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setV = (k: keyof IrissPdVehicle, v: string) => setD((p) => ({ ...p, vehicle: { ...p.vehicle, [k]: v } }));

  function applyRecord(next: IrissPiedavajums) {
    setRec(next);
    setD(draftOf(next));
  }

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setBusy("save");
    setErr("");
    try {
      const patch: Record<string, unknown> = {};
      const base = draftOf(rec);
      for (const k of Object.keys(d) as Array<keyof Draft>) if (JSON.stringify(d[k]) !== JSON.stringify(base[k])) patch[k] = d[k];
      const res = await fetch(`/api/admin/iriss-piedavajumi/${rec.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās saglabāt.");
      applyRecord(data.record);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās saglabāt.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function act(action: IrissPdAction | "create-order") {
    if (action === "decline" && !window.confirm("Atzīmēt piedāvājumu kā noraidītu?")) return;
    if (action === "approve" && !window.confirm("Atzīmēt kā apstiprinātu? Tiks izveidots/rezervēts Pasūtījums.")) return;
    if (dirty && !(await save())) return;
    setBusy(action);
    setErr("");
    try {
      const res = await fetch(`/api/admin/iriss-piedavajumi/${rec.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās.");
      applyRecord(data.record);
      if (action === "send" && data.record.linkToken) {
        const ok = await copyText(irissPdAbsoluteLink(data.record.linkToken));
        setInfo(ok ? "Nosūtīts - klienta saite nokopēta. Ielīmē to e-pastā vai WhatsApp." : "Nosūtīts - klienta saite gatava (Kopēt klienta saiti).");
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās.");
    } finally {
      setBusy("");
    }
  }

  async function copyLink() {
    if (!rec.linkToken) return;
    const ok = await copyText(irissPdAbsoluteLink(rec.linkToken));
    setInfo(ok ? "Klienta saite nokopēta." : irissPdAbsoluteLink(rec.linkToken));
  }

  function toggle(target: PdToggleTarget, mode: "pdf" | "link") {
    setD((p) => {
      const v: IrissPdVisibility = JSON.parse(JSON.stringify(p.visibility)) as IrissPdVisibility;
      if (target === "group") v.group[mode] = !v.group[mode];
      else v.blocks[target][mode] = !v.blocks[target][mode];
      return { ...p, visibility: v };
    });
  }

  function movePhoto(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= d.photos.length) return;
    const next = [...d.photos];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set("photos", next);
  }

  const photoUrl = (p: IrissPdPhoto, size: "thumb" | "full") => {
    const i = rec.photos.findIndex((x) => photoKey(x) === photoKey(p));
    return `/api/admin/iriss-piedavajumi/${rec.id}/foto/${i}${size === "full" ? "?s=full" : ""}`;
  };
  const previewPhoto = (n: number, size: "thumb" | "full") => (d.photos[n] ? photoUrl(d.photos[n]!, size) : "");

  const sendBtn = actions.includes("send") ? (
    <button type="button" className="pd-btn" disabled={busy !== "" || blockers.length > 0} title={blockers.join(" ")} onClick={() => void act("send")}>
      Nosūtīt klientam
    </button>
  ) : null;

  const headerActions = (
    <div className="pd-acts">
      {rec.status === "sent" && rec.linkToken ? (
        <button type="button" className="pd-btn" onClick={() => void copyLink()}>
          Kopēt klienta saiti
        </button>
      ) : null}
      {sendBtn}
      {actions.includes("revert") ? (
        <button type="button" className="pd-btn" disabled={busy !== ""} onClick={() => void act("revert")}>
          Atsaukt uz melnrakstu
        </button>
      ) : null}
      {actions.includes("approve") ? (
        <button type="button" className="pd-btn" disabled={busy !== ""} onClick={() => void act("approve")}>
          Atzīmēt apstiprinātu
        </button>
      ) : null}
      {actions.includes("decline") ? (
        <button type="button" className="pd-btn bad" disabled={busy !== ""} onClick={() => void act("decline")}>
          Atzīmēt noraidītu
        </button>
      ) : null}
      {rec.status === "approved" && !rec.approvedOrderId ? (
        <button type="button" className="pd-btn" disabled={busy !== ""} onClick={() => void act("create-order")}>
          Izveidot pasūtījumu
        </button>
      ) : null}
      {canRebaseIrissPd(rec.status) ? (
        <button type="button" className="pd-btn p" disabled={rebaseBusy} onClick={() => void rebase(rec.id, router)}>
          Izveidot jaunu uz šī bāzes
        </button>
      ) : null}
      <Link className="pd-btn" href={`/admin/iriss/piedavajumi/${rec.id}/pdf`}>
        PDF
      </Link>
      <button type="button" className="pd-btn p" disabled={!dirty || busy !== ""} onClick={() => void save()}>
        {busy === "save" ? "Saglabā..." : "Saglabāt"}
      </button>
    </div>
  );

  const showImport = editable && (rec.status === "requested" || (!rec.vehicle.title && rec.source === "manual"));
  const adapter = rec.source !== "autoparks" && rec.source !== "manual" ? IRISS_PD_ADAPTERS[rec.source] : null;

  return (
    <div className="pdv">
      <header className="pd-hdr">
        <div className="pd-bc">
          <Link href="/admin/iriss">IRISS</Link> › <Link href="/admin/iriss/piedavajumi">Piedāvājumi</Link> › {label}
        </div>
        <div className="pd-top">
          <div style={{ minWidth: 0 }}>
            <h1 className="pd-el">{d.vehicle.title || "Piedāvājums"}</h1>
            <div className="pd-sub">
              Piedāvājums {label} · 1 auto = 1 piedāvājums · <PdStatusChip status={rec.status} />
            </div>
          </div>
          {headerActions}
        </div>
      </header>

      <div className="pd-seg pd-tabs" role="tablist">
        {(
          [
            ["internal", "Iekšējais"],
            ["auto1", "Auto1 dati"],
            ["client", "Klients"],
            ["history", "Vēsture"],
          ] as Array<[Tab, string]>
        )
          .filter(([t]) => t !== "auto1" || rec.auto1)
          .map(([t, l]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {l}
            </button>
          ))}
      </div>

      {err || rebaseError ? <p className="pd-err" role="alert">{err || rebaseError}</p> : null}
      {info ? <p className="pd-note" role="status">{info}</p> : null}
      {!editable ? (
        <p className="pd-note">
          Statuss «{IRISS_PD_STATUS_LV[rec.status]}» - lauki vairs nav labojami (izņemot iekšējās piezīmes).
          {canRebaseIrissPd(rec.status) ? " Izveido jaunu piedāvājumu uz šī bāzes." : ""}
        </p>
      ) : null}

      <div className="pd-detail">
        <div className="pd-col">
          {showImport ? (
            <div data-tab="internal" data-on={tab === "internal" ? "1" : "0"}>
              <PdImportPanel id={rec.id} onDone={applyRecord} />
            </div>
          ) : null}

          <section className="pd-card" data-tab="internal" data-on={tab === "internal" ? "1" : "0"}>
            <h3>Auto dati · auto-aizpildīti, rediģējami</h3>
            {d.photos.length > 0 ? (
              <div className="pd-gal">
                {d.photos.slice(0, 4).map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photoKey(p)} src={photoUrl(p, i === 0 ? "full" : "thumb")} alt={`Foto ${i + 1}`} />
                ))}
                {d.photos.length > 4 ? <div className="more">+{d.photos.length - 4} foto</div> : null}
              </div>
            ) : (
              <p className="pd-mu" style={{ fontSize: 12.5 }}>Foto nav (nav obligāti).</p>
            )}
            {editable && d.photos.length > 1 ? (
              <details style={{ marginBottom: 12 }}>
                <summary className="pd-lnk" style={{ cursor: "pointer" }}>Kārtot / noņemt foto ({d.photos.length})</summary>
                <div className="pd-photo-strip" style={{ marginTop: 8 }}>
                  {d.photos.map((p, i) => (
                    <div className="it" key={photoKey(p)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(p, "thumb")} alt={`Foto ${i + 1}`} loading="lazy" />
                      {i > 0 ? (
                        <button type="button" className="l" aria-label="Pārvietot pa kreisi" onClick={() => movePhoto(i, -1)}>
                          ‹
                        </button>
                      ) : null}
                      <button type="button" aria-label="Noņemt foto" onClick={() => set("photos", d.photos.filter((_, j) => j !== i))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p className="pd-hint">Pirmā bilde ir vāks.</p>
              </details>
            ) : null}
            <div className="pd-grid2">
              <div className="pd-fld">
                <label htmlFor="pd-title">Modelis</label>
                <input id="pd-title" value={d.vehicle.title} disabled={!editable} onChange={(e) => setV("title", e.target.value)} />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-vin">VIN</label>
                <input id="pd-vin" className="pd-mono" value={d.vehicle.vin} disabled={!editable} onChange={(e) => setV("vin", e.target.value.toUpperCase())} />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-year">Gads</label>
                <input id="pd-year" value={d.vehicle.year} disabled={!editable} onChange={(e) => setV("year", e.target.value)} />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-km">Nobraukums (km)</label>
                <input id="pd-km" value={d.vehicle.mileageKm} disabled={!editable} inputMode="numeric" onChange={(e) => setV("mileageKm", e.target.value)} />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-price">Gala cena klientam (€)</label>
                <input id="pd-price" value={d.price} disabled={!editable} inputMode="decimal" style={{ fontWeight: 600 }} onChange={(e) => set("price", e.target.value)} />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-valid">
                  Derīgs līdz <span className="pd-req">*</span>
                </label>
                <input
                  id="pd-valid"
                  type="date"
                  className="req-on"
                  value={d.validUntil}
                  disabled={!editable}
                  required
                  aria-required="true"
                  onChange={(e) => set("validUntil", e.target.value)}
                />
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-client">
                  Klients <span className="pd-mu">(neobligāts)</span>
                </label>
                <ClientPicker value={d.client} options={clientOptions} disabled={!editable} onChange={(c) => set("client", c)} />
              </div>
              <div className="pd-fld">
                <span className="lbl">Statuss</span>
                <div className="ro">
                  <PdStatusChip status={rec.status} />
                </div>
              </div>
            </div>
            {d.client.name && !d.client.orderId ? (
              <div className="pd-grid2">
                <div className="pd-fld">
                  <label htmlFor="pd-cphone">Klienta tālrunis</label>
                  <input id="pd-cphone" value={d.client.phone} disabled={!editable} onChange={(e) => set("client", { ...d.client, phone: e.target.value })} />
                </div>
                <div className="pd-fld">
                  <label htmlFor="pd-cemail">Klienta e-pasts</label>
                  <input id="pd-cemail" value={d.client.email} disabled={!editable} onChange={(e) => set("client", { ...d.client, email: e.target.value })} />
                </div>
              </div>
            ) : null}
            <button type="button" className="pd-lnk" style={{ border: 0, background: "none", padding: 0, marginBottom: 8 }} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
              {moreOpen ? "Mazāk lauku" : "Vairāk lauku (reģistrācija, degviela, jauda...)"}
            </button>
            {moreOpen ? (
              <div className="pd-grid2">
                {MORE_FIELDS.map(([k, l]) => (
                  <div className="pd-fld" key={k}>
                    <label htmlFor={`pd-${k}`}>{l}</label>
                    <input id={`pd-${k}`} value={d.vehicle[k]} disabled={!editable} onChange={(e) => setV(k, e.target.value)} />
                  </div>
                ))}
              </div>
            ) : null}
            <p className="pd-hint">* Termiņš obligāts nosūtīšanai, bez noklusējuma - ievada manuāli.</p>
            {editable && blockers.length && actions.includes("send") ? <p className="pd-hint">Lai nosūtītu: {blockers.join(" ")}</p> : null}
          </section>

          <section className="pd-zone zi" data-tab="internal" data-on={tab === "internal" ? "1" : "0"} aria-label="Iekšējais - klients neredz">
            <div className="pd-zt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Iekšējais - klients neredz
            </div>
            <div className="pd-grid2">
              <div className="pd-fld">
                <span className="lbl">Avots</span>
                <div className="ro">
                  <span className="pd-src">{IRISS_PD_SOURCE_LV[rec.source]}</span>
                  {rec.sourceUrl ? (
                    <a className="pd-el pd-lnk" href={rec.sourceUrl} target="_blank" rel="noreferrer noopener">
                      {rec.sourceUrl.replace(/^https:\/\/(www\.)?/, "")}
                    </a>
                  ) : rec.sourceRef ? (
                    <Link className="pd-lnk" href={`/admin/iriss/autoparks`}>
                      Autoparka auto
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="pd-fld">
                <label htmlFor="pd-purchase">Iepirkuma cena (€)</label>
                <input id="pd-purchase" value={d.purchasePrice} disabled={!editable} inputMode="decimal" onChange={(e) => set("purchasePrice", e.target.value)} />
              </div>
              <div className="pd-fld">
                <span className="lbl">Atpazīts</span>
                <div className="ro">
                  {rec.importedFieldCount > 0
                    ? `✓ ${IRISS_PD_SOURCE_LV[rec.source]} · ${rec.importedFieldCount} lauki aizpildīti`
                    : adapter?.mode === "stub"
                      ? adapter.stubNote
                      : "Aizpildīts ar roku"}
                </div>
              </div>
              <div className="pd-fld">
                <span className="lbl">Marža</span>
                <div className="ro">{margin || "-"}</div>
              </div>
            </div>
            <div className="pd-fld">
              <label htmlFor="pd-notes">Iekšējās piezīmes</label>
              <textarea id="pd-notes" value={d.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
            </div>
          </section>

          {rec.auto1 ? (
            <section className="pd-card" style={{ padding: 14 }} data-tab="auto1" data-on={tab === "auto1" ? "1" : "0"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <h3 className="pd-h3" style={{ margin: 0 }}>
                  Auto1 ielasītie dati <span className="pd-src">Auto1</span>
                  <span className="pd-mu" style={{ fontWeight: 400 }}>
                    · {IRISS_PD_BLOCK_IDS.filter((id) => irissPdAuto1BlockCount(rec.auto1, id) > 0).length} bloki · ielasīts {stamp(rec.auto1ImportedAt)}
                  </span>
                </h3>
                <span style={{ fontSize: 11.5 }}>
                  Visi: <PdToggles value={d.visibility.group} disabled={!editable} onToggle={editable ? (m) => toggle("group", m) : undefined} />
                </span>
              </div>
              <PdAuto1Blocks blocks={rec.auto1} visibility={d.visibility} onToggle={editable ? toggle : undefined} disabled={!editable} />
              <p className="pd-hint" style={{ marginTop: 8 }}>
                Noklusējums: visi bloki ieslēgti, «Bojājumu kopsavilkums» izslēgts. Grupas OFF izslēdz visus; bloka slēdzis darbojas tikai, ja grupa ON.
              </p>
            </section>
          ) : null}
        </div>

        <div className="pd-col">
          <section className="pd-zone zc" data-tab="client" data-on={tab === "client" ? "1" : "0"}>
            <div className="pd-zt" style={{ justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Klients redz - {previewMode === "pdf" ? "PDF" : "publiskā saite"}
              </span>
              <span className="pd-seg" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                <button type="button" className={previewMode === "link" ? "on" : ""} onClick={() => setPreviewMode("link")}>
                  Saite
                </button>
                <button type="button" className={previewMode === "pdf" ? "on" : ""} onClick={() => setPreviewMode("pdf")}>
                  PDF
                </button>
              </span>
            </div>
            <PdClientView view={view} mode={previewMode} photoSrc={previewPhoto} compact showHiddenNote>
              {previewMode === "link" ? (
                <button type="button" className="pd-btn p" style={{ width: "100%", marginTop: 8, height: 34 }} disabled>
                  Apstiprināt
                </button>
              ) : null}
            </PdClientView>
          </section>

          {rec.client.orderId || rec.approvedOrderId || rec.basedOnId ? (
            <section className="pd-card" data-tab="history" data-on={tab === "history" ? "1" : "0"}>
              <h3>Saistītie ieraksti</h3>
              {rec.approvedOrderId ? (
                <div className="pd-kv">
                  <span>Pasūtījums</span>
                  <Link className="pd-lnk" href={`/admin/iriss/pasutijumi/${rec.approvedOrderId}`}>
                    Rezervēts →
                  </Link>
                </div>
              ) : null}
              {rec.client.orderId && rec.client.orderId !== rec.approvedOrderId ? (
                <div className="pd-kv">
                  <span>Klienta pasūtījums</span>
                  <Link className="pd-lnk" href={`/admin/iriss/pasutijumi/${rec.client.orderId}`}>
                    Atvērt →
                  </Link>
                </div>
              ) : null}
              {rec.basedOnId ? (
                <div className="pd-kv">
                  <span>Veidots uz bāzes</span>
                  <Link className="pd-lnk" href={`/admin/iriss/piedavajumi/${rec.basedOnId}`}>
                    Iepriekšējais →
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="pd-card" data-tab="history" data-on={tab === "history" ? "1" : "0"}>
            <h3>Vēsture</h3>
            {rec.validUntil ? (
              <p className="pd-mu" style={{ fontSize: 12, margin: "0 0 10px" }}>Derīgs līdz {formatOfferValidUntilLv(rec.validUntil)}</p>
            ) : null}
            <div className="pd-tl">
              {[...rec.history].reverse().map((h, i) => (
                <div key={`${h.at}-${i}`}>
                  {h.text}
                  <small>
                    {h.by} · {stamp(h.at)}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="pd-bottom">
        {rec.status === "sent" && rec.linkToken ? (
          <button type="button" className="pd-btn" onClick={() => void copyLink()}>
            Kopēt saiti
          </button>
        ) : actions.includes("send") ? (
          <button type="button" className="pd-btn" disabled={busy !== "" || blockers.length > 0} onClick={() => void act("send")}>
            Nosūtīt
          </button>
        ) : canRebaseIrissPd(rec.status) ? (
          <button type="button" className="pd-btn" disabled={rebaseBusy} onClick={() => void rebase(rec.id, router)}>
            Jauns uz bāzes
          </button>
        ) : null}
        <button type="button" className="pd-btn p" disabled={!dirty || busy !== ""} onClick={() => void save()}>
          {busy === "save" ? "Saglabā..." : "Saglabāt"}
        </button>
      </div>
    </div>
  );
}
