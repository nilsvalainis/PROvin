"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtCm3, fmtDateLv, fmtDayMonth, fmtEur, fmtKw, lapasLv, parseEurInput } from "@/lib/iriss-autoparks-v2-format";
import { problemsDone, type V2ServissFile, type V2ServissInvoiceView, type V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";
import type { V2Problem } from "@/lib/iriss-autoparks-v2";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { FileModal, PdfIcon } from "./FileModal";
import { Scanner, type ScannerTarget } from "./Scanner";
import { VinCopy } from "./ui";

type Step = 1 | 2 | 3 | 4 | 5;

/** Serviss (T3-T5, T7): tehniskā josla + 5 posmi. Galvenā poga - "Skenēt". */
export function AutoparksV2Serviss({ carId, basics, perms }: CabinetPaneProps) {
  const [view, setView] = useState<V2ServissView | null>(null);
  const [open, setOpen] = useState<Step | 0 | null>(null);
  const [scan, setScan] = useState<ScannerTarget | null>(null);
  const [modal, setModal] = useState<{ files: V2ServissFile[]; index: number } | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/serviss/${encodeURIComponent(carId)}`;

  const load = useCallback(async () => {
    const r = await fetch(api).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { serviss?: V2ServissView } | null;
    if (d?.serviss) setView(d.serviss);
    else setError("Neizdevās ielādēt");
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setError("");
    const r = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { serviss?: V2ServissView } | null;
    if (r?.ok && d?.serviss) setView(d.serviss);
    else setError("Neizdevās saglabāt");
  }

  const urlFor = useCallback((f: { id: string }) => `${api}/faili/${encodeURIComponent(f.id)}`, [api]);
  if (!view) return error ? <p className="ap2-err">{error}</p> : null;

  const pd = problemsDone(view.problems);
  const done: Record<Step, boolean> = {
    1: view.numberCheck.files.length > 0,
    2: view.diag.files.length > 0,
    3: pd.total > 0 && pd.done === pd.total,
    4: false,
    5: false,
  };
  const current: Step = !done[1] ? 1 : !done[2] ? 2 : !done[3] ? 3 : 5;
  const shown = open ?? current;
  const toggle = (s: Step) => setOpen(shown === s ? 0 : s);

  const inv = invoice ? view.invoices.find((i) => i.id === invoice) : null;
  if (inv) {
    return (
      <InvoicePage
        view={view}
        inv={inv}
        onBack={() => setInvoice(null)}
        onOpenFiles={(i) => setModal({ files: inv.files, index: i })}
        onAddPage={() => setScan({ target: "invoice_page", invoiceId: inv.id, title: "Servisa rēķins" })}
        onAmount={(v) => void patch({ invoice: { id: inv.id, amountEur: v } })}
        onPick={(id) => setInvoice(id)}
        modal={modal ? <FileModal files={modal.files} index={modal.index} urlFor={urlFor} onIndex={(i) => setModal({ ...modal, index: i })} onClose={() => setModal(null)} /> : null}
        scanner={scan ? <Scanner carId={carId} target={scan} onClose={() => setScan(null)} onDone={() => void load()} /> : null}
      />
    );
  }

  const stepCls = (s: Step) => `ap2-step ${done[s] ? "done" : shown === s ? "cur" : ""}`;
  const no = (s: Step) => <span className="no">{done[s] ? "✓" : s}</span>;
  const fileStep = (s: 1 | 2, label: string, files: V2ServissFile[], date: string, target: "number_check" | "diag") => (
    <div className={stepCls(s)}>
      {no(s)}
      <button
        type="button"
        className="ap2-sbox ap2-sbtn"
        onClick={() => (files.length ? setModal({ files, index: 0 }) : setScan({ target, title: label }))}
      >
        <span className="t">
          {s}. {label}
          <small>{files.length ? fmtDayMonth(date) : "Skenēt ›"}</small>
        </span>
      </button>
    </div>
  );

  return (
    <div className="ap2-pane">
      <div className="ap2-techbar">
        <div className="vinrow">
          <VinCopy vin={basics.vin} />
        </div>
        <TechCell label="1. reģ." value={fmtDateLv(basics.firstRegDate.value)} csdd={basics.firstRegDate.csdd} />
        <TechCell label="Tilpums" value={fmtCm3(basics.displacementCm3.value)} csdd={basics.displacementCm3.csdd} />
        <TechCell label="Jauda" value={fmtKw(basics.powerKw.value)} csdd={basics.powerKw.csdd} />
        <TechCell label="Riepas" value={basics.tyreSize.value} csdd={false} addable={perms.pamatdati} carId={carId} />
      </div>

      <div className="ap2-tl">
        {fileStep(1, "Numuru salīdzināšanas akts", view.numberCheck.files, view.numberCheck.date, "number_check")}
        {fileStep(2, "CSDD diagnostika", view.diag.files, view.diag.date, "diag")}

        <div className={stepCls(3)}>
          {no(3)}
          <div className="ap2-sbox">
            <button type="button" className="t" onClick={() => toggle(3)}>
              3. Problēmas
              <small>
                {pd.total > 0 ? `${pd.done} / ${pd.total}` : ""}
                {shown === 3 ? "" : " ›"}
              </small>
            </button>
            {shown === 3 ? (
              <Problems problems={view.problems} canConfirm={view.canConfirm} onPatch={(p) => void patch({ problem: p })} />
            ) : null}
          </div>
        </div>

        <div className={stepCls(4)}>
          {no(4)}
          <div className="ap2-sbox">
            <button type="button" className="t" onClick={() => toggle(4)}>
              4. Servisa piezīmes
              <small>{shown === 4 ? "" : "›"}</small>
            </button>
            {shown === 4 ? <Notes value={view.notes} onSave={(notes) => void patch({ notes })} /> : null}
          </div>
        </div>

        <div className={stepCls(5)}>
          {no(5)}
          <div className="ap2-sbox">
            <button type="button" className="t" onClick={() => toggle(5)}>
              5. Rēķini
              <small>
                {view.invoices.length || ""}
                {shown === 5 ? "" : " ›"}
              </small>
            </button>
            {shown === 5 ? (
              <>
                {view.invoices.map((i) => (
                  <InvoiceRow key={i.id} inv={i} canSums={view.canSums} onOpen={() => setInvoice(i.id)} />
                ))}
                <button type="button" className="ap2-scanbig" onClick={() => setScan({ target: "invoice", title: "Servisa rēķins" })}>
                  ◉ Skenēt rēķinu
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="ap2-err">{error}</p> : null}
      {modal ? <FileModal files={modal.files} index={modal.index} urlFor={urlFor} onIndex={(i) => setModal({ ...modal, index: i })} onClose={() => setModal(null)} /> : null}
      {scan ? (
        <Scanner
          carId={carId}
          target={scan}
          onClose={() => setScan(null)}
          onDone={(newInvoiceId) => {
            void load();
            if (newInvoiceId && view.canSums) setInvoice(newInvoiceId);
          }}
        />
      ) : null}
    </div>
  );
}

function TechCell({ label, value, csdd, addable, carId }: { label: string; value: string; csdd: boolean; addable?: boolean; carId?: string }) {
  const [v, setV] = useState(value);
  const [edit, setEdit] = useState(false);
  async function save(next: string) {
    setEdit(false);
    if (!carId || next.trim() === v) return;
    const r = await fetch(`/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tyreSize: next.trim() }),
    }).catch(() => null);
    if (r?.ok) setV(next.trim());
  }
  return (
    <div>
      <span>
        <i className={csdd ? "" : "no"} />
        {label}
      </span>
      {edit ? (
        <input autoFocus defaultValue={v} onBlur={(e) => void save(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
      ) : v ? (
        <b onClick={() => addable && setEdit(true)}>{v}</b>
      ) : addable ? (
        <button type="button" className="empty" onClick={() => setEdit(true)}>
          + Pievienot
        </button>
      ) : (
        <b>-</b>
      )}
    </div>
  );
}

/** Problēmas (T3): teksts pa visu platumu (lauks aug), zem tā 2 vienāda platuma ķekši. */
function Problems({ problems, canConfirm, onPatch }: { problems: V2Problem[]; canConfirm: boolean; onPatch: (p: Record<string, unknown>) => void }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      {problems.map((p) => (
        <div key={p.id} className="ap2-prob">
          <GrowText value={p.text} onSave={(text) => onPatch(text.trim() ? { id: p.id, text } : { id: p.id, remove: true })} />
          <div className="ap2-tg">
            <button type="button" className={p.fixedByService ? "on" : ""} onClick={() => onPatch({ id: p.id, fixedByService: !p.fixedByService })}>
              Serviss novērsa
            </button>
            <button
              type="button"
              className={p.confirmedByUs ? "on" : ""}
              disabled={!canConfirm}
              onClick={() => onPatch({ id: p.id, confirmedByUs: !p.confirmedByUs })}
            >
              Mēs apstiprinām
            </button>
          </div>
        </div>
      ))}
      {adding ? (
        <div className="ap2-prob">
          <GrowText
            value=""
            autoFocus
            onSave={(text) => {
              setAdding(false);
              if (text.trim()) onPatch({ text });
            }}
          />
        </div>
      ) : (
        <button type="button" className="ap2-addline" onClick={() => setAdding(true)}>
          + Problēma
        </button>
      )}
    </>
  );
}

