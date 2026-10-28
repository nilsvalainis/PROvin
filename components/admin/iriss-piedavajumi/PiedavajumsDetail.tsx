"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PdPhotoSorter } from "./PdPhotoSorter";
import { PdAuto1Blocks, PdToggles, type PdToggleTarget } from "@/components/iriss-piedavajumi/PdAuto1Blocks";
import { PdStatusChip } from "@/components/iriss-piedavajumi/PdStatusChip";
import { copyText, deleteIrissPdRequest, irissPdAbsoluteLink, usePdRebase } from "@/components/admin/iriss-piedavajumi/pd-actions";
import { PdImportPanel } from "@/components/admin/iriss-piedavajumi/PdImportPanel";
import {
  canRebaseIrissPd,
  irissPdDeleteConfirm,
  filterIrissPdClientOptions,
  formatIrissPdPrice,
  irissPdAvailableActions,
  irissPdEurDigits,
  irissPdMargin,
  irissPdTotalFromParts,
  irissPdSendBlockers,
  isIrissPdEditable,
  photoKey,
  type IrissPdAction,
  type IrissPdClientOption,
} from "@/lib/iriss-piedavajumi";
import { irissPdAuto1Brief } from "@/lib/iriss-piedavajumi-auto1";
import { IRISS_PD_ADAPTERS } from "@/lib/iriss-piedavajumi-sources";
import { irissPdSourceRefHref } from "@/lib/iriss-pd-entry";
import {
  IRISS_PD_EXCLUDED_TEMPLATE,
  IRISS_PD_FACTS_TEMPLATE,
  IRISS_PD_INCLUDED_TEMPLATE,
  IRISS_PD_MAX_CHECK_ITEMS,
  IRISS_PD_MAX_HIGHLIGHTS,
  IRISS_PD_SOURCE_LV,
  IRISS_PD_STATUS_LV,
  IRISS_PD_VAT_LV,
  IRISS_PD_VAT_MODES,
  type IrissPdVatMode,
  irissPdNumberLabel,
  irissPdPublicPath,
  type IrissPdCheckItem,
  type IrissPdClient,
  type IrissPdContent,
  type IrissPdPhoto,
  type IrissPdVehicle,
  type IrissPdVisibility,
  type IrissPiedavajums,
} from "@/lib/iriss-piedavajumi-types";
import { formatOfferValidUntilLv } from "@/lib/iriss-offer-valid-until";

/**
 * j75: Piedāvājuma redaktors pēc maketa 01-redaktors (26.10). Viena kolonna, bez cilnēm, modāļiem un akordeoniem:
 * Header -> Foto -> Pamatdati -> Aprīkojuma izcēlumi -> Kopsavilkums -> Novērtējums klientam -> Auto1 dati -> Cenas.
 * Teksti ir vienkārši (bez formatēšanas rīkjoslas). Galvene nav sticky.
 */

const PRIMARY_FIELDS: Array<[keyof IrissPdVehicle, string, string?]> = [
  ["vin", "VIN"],
  ["year", "Gads"],
  ["mileageKm", "Nobraukums", "km"],
  ["fuel", "Degviela"],
  ["transmission", "Ātrumkārba"],
  ["body", "Virsbūve"],
  ["location", "Atrašanās vieta"],
];

const MORE_FIELDS: Array<[keyof IrissPdVehicle, string]> = [
  ["firstRegistration", "Pirmā reģistrācija"],
  ["powerKw", "Jauda (kW)"],
  ["engine", "Tilpums"],
  ["color", "Krāsa"],
];

function stamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", { timeZone: "Europe/Riga", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(",", "");
}

export type Draft = {
  vehicle: IrissPdVehicle;
  price: string;
  validUntil: string;
  client: IrissPdClient;
  purchasePrice: string;
  logisticsCost: string;
  prepCost: string;
  commission: string;
  vatMode: IrissPdVatMode;
  internalNotes: string;
  photos: IrissPdPhoto[];
  visibility: IrissPdVisibility;
  content: IrissPdContent;
};

