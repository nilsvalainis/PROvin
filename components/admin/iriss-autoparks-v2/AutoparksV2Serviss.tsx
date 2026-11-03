"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fmtDateLv,
  fmtEur,
  lapasLv,
  parseEurInput,
} from "@/lib/iriss-autoparks-v2-format";
import {
  SERVISS_SCAN_TITLE,
  type V2ServissFile,
  type V2ServissInvoiceView,
  type V2ServissView,
} from "@/lib/iriss-autoparks-v2-serviss";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { FileModal, PdfIcon } from "./FileModal";
import { Scanner, type ScannerTarget } from "./Scanner";
import { compressScanImage } from "./scan-upload";
import { enqueueScan } from "./scan-queue";
import { useScanQueue } from "./useScanQueue";
import type { QueuedScan } from "./scan-queue";
import {
  ServissProblemSheet,
  ServissScanSheet,
  ServissStages,
} from "./ServissPhone";
import type { ServissDocKey } from "@/lib/iriss-autoparks-v2-serviss-ui";

/** Serviss (F6, Nils A «Centra +»): dokumenti, problēmas, piezīmes, rēķins pēdējais. */
export function AutoparksV2Serviss({ carId }: CabinetPaneProps) {
  const [view, setView] = useState<V2ServissView | null>(null);
  const [scan, setScan] = useState<ScannerTarget | null>(null);
  const [modal, setModal] = useState<{
    files: V2ServissFile[];
    index: number;
  } | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  const [manualAmount, setManualAmount] = useState("");
  const [scanPick, setScanPick] = useState<ScannerTarget | null>(null);
  const [problemSheet, setProblemSheet] = useState<{ id?: string; text: string } | null>(null);
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const api = `/api/admin/iriss-autoparks-v2/serviss/${encodeURIComponent(carId)}`;

  const load = useCallback(async () => {
    const r = await fetch(api).catch(() => null);
    const d = (await r?.json().catch(() => null)) as {
      serviss?: V2ServissView;
    } | null;
    if (d?.serviss) setView(d.serviss);
    else setError("Neizdevās ielādēt");
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const queue = useScanQueue(carId, () => void load());
  const afterScan = () => void queue.refresh().then(queue.drain);

  async function patch(body: Record<string, unknown>): Promise<V2ServissView | null> {
    setError("");
    const r = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as {
      serviss?: V2ServissView;
    } | null;
    if (r?.ok && d?.serviss) {
      setView(d.serviss);
      return d.serviss;
    }
    setError("Neizdevās saglabāt");
    return null;
  }

  function openScan(target: ScannerTarget) {
    setScanPick(target);
  }

  function openDocScan(key: Exclude<ServissDocKey, "invoice">) {
    openScan({ target: key, title: SERVISS_SCAN_TITLE[key] });
  }

  async function enqueuePickedFiles(target: ScannerTarget, files: File[]) {
    if (files.length === 0) return;
    setError("");
    try {
      const pages = [];
      for (const f of files.slice(0, 20)) pages.push(await compressScanImage(f));
      await enqueueScan({
        carId,
        target: target.target,
        invoiceId: target.invoiceId,
        title: target.title,
        pages,
      });
      setScanPick(null);
      afterScan();
    } catch {
      setError("Neizdevās saglabāt skenējumu");
    }
  }

  async function saveProblem(text: string, photos: File[]) {
    const next = await patch(problemSheet?.id ? { problem: { id: problemSheet.id, text } } : { problem: { text } });
    if (!next) return;
    let pid = problemSheet?.id;
    if (!pid) {
      const match = next.problems.filter((p) => p.text.trim() === text);
      pid = match[match.length - 1]?.id;
    }
    if (pid && photos.length) await uploadPhotos(pid, photos);
    setProblemSheet(null);
  }

  /** Problēmas foto: telefona kamera / bildes, saspiež un sūta uzreiz (Nils 27.10). */
  async function uploadPhotos(problemId: string, files: File[]) {
    if (files.length === 0) return;
    setError("");
    const form = new FormData();
    form.set("target", "problem_photo");
    form.set("problemId", problemId);
    for (const f of files.slice(0, 6)) form.append("file", await compressScanImage(f));
    const r = await fetch(`${api}/skenet`, { method: "POST", body: form }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { serviss?: V2ServissView } | null;
    if (r?.ok && d?.serviss) setView(d.serviss);
    else setError("Foto neizdevās augšupielādēt");
  }

  const urlFor = useCallback(
    (f: { id: string }) => `${api}/faili/${encodeURIComponent(f.id)}`,
    [api],
  );
  if (!view) return error ? <p className="ap2-err">{error}</p> : null;

  const inv = invoice ? view.invoices.find((i) => i.id === invoice) : null;
  if (inv) {
    return (
      <InvoicePage
        view={view}
        inv={inv}
        onBack={() => setInvoice(null)}
        onOpenFiles={(i) => setModal({ files: inv.files, index: i })}
        onAddPage={() =>
          setScanPick({
            target: "invoice_page",
            invoiceId: inv.id,
            title: SERVISS_SCAN_TITLE.invoice,
          })
        }
        onAmount={(v) => void patch({ invoice: { id: inv.id, amountEur: v } })}
        onAccept={() => void patch({ invoice: { id: inv.id, acceptAi: true } })}
        onReload={() => void load()}
        onPick={(id) => setInvoice(id)}
        modal={
          modal ? (
            <FileModal
              files={modal.files}
              index={modal.index}
              urlFor={urlFor}
              onIndex={(i) => setModal({ ...modal, index: i })}
              onClose={() => setModal(null)}
            />
          ) : null
        }
        scanner={
          <>
            {scanPick ? (
              <ServissScanSheet
                title={scanPick.title}
                onCamera={() => {
                  setScan(scanPick);
                  setScanPick(null);
                }}
                onFiles={(files) => void enqueuePickedFiles(scanPick, files)}
                onClose={() => setScanPick(null)}
              />
            ) : null}
            {scan ? (
              <Scanner
                carId={carId}
                target={scan}
                onClose={() => setScan(null)}
                onDone={afterScan}
              />
            ) : null}
          </>
        }
      />
    );
  }

  return (
    <div className="ap2-pane">
      <ScanQueue
        online={queue.online}
        items={queue.items}
        onRetry={() => void queue.drain()}
      />
      <ServissStages
        view={view}
        notesEditing={notesEdit}
        notesDraft={notesDraft}
        onNotesDraft={setNotesDraft}
        onNotesEdit={() => {
          setNotesDraft(view.notes);
          setNotesEdit(true);
        }}
        onNotesSave={() => {
          void patch({ notes: notesDraft }).then((ok) => {
            if (ok) setNotesEdit(false);
          });
        }}
        onNotesCancel={() => setNotesEdit(false)}
        onScanDoc={openDocScan}
        onScanInvoice={() => openScan({ target: "invoice", title: SERVISS_SCAN_TITLE.invoice })}
        onViewFiles={(files) => setModal({ files, index: 0 })}
        onOpenInvoice={(id) => setInvoice(id)}
        onManualInvoice={view.canSums ? () => setManual((m) => !m) : undefined}
        onAddProblem={() => setProblemSheet({ text: "" })}
        onEditProblem={(p) => setProblemSheet({ id: p.id, text: p.text })}
        onAddPhotos={(id, files) => void uploadPhotos(id, files)}
        onOpenPhoto={(p, i) =>
          setModal({
            files: p.photoIds.map((pid) => ({ id: pid, title: p.text || "Foto", date: "", contentType: "image/jpeg" })),
            index: i,
          })
        }
        onDeleteProblem={(p) => {
          if (window.confirm(`Dzēst problēmu "${p.text}"?`)) void patch({ problem: { id: p.id, remove: true } });
        }}
        onToggleFixed={(p, fixed) => void patch({ problem: { id: p.id, fixedByService: fixed } })}
        photoUrl={(id) => urlFor({ id })}
      />
      {manual ? (
        <form
          className="ap2-sv-manual"
          onSubmit={(e) => {
            e.preventDefault();
            const v = manualAmount.trim();
            if (!v) return;
            void patch({ addInvoice: { amountEur: v } }).then((ok) => {
              if (ok) {
                setManual(false);
                setManualAmount("");
              }
            });
          }}
        >
          <label>
            <span>Summa bez PVN</span>
            <input inputMode="decimal" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="0,00" autoFocus />
          </label>
          <button type="submit" className="iriss-btn iriss-btn--primary iriss-btn--sm">
            Saglabāt
          </button>
        </form>
      ) : null}

      {error ? <p className="ap2-err">{error}</p> : null}
      {modal ? (
        <FileModal
          files={modal.files}
          index={modal.index}
          urlFor={urlFor}
          onIndex={(i) => setModal({ ...modal, index: i })}
          onClose={() => setModal(null)}
        />
      ) : null}
      {scanPick ? (
        <ServissScanSheet
          title={scanPick.title}
          csdd={scanPick.target === "number_check" || scanPick.target === "diag"}
          onCamera={() => {
            setScan(scanPick);
            setScanPick(null);
          }}
          onFiles={(files) => void enqueuePickedFiles(scanPick, files)}
          onClose={() => setScanPick(null)}
        />
      ) : null}
      {problemSheet ? (
        <ServissProblemSheet
          title={problemSheet.id ? "Labot problēmu" : "Jauna problēma"}
          initialText={problemSheet.text}
          onSave={(text, photos) => void saveProblem(text, photos)}
          onClose={() => setProblemSheet(null)}
        />
      ) : null}
      {scan ? (
        <Scanner
          carId={carId}
          target={scan}
          onClose={() => setScan(null)}
          onDone={afterScan}
        />
      ) : null}
    </div>
  );
}

function InvoiceRow({
  inv,
  canSums,
  onOpen,
}: {
  inv: V2ServissInvoiceView;
  canSums: boolean;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="ap2-irow" onClick={onOpen}>
      <PdfIcon small />
      <span>
        {fmtDateLv(inv.date)}
        <small>{inv.pages > 0 ? lapasLv(inv.pages) : "ievadīts ar roku"}</small>
      </span>
      {canSums ? (
        inv.amountEur != null ? (
          <span className="a">{fmtEur(inv.amountEur)}</span>
        ) : inv.ai?.amountEur != null ? (
          <span className="a sug">
            {fmtEur(inv.ai.amountEur)} <small>pārbaudi</small>
          </span>
        ) : (
          <span className="a add">+ Summa</span>
        )
      ) : (
        <span />
      )}
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
  onAccept,
  onReload,
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
  onAccept: () => void;
  onReload: () => void;
  onPick: (id: string) => void;
  modal: React.ReactNode;
  scanner: React.ReactNode;
}) {
  const pages = Array.from({ length: inv.pages }, (_, i) => i);
  // F10: AI ieteikums nāk dažas sekundes pēc skenēšanas - kamēr nav summas un ieteikuma, pārlasa (līdz ~1 min).
  const waiting = view.canSums && inv.amountEur == null && !inv.ai;
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 15) clearInterval(t);
      else onReload();
    }, 4000);
    return () => clearInterval(t);
  }, [waiting, onReload]);
  return (
    <div className="ap2-pane ap2-invpage">
      <div className="ap2-invbar">
        <button
          type="button"
          className="ap2-back"
          onClick={onBack}
          aria-label="Atpakaļ"
        >
          ‹
        </button>
        <h2>Servisa rēķins</h2>
      </div>
      <div className="ap2-card">
        <div className="ap2-pages">
          {pages.map((i) => (
            <button
              key={i}
              type="button"
              className="pg"
              onClick={() => onOpenFiles(0)}
            >
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
        {view.canSums ? (
          <AmountRow inv={inv} onAmount={onAmount} onAccept={onAccept} />
        ) : null}
      </div>
      <div className="ap2-card">
        <h3>Rēķini</h3>
        {view.invoices.map((i) => (
          <InvoiceRow
            key={i.id}
            inv={i}
            canSums={view.canSums}
            onOpen={() => onPick(i.id)}
          />
        ))}
        {view.canSums ? (
          <div className="ap2-irow tot">
            <span>Kopā bez PVN</span>
            <span>{fmtEur(view.totalEur)}</span>
          </div>
        ) : null}
      </div>
      {modal}
      {scanner}
    </div>
  );
}

function AmountRow({
  inv,
  onAmount,
  onAccept,
}: {
  inv: V2ServissInvoiceView;
  onAmount: (v: number | null) => void;
  onAccept: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const suggestion =
    inv.amountEur == null && inv.ai?.amountEur != null
      ? inv.ai.amountEur
      : null;
  if (suggestion != null && !edit) {
    // F10: AI ieteikums - apstiprina ar 1 pieskārienu (vai labo). Pašizmaksā tikai pēc apstiprinājuma.
    return (
      <div className="ap2-f">
        <i className="ap2-cd" />
        <span className="k">Summa bez PVN</span>
        <span className="ap2-aisug">
          <button
            type="button"
            className="v ap2-inp sug"
            onClick={() => setEdit(true)}
          >
            {fmtEur(suggestion)}
          </button>
          <button type="button" className="ap2-btn dark sm" onClick={onAccept}>
            Apstiprināt
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="ap2-f">
      <i className="ap2-cd" />
      <span className="k">Summa bez PVN</span>
      {edit || inv.amountEur == null ? (
        <input
          className="v ap2-inp"
          inputMode="decimal"
          autoFocus={edit}
          defaultValue={
            inv.amountEur == null
              ? suggestion == null
                ? ""
                : String(suggestion).replace(".", ",")
              : String(inv.amountEur).replace(".", ",")
          }
          placeholder="0,00 €"
          onBlur={(e) => {
            setEdit(false);
            const n = parseEurInput(e.target.value);
            if (
              e.target.value.trim() === ""
                ? inv.amountEur != null
                : n !== inv.amountEur
            )
              onAmount(e.target.value.trim() === "" ? null : n);
          }}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.target as HTMLInputElement).blur()
          }
        />
      ) : (
        <button
          type="button"
          className="v ap2-inp"
          onClick={() => setEdit(true)}
        >
          {fmtEur(inv.amountEur)}
        </button>
      )}
    </div>
  );
}

/** T9: "Nav interneta" + "Gaida augšupielādi": skenējumi telefonā, progress, "Neizdevās" + VĒLREIZ. */
function ScanQueue({
  online,
  items,
  onRetry,
}: {
  online: boolean;
  items: QueuedScan[];
  onRetry: () => void;
}) {
  if (online && items.length === 0) return null;
  return (
    <div className="ap2-queue">
      {!online ? <div className="ap2-offline">Nav interneta</div> : null}
      {items.length > 0 ? (
        <>
          <div className="ap2-sec">
            Gaida augšupielādi<span className="n">{items.length}</span>
          </div>
          {items.map((q) => (
            <div key={q.id} className="ap2-q">
              <PdfIcon small />
              <div className="tx">
                <b>{q.title}</b>
                {q.state === "failed" ? (
                  <small className="bad">Neizdevās</small>
                ) : (
                  <small>
                    {lapasLv(q.pages.length)} ·{" "}
                    {q.state === "uploading"
                      ? `${Math.round(q.progress * 100)}%`
                      : new Date(q.createdAt).toLocaleTimeString("lv-LV", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </small>
                )}
                {q.state === "uploading" ? (
                  <div className="ap2-qbar">
                    <i
                      style={{
                        width: `${Math.max(4, Math.round(q.progress * 100))}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              {q.state === "failed" ? (
                <button
                  type="button"
                  className="ap2-btn sec sm ap2-retry"
                  onClick={onRetry}
                  disabled={!online}
                >
                  VĒLREIZ
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