function GrowText({ value, onSave, autoFocus }: { value: string; onSave: (v: string) => void; autoFocus?: boolean }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  // Lauks aug līdz ar tekstu (arī garas rindas, kas pārlūzt) - augstums pēc satura.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 3}px`;
  }, [v]);
  return (
    <textarea
      ref={ref}
      data-bare
      className="ap2-grow"
      value={v}
      rows={1}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return <GrowText value={value} onSave={onSave} autoFocus={!value} />;
}

function InvoiceRow({ inv, canSums, onOpen }: { inv: V2ServissInvoiceView; canSums: boolean; onOpen: () => void }) {
  return (
    <button type="button" className="ap2-irow" onClick={onOpen}>
      <PdfIcon small />
      <span>
        {fmtDateLv(inv.date)}
        <small>{lapasLv(inv.pages)}</small>
      </span>
      {canSums ? <span className={`a ${inv.amountEur == null ? "add" : ""}`}>{inv.amountEur == null ? "+ Summa" : fmtEur(inv.amountEur)}</span> : <span />}
    </button>
  );
}

/** Servisa rēķins (T5): lapas + "+ Lapa", datums, summa (tikai ar Summām), visu rēķinu saraksts ar "Kopā". */
function InvoicePage({
  view,
  inv,
  onBack,
  onOpenFiles,
  onAddPage,
  onAmount,
  onPick,
  modal,
  scanner,
}: {
  view: V2ServissView;
  inv: V2ServissInvoiceView;
  onBack: () => void;
  onOpenFiles: (i: number) => void;
  onAddPage: () => void;
  onAmount: (v: number | null) => void;
  onPick: (id: string) => void;
  modal: React.ReactNode;
  scanner: React.ReactNode;
}) {
  const pages = Array.from({ length: inv.pages }, (_, i) => i);
  return (
    <div className="ap2-pane ap2-invpage">
      <div className="ap2-invbar">
        <button type="button" className="ap2-back" onClick={onBack} aria-label="Atpakaļ">
          ‹
        </button>
        <h2>Servisa rēķins</h2>
      </div>
      <div className="ap2-card">
        <div className="ap2-pages">
          {pages.map((i) => (
            <button key={i} type="button" className="pg" onClick={() => onOpenFiles(0)}>
              <i />
              <i />
              <i />
              <b>{i + 1}</b>
            </button>
          ))}
          <button type="button" className="pg add" onClick={onAddPage}>
            + Lapa
          </button>
        </div>
      </div>
      <div className="ap2-card">
        <div className="ap2-f">
          <i className="ap2-cd" />
          <span className="k">Datums</span>
          <span className="v">{fmtDateLv(inv.date)}</span>
        </div>
        {view.canSums ? <AmountRow inv={inv} onAmount={onAmount} /> : null}
      </div>
      <div className="ap2-card">
        <h3>Rēķini</h3>
        {view.invoices.map((i) => (
          <InvoiceRow key={i.id} inv={i} canSums={view.canSums} onOpen={() => onPick(i.id)} />
        ))}
        {view.canSums ? (
          <div className="ap2-irow tot">
            <span>Kopā</span>
            <span>{fmtEur(view.totalEur)}</span>
          </div>
        ) : null}
      </div>
      {modal}
      {scanner}
    </div>
  );
}

function AmountRow({ inv, onAmount }: { inv: V2ServissInvoiceView; onAmount: (v: number | null) => void }) {
  const [edit, setEdit] = useState(false);
  return (
    <div className="ap2-f">
      <i className="ap2-cd" />
      <span className="k">Summa</span>
      {edit || inv.amountEur == null ? (
        <input
          className="v ap2-inp"
          inputMode="decimal"
          autoFocus={edit}
          defaultValue={inv.amountEur == null ? "" : String(inv.amountEur).replace(".", ",")}
          placeholder="0,00 €"
          onBlur={(e) => {
            setEdit(false);
            const n = parseEurInput(e.target.value);
            if (e.target.value.trim() === "" ? inv.amountEur != null : n !== inv.amountEur) onAmount(e.target.value.trim() === "" ? null : n);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button type="button" className="v ap2-inp" onClick={() => setEdit(true)}>
          {fmtEur(inv.amountEur)}
        </button>
      )}
    </div>
  );
}