/** Lauki, kas mainīti pēc nosūtīšanas, paliek; pārējie ņem servera vērtību. */
export function irissPdRebaseDraft(cur: Draft, sent: Draft, server: Draft): Draft {
  const out = { ...server };
  for (const k of Object.keys(cur) as Array<keyof Draft>) {
    if (JSON.stringify(cur[k]) !== JSON.stringify(sent[k])) (out as Record<string, unknown>)[k] = cur[k];
  }
  return out;
}

function draftOf(r: IrissPiedavajums): Draft {
  return {
    vehicle: { ...r.vehicle },
    price: r.price,
    validUntil: r.validUntil,
    client: { ...r.client },
    purchasePrice: r.purchasePrice,
    logisticsCost: r.logisticsCost,
    prepCost: r.prepCost,
    commission: r.commission,
    vatMode: r.vatMode,
    internalNotes: r.internalNotes,
    photos: [...r.photos],
    visibility: JSON.parse(JSON.stringify(r.visibility)) as IrissPdVisibility,
    content: JSON.parse(JSON.stringify(r.content)) as IrissPdContent,
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
  // Ieteikumi ir saraksts zem lauka lapas plūsmā (nevis pārklājums).
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          id="pd-client"
          value={value.name}
          disabled={disabled}
          placeholder="Izvēlies vai ieraksti"
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
      {open && !disabled && matches.length > 0 ? (
        <div className="pde-sugg" role="listbox">
          {matches.map((o) => (
            <button
              type="button"
              key={o.orderId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ name: o.name, phone: o.phone, email: o.email, orderId: o.orderId });
                setOpen(false);
              }}
            >
              <span className="pd-el">{o.name}</span>
              <span className="pd-mu pd-el">{o.sub}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Cenu lauka rādījums «18 400» (bez €, jo € ir aiz lauka). */
function eurGrouped(v: string): string {
  return v.trim() ? formatIrissPdPrice(v).replace(/\s*€$/, "") : "";
}

function Card({ title, sub, on, onToggle, disabled, id, children }: { title: string; sub: string; on?: boolean; onToggle?: () => void; disabled?: boolean; id?: string; children: ReactNode }) {
  return (
    <section className="pde-card" id={id} aria-label={title}>
      <div className="pde-ch">
        <h3>
          {title}
          <small>{sub}</small>
        </h3>
        {typeof on === "boolean" ? (
          <button type="button" role="switch" aria-checked={on} aria-label={`${title}: rāda klientam`} className="pde-sw" disabled={disabled} onClick={onToggle} />
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Check({ item, disabled, removable, onToggle, onRemove }: { item: IrissPdCheckItem; disabled: boolean; removable: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="pde-cb">
      <label>
        <input type="checkbox" checked={item.on} disabled={disabled} onChange={onToggle} />
        <span>{item.text}</span>
      </label>
      {removable && !disabled ? (
        <button type="button" className="x" aria-label={`Noņemt «${item.text}»`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  );
}

/** «+ pievienot ...»: saite, kas lapā pārvēršas par ievades lauku (Enter - pievieno, Esc - atceļ). */
function AddInline({ label, chip = false, disabled, onAdd }: { label: string; chip?: boolean; disabled: boolean; onAdd: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  if (disabled) return null;
  if (!editing) {
    return (
      <button type="button" className={chip ? "pde-add" : "pde-lnk"} onClick={() => setEditing(true)}>
        + {label}
      </button>
    );
  }
  const commit = () => {
    const t = val.replace(/\s+/g, " ").trim();
    if (t) onAdd(t);
    setVal("");
    setEditing(false);
  };
  return (
    <input
      className="pde-addin"
      autoFocus
      value={val}
      maxLength={120}
      placeholder={label}
      aria-label={label}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setVal("");
          setEditing(false);
        }
      }}
    />
  );
}

function addItem(list: IrissPdCheckItem[], text: string): IrissPdCheckItem[] {
  if (list.length >= IRISS_PD_MAX_CHECK_ITEMS || list.some((x) => x.text.toLowerCase() === text.toLowerCase())) return list;
  return [...list, { text, on: true }];
}

const isTemplate = (tpl: readonly IrissPdCheckItem[], text: string) => tpl.some((x) => x.text === text);

export function PiedavajumsDetail({
  initial,
  clientOptions,
  note,
}: {
  initial: IrissPiedavajums;
  clientOptions: IrissPdClientOption[];
  note: string;
}) {
  const router = useRouter();
  const [rec, setRec] = useState(initial);
  const [d, setD] = useState<Draft>(() => draftOf(initial));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(note);
  const { rebase, rebaseBusy, rebaseError } = usePdRebase();

  const editable = isIrissPdEditable(rec.status);
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(rec));
  const merged: IrissPiedavajums = { ...rec, ...d };
  const actions = irissPdAvailableActions(rec.status);
  const blockers = irissPdSendBlockers(merged, Date.now());
  const label = irissPdNumberLabel(rec.number);
  const margin = irissPdMargin(d.price, d.purchasePrice, d.logisticsCost, d.prepCost);
  const brief = useMemo(() => irissPdAuto1Brief(rec.auto1), [rec.auto1]);
  const c = d.content;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setV = (k: keyof IrissPdVehicle, v: string) => setD((p) => ({ ...p, vehicle: { ...p.vehicle, [k]: v } }));
  const setC = (patch: Partial<IrissPdContent>) => setD((p) => ({ ...p, content: { ...p.content, ...patch } }));
  /** Cenu bloks (Nils 27.10): tikai cipari; Klientam kopā = daļu summa, ja kāda daļa ievadīta. */
  type PricePart = "purchasePrice" | "logisticsCost" | "prepCost" | "commission";
  const setPart = (k: PricePart, raw: string) =>
    setD((p) => {
      const next = { ...p, [k]: irissPdEurDigits(raw) };
      const total = irissPdTotalFromParts(next.purchasePrice, next.logisticsCost, next.prepCost, next.commission);
      return total > 0 ? { ...next, price: String(total) } : next;
    });
  const partsTotal = irissPdTotalFromParts(d.purchasePrice, d.logisticsCost, d.prepCost, d.commission);

  function applyRecord(next: IrissPiedavajums, sent?: Draft) {
    setRec(next);
    if (!sent) {
      setD(draftOf(next));
      return;
    }
    // Saglabāšanas laikā ievadītais netiek pārrakstīts ar servera atbildi.
    setD((cur) => irissPdRebaseDraft(cur, sent, draftOf(next)));
  }

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setBusy("save");
    setErr("");
    try {
      const patch: Record<string, unknown> = {};
      const base = draftOf(rec);
      const sent = d;
      for (const k of Object.keys(d) as Array<keyof Draft>) if (JSON.stringify(d[k]) !== JSON.stringify(base[k])) patch[k] = d[k];
      const res = await fetch(`/api/admin/iriss-piedavajumi/${rec.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās saglabāt.");
      applyRecord(data.record, sent);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās saglabāt.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function act(action: IrissPdAction | "create-order" | "fill-from-stock") {
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
        setInfo(ok ? "Nosūtīts - klienta saite nokopēta. Ielīmē to e-pastā vai WhatsApp." : "Nosūtīts - klienta saite gatava (Kopēt saiti).");
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

  async function remove() {
    if (!window.confirm(irissPdDeleteConfirm(label))) return;
    setBusy("delete");
    setErr("");
    try {
      await deleteIrissPdRequest(rec.id);
      router.push("/admin/iriss/piedavajumi");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās dzēst.");
      setBusy("");
    }
  }

  function toggle(target: PdToggleTarget, mode: "pdf" | "link") {
    setD((p) => {
      const v: IrissPdVisibility = JSON.parse(JSON.stringify(p.visibility)) as IrissPdVisibility;
      if (target === "group") v.group[mode] = !v.group[mode];
      else v.blocks[target][mode] = !v.blocks[target][mode];
      return { ...p, visibility: v };
    });
  }

  const photoUrl = (p: IrissPdPhoto) => `/api/admin/iriss-piedavajumi/${rec.id}/foto/${rec.photos.findIndex((x) => photoKey(x) === photoKey(p))}`;

  const showImport = editable && (rec.status === "requested" || (!rec.vehicle.title && rec.source === "manual"));
  const adapter = rec.source !== "autoparks" && rec.source !== "logistics" && rec.source !== "manual" ? IRISS_PD_ADAPTERS[rec.source] : null;
  const shownPrice = formatIrissPdPrice(d.price);
  const saveLabel = busy === "save" ? "Saglabā..." : "Saglabāt";

  const checkList = (key: "included" | "excluded" | "facts", tpl: readonly IrissPdCheckItem[]) =>
    c[key].map((it, i) => (
      <Check
        key={it.text}
        item={it}
        disabled={!editable}
        removable={!isTemplate(tpl, it.text)}
        onToggle={() => setC({ [key]: c[key].map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })}
        onRemove={() => setC({ [key]: c[key].filter((_, j) => j !== i) })}
      />
    ));

  return (
    <div className="pdv pde">
      <header className="pd-hdr">
        <div className="pd-bc">
          <Link href="/admin/iriss">IRISS</Link> › <Link href="/admin/iriss/piedavajumi">Piedāvājumi</Link> › {label}
        </div>
        <div className="pd-top">
          <div style={{ minWidth: 0 }}>
            <h1 className="pd-el">{d.vehicle.title || "Piedāvājums"}</h1>
            <div className="pd-sub">
              {d.client.name ? <span className="pd-chip pde-cl">{d.client.name}</span> : null}
              <PdStatusChip status={rec.status} />
              {d.validUntil ? <span>Termiņš {formatOfferValidUntilLv(d.validUntil)}</span> : null}
              {shownPrice ? <b>{shownPrice}</b> : null}
            </div>
          </div>
          <div className="pd-acts">
            {rec.linkToken && (rec.status === "sent" || rec.status === "approved") ? (
              <button type="button" className="pd-btn" onClick={() => void copyLink()}>
                Kopēt saiti
              </button>
            ) : actions.includes("send") ? (
              <button type="button" className="pd-btn" disabled={busy !== "" || blockers.length > 0} title={blockers.join(" ")} onClick={() => void act("send")}>
                Nosūtīt un kopēt saiti
              </button>
            ) : null}
            <button type="button" className="pd-btn bad" disabled={busy !== ""} onClick={() => void remove()}>
              {busy === "delete" ? "Dzēš..." : "Dzēst"}
            </button>
            <button type="button" className="pd-btn p" disabled={!dirty || busy !== ""} onClick={() => void save()}>
              {saveLabel}
            </button>
          </div>
        </div>
      </header>

      <div className="pde-body">
        {err || rebaseError ? <p className="pd-err" role="alert">{err || rebaseError}</p> : null}
        {info ? <p className="pd-note" role="status">{info}</p> : null}
        {!editable ? (
          <p className="pd-note">
            Statuss «{IRISS_PD_STATUS_LV[rec.status]}» - lauki vairs nav labojami (izņemot iekšējās piezīmes).
            {canRebaseIrissPd(rec.status) ? " Izveido jaunu piedāvājumu uz šī bāzes." : ""}
          </p>
        ) : null}
        {editable && blockers.length && actions.includes("send") ? <p className="pd-hint">Lai nosūtītu: {blockers.join(" ")}</p> : null}

        {showImport ? <PdImportPanel id={rec.id} onDone={applyRecord} /> : null}

        <Card title="Foto" sub={d.photos.length ? `${d.photos.length} foto · velc, lai mainītu secību · pirmā ir vāks · klikšķis atver lielā izmērā` : "Foto nav (nav obligāti)"}>
          <PdPhotoSorter photos={d.photos} editable={editable} urlOf={photoUrl} keyOf={photoKey} onChange={(next) => set("photos", next)} />
        </Card>

        <Card title="Pamatdati" sub={rec.auto1 ? "Ielasīts no Auto1 · labojams" : "Labojams"}>
          {editable && rec.sourceRef.startsWith("autoparks:") ? (
            <button type="button" className="pd-btn" style={{ marginBottom: 12 }} disabled={busy !== ""} onClick={() => void act("fill-from-stock")}>
              {busy === "fill-from-stock" ? "Ielasa..." : "Papildināt tukšos laukus no Autoparka"}
            </button>
          ) : null}
          <div className="pde-grid">
            {PRIMARY_FIELDS.map(([k, l, ph]) => (
              <div className="pd-fld" key={k}>
                <label htmlFor={`pd-${k}`}>{l}</label>
                <input
                  id={`pd-${k}`}
                  className={k === "vin" ? "pd-mono" : undefined}
                  value={d.vehicle[k]}
                  placeholder={ph}
                  inputMode={k === "mileageKm" || k === "year" ? "numeric" : undefined}
                  disabled={!editable}
                  onChange={(e) => setV(k, k === "vin" ? e.target.value.toUpperCase() : e.target.value)}
                />
              </div>
            ))}
            <div className="pd-fld">
              <label htmlFor="pd-price">Cena klientam</label>
              <input
                id="pd-price"
                value={partsTotal > 0 ? formatIrissPdPrice(d.price) : d.price}
                placeholder="€"
                disabled={!editable || partsTotal > 0}
                title={partsTotal > 0 ? "Aprēķināta cenu blokā" : undefined}
                inputMode="numeric"
                onChange={(e) => set("price", irissPdEurDigits(e.target.value))}
              />
            </div>
            <div className="pd-fld w2">
              <label htmlFor="pd-title">Modelis</label>
              <input id="pd-title" value={d.vehicle.title} disabled={!editable} onChange={(e) => setV("title", e.target.value)} />
            </div>
            <div className="pd-fld">
              <label htmlFor="pd-client">Klients</label>
              <ClientPicker value={d.client} options={clientOptions} disabled={!editable} onChange={(cl) => set("client", cl)} />
            </div>
            <div className="pd-fld">
              <label htmlFor="pd-valid">
                Termiņš <span className="pd-req">*</span>
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
            {d.client.name && !d.client.orderId ? (
              <>
                <div className="pd-fld w2">
                  <label htmlFor="pd-cphone">Klienta tālrunis</label>
                  <input id="pd-cphone" value={d.client.phone} disabled={!editable} onChange={(e) => set("client", { ...d.client, phone: e.target.value })} />
                </div>
                <div className="pd-fld w2">
                  <label htmlFor="pd-cemail">Klienta e-pasts</label>
                  <input id="pd-cemail" value={d.client.email} disabled={!editable} onChange={(e) => set("client", { ...d.client, email: e.target.value })} />
                </div>
              </>
            ) : null}
            {MORE_FIELDS.map(([k, l]) => (
              <div className="pd-fld" key={k}>
                <label htmlFor={`pd-${k}`}>{l}</label>
                <input id={`pd-${k}`} value={d.vehicle[k]} disabled={!editable} onChange={(e) => setV(k, e.target.value)} />
              </div>
            ))}
          </div>
          {d.client.orderId ? <p className="pd-hint">Klients piesaistīts IRISS pasūtījumam - piedāvājums redzams arī tur.</p> : null}
        </Card>

        <Card
          title="Aprīkojuma izcēlumi"
          sub={c.highlightsOn ? "Rāda klientam · max ~8" : "Paslēpts klientam"}
          on={c.highlightsOn}
          disabled={!editable}
          onToggle={() => setC({ highlightsOn: !c.highlightsOn })}
        >
          <div className="pde-tags">
            {c.highlights.map((h, i) => (
              <span className="tag" key={h}>
                {h}
                {editable ? (
                  <button type="button" aria-label={`Noņemt «${h}»`} onClick={() => setC({ highlights: c.highlights.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            <AddInline
              label="pievienot"
              chip
              disabled={!editable || c.highlights.length >= IRISS_PD_MAX_HIGHLIGHTS}
              onAdd={(t) => {
                if (!c.highlights.some((x) => x.toLowerCase() === t.toLowerCase())) setC({ highlights: [...c.highlights, t.slice(0, 80)] });
              }}
            />
          </div>
        </Card>

        <Card
          title="Kopsavilkums"
          sub={c.summaryOn ? "Rāda klientam · gatavi šabloni, ķeksē vajadzīgo" : "Paslēpts klientam"}
          on={c.summaryOn}
          disabled={!editable}
          onToggle={() => setC({ summaryOn: !c.summaryOn })}
        >
          <div className="pde-2c">
            <div className="pde-col">
              <h4 className="ok">✓ Cenā iekļauts</h4>
              {checkList("included", IRISS_PD_INCLUDED_TEMPLATE)}
              <AddInline label="pievienot rindu" disabled={!editable} onAdd={(t) => setC({ included: addItem(c.included, t) })} />
            </div>
            <div className="pde-col">
              <h4 className="no">✕ Cenā nav iekļauts</h4>
              {checkList("excluded", IRISS_PD_EXCLUDED_TEMPLATE)}
              <AddInline label="pievienot rindu" disabled={!editable} onAdd={(t) => setC({ excluded: addItem(c.excluded, t) })} />
            </div>
          </div>
        </Card>

        <Card
          title="Novērtējums klientam"
          sub={c.assessmentOn ? "Rāda klientam · viss vienā kartītē" : "Paslēpts klientam"}
          on={c.assessmentOn}
          disabled={!editable}
          onToggle={() => setC({ assessmentOn: !c.assessmentOn })}
        >
          <div className="pde-facts">{checkList("facts", IRISS_PD_FACTS_TEMPLATE)}</div>
          <AddInline label="pievienot faktu" disabled={!editable} onAdd={(t) => setC({ facts: addItem(c.facts, t) })} />
          <div className="pde-2c" style={{ marginTop: 12 }}>
            <div className="pd-fld">
              <label htmlFor="pd-visual">Vizuālais</label>
              <textarea
                id="pd-visual"
                value={c.visual}
                disabled={!editable}
                placeholder="Buktes, skrāpējumi, pārkrāsotās detaļas..."
                onChange={(e) => setC({ visual: e.target.value })}
              />
            </div>
            <div className="pd-fld">
              <label htmlFor="pd-technical">Tehniskais</label>
              <textarea
                id="pd-technical"
                value={c.technical}
                disabled={!editable}
                placeholder="Kļūdas, servisa vajadzības..."
                onChange={(e) => setC({ technical: e.target.value })}
              />
            </div>
          </div>
          <div className="pd-fld">
            <label htmlFor="pd-note">Papildu piezīme</label>
            <textarea
              id="pd-note"
              value={c.note}
              disabled={!editable}
              placeholder="Ko nav ielasījis Auto1 u.c. avoti - piem., klienta jautājumi, papildu pārbaudes..."
              onChange={(e) => setC({ note: e.target.value })}
            />
          </div>
          <p className="pd-hint">Vienkāršs teksts - bez formatēšanas rīkjoslas.</p>
        </Card>

        {rec.auto1 ? (
          <Card title="Auto1 dati" sub={`Ielasīts ${stamp(rec.auto1ImportedAt).slice(0, 5) || "-"} · īsi`}>
            {brief.car.length || brief.damage.length ? (
              <div className="pde-2c pde-kvs">
                <div>
                  {brief.car.map((r) => (
                    <div className="pde-kv" key={r.label}>
                      <span>{r.label}</span>
                      <b>{r.value}</b>
                    </div>
                  ))}
                </div>
                <div>
                  {brief.damage.map((r) => (
                    <div className="pde-kv" key={r.label}>
                      <span>{r.label}</span>
                      <b>{r.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="pd-hint">Īsajā skatā nav ko rādīt.</p>
            )}
            <a className="pde-lnk" href="#pd-auto1-full">
              Rādīt pilnu Auto1 atskaiti ↓
            </a>
          </Card>
        ) : null}

        <Card title="Cena klientam" sub="Klients redz tikai kopsummu un PVN režīmu">
          <div className="pd-vat" role="group" aria-label="PVN">
            {IRISS_PD_VAT_MODES.map((m) => (
              <button key={m} type="button" className="pd-vat-chip" aria-pressed={d.vatMode === m} disabled={!editable} onClick={() => set("vatMode", m)}>
                {IRISS_PD_VAT_LV[m]}
              </button>
            ))}
          </div>
          <div className="pd-pr">
            {(
              [
                ["purchasePrice", "Auto cena (izsole)"],
                ["logisticsCost", "Piegāde līdz Rīgai"],
                ["prepCost", "Sagatavošana"],
                ["commission", "IRISS komisija"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="pd-pr-row">
                <span>{label}</span>
                <span className="pd-pr-in">
                  <input value={eurGrouped(d[k])} placeholder="0" disabled={!editable} inputMode="numeric" onChange={(e) => setPart(k, e.target.value)} />
                  <i aria-hidden>€</i>
                </span>
              </label>
            ))}
          </div>
          <div className="pd-pr-total">
            <span>Klientam kopā</span>
            {partsTotal > 0 ? (
              <b>{formatIrissPdPrice(d.price)}</b>
            ) : (
              <span className="pd-pr-in">
                <input aria-label="Klientam kopā" value={eurGrouped(d.price)} placeholder="0" disabled={!editable} inputMode="numeric" onChange={(e) => set("price", irissPdEurDigits(e.target.value))} />
                <i aria-hidden>€</i>
              </span>
            )}
          </div>
          <p className="pd-hint">Tikai cipari. Kopsumma = visu rindu summa; ja rindas tukšas, kopsummu ievadi pats.</p>
          <div className="pde-grid" style={{ marginTop: 12 }}>
            <div className="pd-fld">
              <span className="lbl">Marža (iekšēji)</span>
              <div className="ro">{margin || "-"}</div>
            </div>
            <div className="pd-fld w3">
              <span className="lbl">Avots</span>
              <div className="ro">
                <span className="pd-src">{IRISS_PD_SOURCE_LV[rec.source]}</span>
                {rec.sourceUrl ? (
                  <a className="pd-el pd-lnk" href={rec.sourceUrl} target="_blank" rel="noreferrer noopener">
                    {rec.sourceUrl.replace(/^https:\/\/(www\.)?/, "")}
                  </a>
                ) : rec.sourceRef ? (
                  <Link className="pd-lnk" href={irissPdSourceRefHref(rec.sourceRef)}>
                    {rec.source === "logistics" ? "Loģistikas auto" : "Autoparka auto"}
                  </Link>
                ) : null}
                <span className="pd-mu pd-el">
                  {rec.importedFieldCount > 0
                    ? `· ${rec.importedFieldCount} lauki aizpildīti`
                    : adapter?.mode === "stub"
                      ? `· ${adapter.stubNote}`
                      : "· aizpildīts ar roku"}
                </span>
              </div>
            </div>
          </div>
          <div className="pd-fld">
            <label htmlFor="pd-notes">Iekšējās piezīmes</label>
            <textarea id="pd-notes" value={d.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </div>
        </Card>

        {rec.auto1 ? (
          <Card id="pd-auto1-full" title="Auto1 pilnā atskaite" sub={`Ielasīts ${stamp(rec.auto1ImportedAt)} · klientam rāda ieslēgtos blokus`}>
            <div className="pde-vis">
              Visi bloki: <PdToggles value={d.visibility.group} disabled={!editable} onToggle={editable ? (m) => toggle("group", m) : undefined} />
            </div>
            <PdAuto1Blocks blocks={rec.auto1} visibility={d.visibility} onToggle={editable ? toggle : undefined} disabled={!editable} />
            <p className="pd-hint" style={{ marginTop: 8 }}>
              Noklusējums: visi bloki ieslēgti, «Bojājumu kopsavilkums» izslēgts. Grupas OFF izslēdz visus; bloka slēdzis darbojas tikai, ja grupa ON.
            </p>
          </Card>
        ) : null}

        <Card title="Statuss un vēsture" sub="Klienta lēmums, PDF un saistītie ieraksti">
          <div className="pd-acts" style={{ marginBottom: 12 }}>
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
            {rec.linkToken && (rec.status === "sent" || rec.status === "approved") ? (
              <a className="pd-btn" href={irissPdPublicPath(rec.linkToken)} target="_blank" rel="noreferrer">
                Klienta skats
              </a>
            ) : null}
          </div>
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
          <div className="pd-tl" style={{ marginTop: 10 }}>
            {[...rec.history].reverse().map((h, i) => (
              <div key={`${h.at}-${i}`}>
                {h.text}
                <small>
                  {h.by} · {stamp(h.at)}
                </small>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
