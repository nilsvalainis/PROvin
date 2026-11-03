"use client";

import { useState } from "react";
import { AutoparksV2CsddDocBadge } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Iegade";
import { fmtDateLv, fmtEur } from "@/lib/iriss-autoparks-v2-format";
import type { V2Problem } from "@/lib/iriss-autoparks-v2";
import type { V2ServissFile, V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";
import {
  invoiceCardMeta,
  nextMissingServissDoc,
  problemPhotoHint,
  SERVISS_DOC_TITLE,
  SERVISS_EMPTY_PROBLEMS_HINT,
  servissDocProgress,
  servissDocReady,
  type ServissDocKey,
} from "@/lib/iriss-autoparks-v2-serviss-ui";

function ScanCornersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 10h8M8 14h5" />
    </svg>
  );
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}

export function ServissScanButton({
  primary,
  onClick,
  label = "Skenēt",
}: {
  primary?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={`ap2-sv-scan${primary ? " pri" : ""}`}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <ScanCornersIcon />
    </button>
  );
}

function StatusChip({ ready }: { ready: boolean }) {
  return ready ? <span className="ap2-sv-chip g">Gatavs</span> : <span className="ap2-sv-chip a">Nav</span>;
}

function DocNum({ n, ready }: { n: number; ready: boolean }) {
  return <span className={`ap2-sv-num${ready ? " ok" : ""}`}>{ready ? "✓" : n}</span>;
}

export function ServissDocRow({
  n,
  title,
  ready,
  primary,
  next,
  csdd,
  onScan,
  onView,
}: {
  n: number;
  title: string;
  ready: boolean;
  primary: boolean;
  next?: boolean;
  csdd?: boolean;
  onScan: () => void;
  onView?: () => void;
}) {
  return (
    <div className="ap2-sv-drow">
      <DocNum n={n} ready={ready} />
      <div className="ap2-sv-dt">
        <b>{title}</b>
        <div className="ap2-sv-meta">
          {csdd ? <AutoparksV2CsddDocBadge /> : null}
          <StatusChip ready={ready} />
          {ready && onView ? (
            <>
              <span className="ap2-sv-dot" aria-hidden>
                ·
              </span>
              <button type="button" className="ap2-sv-link" onClick={onView}>
                Skatīt
              </button>
            </>
          ) : null}
          {next && !ready ? (
            <>
              <span className="ap2-sv-dot" aria-hidden>
                ·
              </span>
              <span>Nākamais</span>
            </>
          ) : null}
        </div>
      </div>
      <ServissScanButton primary={primary} onClick={onScan} />
    </div>
  );
}

export function ServissDocumentsCard({
  view,
  onScan,
  onView,
}: {
  view: V2ServissView;
  onScan: (key: Exclude<ServissDocKey, "invoice">) => void;
  onView: (files: V2ServissFile[]) => void;
}) {
  const next = nextMissingServissDoc(view);
  const prog = servissDocProgress(view);
  const aktsReady = servissDocReady(view, "number_check");
  const diagReady = servissDocReady(view, "diag");
  return (
    <section aria-label="Dokumenti">
      <div className="ap2-sv-sec">Dokumenti</div>
      <div className="ap2-sv-prog">
        <div className="ap2-sv-bar">
          <i style={{ width: `${(prog.done / prog.total) * 100}%` }} />
        </div>
        {prog.done}/{prog.total} dokumenti
      </div>
      <div className="ap2-sv-card">
        <ServissDocRow
          n={1}
          title={SERVISS_DOC_TITLE.number_check}
          ready={aktsReady}
          primary={next === "number_check"}
          next={next === "number_check"}
          csdd
          onScan={() => onScan("number_check")}
          onView={aktsReady ? () => onView(view.numberCheck.files) : undefined}
        />
        <ServissDocRow
          n={2}
          title={SERVISS_DOC_TITLE.diag}
          ready={diagReady}
          primary={next === "diag"}
          next={next === "diag"}
          csdd
          onScan={() => onScan("diag")}
          onView={diagReady ? () => onView(view.diag.files) : undefined}
        />
      </div>
    </section>
  );
}

