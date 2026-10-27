"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fmtDateLv,
  fmtEur,
  lapasLv,
  parseEurInput,
} from "@/lib/iriss-autoparks-v2-format";
import {
  type V2ServissFile,
  type V2ServissInvoiceView,
  type V2ServissView,
} from "@/lib/iriss-autoparks-v2-serviss";
import type { V2Problem } from "@/lib/iriss-autoparks-v2";
import type { CabinetPaneProps } from "./AutoparksV2Cabinet";
import { FileModal, PdfIcon } from "./FileModal";
import { Scanner, type ScannerTarget } from "./Scanner";
import { compressScanImage } from "./scan-upload";
import { useScanQueue } from "./useScanQueue";
import type { QueuedScan } from "./scan-queue";

/** Serviss (T3-T5, T7): tehniskā josla + 5 posmi. Galvenā poga - "Skenēt". */
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

  async function patch(body: Record<string, unknown>) {
    setError("");
    const r = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as {
      serviss?: V2ServissView;
    } | null;
    if (r?.ok && d?.serviss) setView(d.serviss);
    else setError("Neizdevās saglabāt");
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
          setScan({
            target: "invoice_page",
            invoiceId: inv.id,
            title: "Servisa rēķins",
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
          scan ? (
            <Scanner
              carId={carId}
              target={scan}
              onClose={() => setScan(null)}
              onDone={afterScan}
            />
          ) : null
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
      {/* Nils 27.10 (makets «Serviss»): tikai rēķini un problēmas; telefonā divas lielas pogas augšā. */}
      <div className="ap2-sv-acts">
        <button type="button" className="ap2-sv-big pri" onClick={() => setScan({ target: "invoice", title: "Servisa rēķins" })}>
          Skenēt rēķinu
        </button>
        <button type="button" className="ap2-sv-big" onClick={() => document.getElementById("ap2-sv-newprob")?.focus()}>
          + Problēma
        </button>
      </div>
      <div className="ap2-sv">
        <section className="ap2-sv-card" aria-label="Servisa rēķini">
          <div className="ap2-sv-head">
            <h3>Servisa rēķini</h3>
            <span className="ap2-sv-headbtns">
              <button type="button" className="iriss-btn iriss-btn--secondary iriss-btn--sm" onClick={() => setManual((m) => !m)}>
                + Ar roku
              </button>
              <button type="button" className="iriss-btn iriss-btn--primary iriss-btn--sm" onClick={() => setScan({ target: "invoice", title: "Servisa rēķins" })}>
                Skenēt rēķinu
              </button>
            </span>
          </div>
          <p className="ap2-sv-mu">Summa bez PVN. Skenējot to nolasa automātiski - pārbaudi un apstiprini.</p>
          {manual ? (
            <form
              className="ap2-sv-manual"
              onSubmit={(e) => {
                e.preventDefault();
                const v = manualAmount.trim();
                if (!v) return;
                void patch({ addInvoice: { amountEur: v } }).then(() => {
                  setManual(false);
                  setManualAmount("");
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
          {view.invoices.length === 0 ? <p className="ap2-sv-mu">Vēl nav rēķinu.</p> : null}
          {view.invoices.map((i) => (
            <InvoiceRow key={i.id} inv={i} canSums={view.canSums} onOpen={() => setInvoice(i.id)} />
          ))}
          {view.canSums && view.totalEur != null && view.invoices.length > 0 ? (
            <div className="ap2-sv-total">
              <span>Kopā bez PVN</span>
              <b>{fmtEur(view.totalEur)}</b>
            </div>
          ) : null}
        </section>

        <section className="ap2-sv-card" aria-label="Problēmas">
          <div className="ap2-sv-head">
            <h3>Problēmas</h3>
          </div>
          <p className="ap2-sv-mu">Pievieno jebkurš ar piekļuvi; foto - pēc vajadzības.</p>
          <SimpleProblems
            problems={view.problems}
            canDelete={view.canDelete}
            photoUrl={(id) => urlFor({ id })}
            onPatch={(p) => void patch({ problem: p })}
            onPhotos={(id, files) => void uploadPhotos(id, files)}
            onOpenPhoto={(p, i) =>
              setModal({
                files: p.photoIds.map((pid) => ({ id: pid, title: p.text || "Foto", date: "", contentType: "image/jpeg" })),
                index: i,
              })
            }
          />
        </section>
      </div>

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

/**
 * Problēmas (Nils 27.10): atzīme «salabots», teksts, foto pēc vajadzības; jaunu pievieno jebkurš.
 */
function SimpleProblems({
  problems,
  canDelete,
  photoUrl,
  onPatch,
  onPhotos,
  onOpenPhoto,
}: {
  problems: V2Problem[];
  canDelete: boolean;
  photoUrl: (id: string) => string;
  onPatch: (p: Record<string, unknown>) => void;
  onPhotos: (problemId: string, files: File[]) => void;
  onOpenPhoto: (p: V2Problem, index: number) => void;
}) {
  const [text, setText] = useState("");
  const live = problems.filter((p) => p.text.trim());
  return (
    <div className="ap2-sv-probs">
      {live.map((p) => (
        <div key={p.id} className={`ap2-sv-prob ${p.fixedByService ? "done" : ""}`}>
          <label className="chk">
            <input type="checkbox" checked={p.fixedByService} onChange={(e) => onPatch({ id: p.id, fixedByService: e.target.checked })} />
            <span>{p.text}</span>
          </label>
          <span className="ph">
            {p.photoIds.map((id, i) => (
              <button key={id} type="button" className="ap2-sv-photo" onClick={() => onOpenPhoto(p, i)} aria-label="Atvērt foto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(id)} alt="" loading="lazy" />
              </button>
            ))}
            <label className="ap2-sv-addphoto" title="Pievienot foto">
              <span aria-hidden>+ Foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                aria-label="Pievienot foto"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  onPhotos(p.id, files);
                }}
              />
            </label>
            {canDelete ? (
              <button
                type="button"
                className="ap2-sv-del"
                aria-label={`Dzēst problēmu: ${p.text}`}
                title="Dzēst"
                onClick={() => {
                  if (window.confirm(`Dzēst problēmu "${p.text}"?`)) onPatch({ id: p.id, remove: true });
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            ) : null}
          </span>
        </div>
      ))}
      <form
        className="ap2-sv-newprob"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onPatch({ text: text.trim() });
          setText("");
        }}
      >
        <input id="ap2-sv-newprob" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jauna problēma..." aria-label="Jauna problēma" />
        <button type="submit" className="iriss-btn iriss-btn--secondary iriss-btn--sm">
          Pievienot
        </button>
      </form>
    </div>
  );
}