export function ServissProblemsCard({
  problems,
  canDelete,
  photoUrl,
  onAdd,
  onAddPhotos,
  onOpenPhoto,
  onDelete,
  onToggleFixed,
  onEdit,
}: {
  problems: V2Problem[];
  canDelete: boolean;
  photoUrl: (id: string) => string;
  onAdd: () => void;
  onAddPhotos: (problemId: string, files: File[]) => void;
  onOpenPhoto: (p: V2Problem, index: number) => void;
  onDelete: (p: V2Problem) => void;
  onToggleFixed: (p: V2Problem, fixed: boolean) => void;
  onEdit: (p: V2Problem) => void;
}) {
  const live = problems.filter((p) => p.text.trim());
  return (
    <section aria-label="Problēmas">
      <div className="ap2-sv-sec">Problēmas</div>
      <div className="ap2-sv-card">
        {live.length === 0 ? (
          <button type="button" className="ap2-sv-hero" onClick={onAdd}>
            <span className="ap2-sv-bigplus">
              <PlusIcon size={32} />
            </span>
            <b>Pievienot problēmu</b>
            <p>{SERVISS_EMPTY_PROBLEMS_HINT}</p>
          </button>
        ) : (
          <>
            {live.map((p) => (
              <div key={p.id} className={`ap2-sv-prow${p.fixedByService ? " done" : ""}`}>
                <div className="ap2-sv-pt">
                  <label className="ap2-sv-chk">
                    <input
                      type="checkbox"
                      checked={p.fixedByService}
                      onChange={(e) => onToggleFixed(p, e.target.checked)}
                    />
                    <button type="button" className="ap2-sv-ptitle" onClick={() => onEdit(p)}>
                      <b>{p.text}</b>
                    </button>
                  </label>
                  {canDelete ? (
                    <button
                      type="button"
                      className="ap2-sv-del"
                      aria-label={`Dzēst problēmu: ${p.text}`}
                      title="Dzēst"
                      onClick={() => onDelete(p)}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                <small className="ap2-sv-phint">
                  {problemPhotoHint(p.photoIds.length)}
                  {p.photoIds.length === 0 ? (
                    <>
                      {" · "}
                      <label className="ap2-sv-link">
                        Pievienot foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          hidden
                          aria-label="Pievienot foto"
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            e.target.value = "";
                            onAddPhotos(p.id, files);
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </small>
                {p.photoIds.length > 0 ? (
                  <div className="ap2-sv-ph">
                    {p.photoIds.map((id, i) => (
                      <button key={id} type="button" className="ap2-sv-thumb" onClick={() => onOpenPhoto(p, i)} aria-label="Atvērt foto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl(id)} alt="" loading="lazy" />
                      </button>
                    ))}
                    <label className="ap2-sv-addph">
                      <CameraIcon />
                      Foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        aria-label="Pievienot foto"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          e.target.value = "";
                          onAddPhotos(p.id, files);
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="ap2-sv-cpill">
              <button type="button" onClick={onAdd}>
                <i>
                  <PlusIcon size={18} />
                </i>
                Pievienot problēmu
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function ServissNotesCard({
  notes,
  editing,
  draft,
  onDraft,
  onEdit,
  onSave,
  onCancel,
}: {
  notes: string;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label="Servisa piezīmes">
      <div className="ap2-sv-sec">Servisa piezīmes</div>
      <div className="ap2-sv-card">
        {editing ? (
          <div className="ap2-sv-note-edit">
            <textarea value={draft} onChange={(e) => onDraft(e.target.value)} rows={3} aria-label="Servisa piezīmes" />
            <div className="ap2-sv-note-acts">
              <button type="button" className="ap2-sv-link" onClick={onCancel}>
                Atcelt
              </button>
              <button type="button" className="ap2-sv-save-sm" onClick={onSave}>
                Saglabāt
              </button>
            </div>
          </div>
        ) : (
          <div className="ap2-sv-note">
            <span>{notes.trim() || "Nav piezīmju"}</span>
            <button type="button" className="ap2-sv-link" onClick={onEdit}>
              Labot
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function ServissInvoiceCard({
  view,
  onScan,
  onOpen,
  onManual,
}: {
  view: V2ServissView;
  onScan: () => void;
  onOpen: (id: string) => void;
  onManual?: () => void;
}) {
  const ready = servissDocReady(view, "invoice");
  const next = nextMissingServissDoc(view) === "invoice";
  const meta = invoiceCardMeta(view.invoices);
  const many = view.invoices.length > 1;
  return (
    <section aria-label="Rēķins">
      <div className="ap2-sv-sec">Rēķins</div>
      <div className="ap2-sv-card">
        <div className="ap2-sv-drow">
          <DocNum n={3} ready={ready} />
          <button
            type="button"
            className="ap2-sv-dt ap2-sv-dtbtn"
            disabled={!ready || !view.invoices[0]}
            onClick={() => view.invoices[0] && onOpen(view.invoices[0].id)}
          >
            <b>{SERVISS_DOC_TITLE.invoice}</b>
            <div className="ap2-sv-meta">
              <StatusChip ready={ready} />
              {ready && meta.date ? (
                <>
                  <span className="ap2-sv-dot" aria-hidden>
                    ·
                  </span>
                  <span>{fmtDateLv(meta.date)}</span>
                </>
              ) : null}
              {view.canSums && meta.amountEur != null ? <span className="ap2-sv-sum">{fmtEur(meta.amountEur)}</span> : null}
              {view.canSums && meta.aiAmountEur != null ? (
                <span className="ap2-sv-sum sug">{fmtEur(meta.aiAmountEur)}</span>
              ) : null}
            </div>
          </button>
          {onManual && view.canSums ? (
            <button type="button" className="ap2-sv-link" onClick={onManual}>
              Ar roku
            </button>
          ) : null}
          <ServissScanButton primary={next} onClick={onScan} />
        </div>
        {many
          ? view.invoices.map((inv) => (
              <button key={inv.id} type="button" className="ap2-sv-invline" onClick={() => onOpen(inv.id)}>
                <span>
                  {fmtDateLv(inv.date)}
                  {inv.pages > 0 ? ` · ${inv.pages === 1 ? "1 lapa" : `${inv.pages} lapas`}` : " · ievadīts ar roku"}
                </span>
                {view.canSums ? (
                  <b>{inv.amountEur != null ? fmtEur(inv.amountEur) : inv.ai?.amountEur != null ? fmtEur(inv.ai.amountEur) : "+ Summa"}</b>
                ) : null}
              </button>
            ))
          : null}
        {view.canSums && view.totalEur != null && view.invoices.length > 1 ? (
          <div className="ap2-sv-total">
            <span>Kopā bez PVN</span>
            <b>{fmtEur(view.totalEur)}</b>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ServissScanSheet({
  title,
  csdd,
  onCamera,
  onFiles,
  onClose,
}: {
  title: string;
  csdd?: boolean;
  onCamera: () => void;
  onFiles: (files: File[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="ap2-sv-overlay">
      <button type="button" className="ap2-sv-dim" aria-label="Aizvērt" onClick={onClose} />
      <div className="ap2-sv-sheet" role="dialog" aria-label={title}>
        <div className="ap2-sv-sheet-card">
          <div className="ap2-sv-grab" />
          <div className="ap2-sv-sh">
            <div className="ap2-sv-sht">
              {csdd ? <AutoparksV2CsddDocBadge /> : null}
              {title}
            </div>
            <p>Kamera (vairākas lapas → PDF) vai fails</p>
          </div>
          <button type="button" className="ap2-sv-opt" onClick={onCamera}>
            <span className="ap2-sv-scan pri">
              <CameraIcon />
            </span>
            <span>
              Kamera
              <small>Vairākas lapas → PDF</small>
            </span>
          </button>
          <label className="ap2-sv-opt">
            <span className="ap2-sv-scan">
              <GalleryIcon />
            </span>
            <span>
              Fails
              <small>Izvēlēties no failiem</small>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) onFiles(files);
              }}
            />
          </label>
        </div>
        <button type="button" className="ap2-sv-cancel" onClick={onClose}>
          Atcelt
        </button>
      </div>
    </div>
  );
}

export function ServissProblemSheet({
  title = "Jauna problēma",
  initialText,
  onSave,
  onClose,
}: {
  title?: string;
  initialText: string;
  onSave: (text: string, photos: File[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [photos, setPhotos] = useState<File[]>([]);
  const add = (files: File[]) => setPhotos((cur) => [...cur, ...files].slice(0, 6));
  return (
    <div className="ap2-sv-overlay">
      <button type="button" className="ap2-sv-dim" aria-label="Aizvērt" onClick={onClose} />
      <div className="ap2-sv-sheet" role="dialog" aria-label={title}>
        <div className="ap2-sv-sheet-card">
          <div className="ap2-sv-grab" />
          <div className="ap2-sv-sh">
            <div className="ap2-sv-sht">{title}</div>
          </div>
          <label className="ap2-sv-fl">Apraksts</label>
          <textarea
            className="ap2-sv-fld"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            aria-label="Apraksts"
          />
          <label className="ap2-sv-fl">Foto (pēc izvēles){photos.length ? ` · ${problemPhotoHint(photos.length)}` : ""}</label>
          <label className="ap2-sv-opt first">
            <span className="ap2-sv-scan pri">
              <CameraIcon />
            </span>
            <span>
              Kamera
              <small>Uzņemt foto</small>
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <label className="ap2-sv-opt">
            <span className="ap2-sv-scan">
              <GalleryIcon />
            </span>
            <span>
              Galerija
              <small>Izvēlēties no attēliem</small>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="ap2-sv-save"
            disabled={!text.trim()}
            onClick={() => onSave(text.trim(), photos)}
          >
            Saglabāt problēmu
          </button>
        </div>
        <button type="button" className="ap2-sv-cancel" onClick={onClose}>
          Atcelt
        </button>
      </div>
    </div>
  );
}

export function ServissStages({
  view,
  notesEditing,
  notesDraft,
  onNotesDraft,
  onNotesEdit,
  onNotesSave,
  onNotesCancel,
  onScanDoc,
  onScanInvoice,
  onViewFiles,
  onOpenInvoice,
  onManualInvoice,
  onAddProblem,
  onEditProblem,
  onAddPhotos,
  onOpenPhoto,
  onDeleteProblem,
  onToggleFixed,
  photoUrl,
}: {
  view: V2ServissView;
  notesEditing: boolean;
  notesDraft: string;
  onNotesDraft: (v: string) => void;
  onNotesEdit: () => void;
  onNotesSave: () => void;
  onNotesCancel: () => void;
  onScanDoc: (key: Exclude<ServissDocKey, "invoice">) => void;
  onScanInvoice: () => void;
  onViewFiles: (files: V2ServissFile[]) => void;
  onOpenInvoice: (id: string) => void;
  onManualInvoice?: () => void;
  onAddProblem: () => void;
  onEditProblem: (p: V2Problem) => void;
  onAddPhotos: (problemId: string, files: File[]) => void;
  onOpenPhoto: (p: V2Problem, index: number) => void;
  onDeleteProblem: (p: V2Problem) => void;
  onToggleFixed: (p: V2Problem, fixed: boolean) => void;
  photoUrl: (id: string) => string;
}) {
  return (
    <div className="ap2-sv-a">
      <ServissDocumentsCard view={view} onScan={onScanDoc} onView={onViewFiles} />
      <ServissProblemsCard
        problems={view.problems}
        canDelete={view.canDelete}
        photoUrl={photoUrl}
        onAdd={onAddProblem}
        onAddPhotos={onAddPhotos}
        onOpenPhoto={onOpenPhoto}
        onDelete={onDeleteProblem}
        onToggleFixed={onToggleFixed}
        onEdit={onEditProblem}
      />
      <ServissNotesCard
        notes={view.notes}
        editing={notesEditing}
        draft={notesDraft}
        onDraft={onNotesDraft}
        onEdit={onNotesEdit}
        onSave={onNotesSave}
        onCancel={onNotesCancel}
      />
      <ServissInvoiceCard view={view} onScan={onScanInvoice} onOpen={onOpenInvoice} onManual={onManualInvoice} />
    </div>
  );
}
