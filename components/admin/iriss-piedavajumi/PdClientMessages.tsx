"use client";

import { useState } from "react";
import { copyText } from "@/components/admin/iriss-piedavajumi/pd-actions";
import { formatOfferDeadlineLv, rigaLocalParts } from "@/lib/iriss-offer-valid-until";
import { irissPdOpenQuestionCount, irissPdQuestionAnswer, type IrissPdQuestionAnswer } from "@/lib/iriss-piedavajumi-messages";
import { IRISS_PD_NOTE_MAX, type IrissPdMessage } from "@/lib/iriss-piedavajumi-types";

function kindLabel(m: IrissPdMessage): string {
  if (m.kind === "question") return "Klienta jautājums";
  if (m.kind === "decline") return "Klients noraidīja";
  return m.public ? "Atbilde (redzama klientam saitē)" : "Piezīme (iekšēja)";
}

/** "Atbildēts · Nils · 14.11. 10:22" (Rīgas laikā). */
export function irissPdAnsweredLabel(a: IrissPdQuestionAnswer): string {
  const p = rigaLocalParts(Date.parse(a.at));
  const when = p ? `${p.ymd.slice(8, 10)}.${p.ymd.slice(5, 7)}. ${p.hm}` : "";
  return ["Atbildēts", a.by.trim(), when].filter(Boolean).join(" · ");
}

/**
 * Nils 07.11: klienta ziņas no saites (jautājumi, noraidījuma iemesls) + admina atbilde.
 * Atbilde pēc noklusējuma iekšēja; ar atzīmi «Rādīt klientam saitē» klients to redz, atverot saiti.
 * Klientam nekas automātiski netiek sūtīts (ne e-pasts, ne ziņa).
 */
export function PdClientMessagesView({
  messages,
  draft,
  showClient,
  busy,
  err,
  onDraft,
  onShowClient,
  onSave,
  onCopy,
  onToggleVisible,
  onSetAnswered,
  copiedId,
}: {
  messages: readonly IrissPdMessage[];
  draft: string;
  showClient: boolean;
  busy: boolean;
  err: string;
  onDraft?: (v: string) => void;
  onShowClient?: (v: boolean) => void;
  onSave?: () => void;
  onCopy?: (m: IrissPdMessage) => void;
  onToggleVisible?: (m: IrissPdMessage) => void;
  onSetAnswered?: (m: IrissPdMessage, answered: boolean) => void;
  copiedId?: string;
}) {
  const open = irissPdOpenQuestionCount(messages);
  return (
    <div className="pd-msgs">
      {messages.length === 0 ? <p className="pd-hint">Klients vēl nav rakstījis.</p> : null}
      {open > 0 ? <p className="pd-msg-open">Neatbildēti jautājumi: {open}</p> : null}
      {messages
        .map((m, i) => ({ m, answer: irissPdQuestionAnswer(messages, i) }))
        .reverse()
        .map(({ m, answer }) => (
          <div key={m.id} className={`pd-msg ${m.from === "admin" ? "admin" : "client"} k-${m.kind}${m.public ? " pub" : ""}`}>
            <div className="pd-msg-h">
              <b>{kindLabel(m)}</b>
              <small>
                {m.from === "admin" && m.by ? `${m.by} · ` : ""}
                {formatOfferDeadlineLv(m.at)}
              </small>
            </div>
            {m.text ? <p className="pd-msg-t">{m.text}</p> : <p className="pd-msg-t pd-mu">Bez iemesla</p>}
            {m.from === "client" && m.kind === "question" ? (
              <div className="pd-msg-ans">
                {answer ? <small className="pd-msg-done">{irissPdAnsweredLabel(answer)}</small> : null}
                {onSetAnswered ? (
                  <button type="button" className="pd-btn s" disabled={busy} onClick={() => onSetAnswered(m, !answer)}>
                    {answer ? "Atjaunot kā neatbildētu" : "Atzīmēt kā atbildētu"}
                  </button>
                ) : null}
              </div>
            ) : null}
            {m.from === "admin" ? (
              <div className="pd-acts">
                {onToggleVisible ? (
                  <button type="button" className="pd-btn s" disabled={busy} onClick={() => onToggleVisible(m)}>
                    {m.public ? "Paslēpt no klienta" : "Rādīt klientam saitē"}
                  </button>
                ) : null}
                {onCopy ? (
                  <button type="button" className="pd-btn s" onClick={() => onCopy(m)}>
                    {copiedId === m.id ? "Nokopēts" : "Kopēt tekstu"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      <div className="pd-fld" style={{ marginTop: 10 }}>
        <label htmlFor="pd-msg-note">Atbilde / piezīme</label>
        <textarea id="pd-msg-note" maxLength={IRISS_PD_NOTE_MAX} value={draft} onChange={(e) => onDraft?.(e.target.value)} />
      </div>
      <label className="pd-msg-pub" htmlFor="pd-msg-public">
        <input id="pd-msg-public" type="checkbox" checked={showClient} onChange={(e) => onShowClient?.(e.target.checked)} />
        Rādīt klientam saitē
      </label>
      <p className="pd-hint">
        {showClient
          ? "Klients redzēs atbildi, atverot savu piedāvājuma saiti. E-pasts vai ziņa netiek sūtīta - saiti vari nosūtīt pats."
          : "Tikai iekšēji - klientam netiek sūtīta un saitē nav redzama. Atbildi klientam nosūti pats."}
      </p>
      {err ? (
        <p className="pd-err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="pd-acts" style={{ marginTop: 8 }}>
        <button type="button" className="pd-btn p" disabled={busy || !draft.trim()} onClick={onSave}>
          {busy ? "Saglabā..." : showClient ? "Saglabāt un rādīt klientam" : "Saglabāt piezīmi"}
        </button>
      </div>
    </div>
  );
}

export function PdClientMessages({
  id,
  messages,
  onRecord,
}: {
  id: string;
  messages: readonly IrissPdMessage[];
  onRecord: (rec: unknown) => void;
}) {
  const [draft, setDraft] = useState("");
  const [showClient, setShowClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function post(payload: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/iriss-piedavajumi/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; record?: unknown; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās saglabāt.");
      onRecord(data.record);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās saglabāt.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft.trim()) return;
    if (await post({ action: "note", text: draft, public: showClient })) {
      setDraft("");
      setShowClient(false);
    }
  }

  return (
    <PdClientMessagesView
      messages={messages}
      draft={draft}
      showClient={showClient}
      busy={busy}
      err={err}
      onDraft={setDraft}
      onShowClient={setShowClient}
      onSave={() => void save()}
      copiedId={copiedId}
      onToggleVisible={(m) => {
        if (!m.public && !window.confirm("Rādīt šo atbildi klientam piedāvājuma saitē?")) return;
        void post({ action: "note-visibility", messageId: m.id, public: !m.public });
      }}
      onSetAnswered={(m, answered) => void post({ action: "question-answered", messageId: m.id, answered })}
      onCopy={(m) =>
        void copyText(m.text).then((ok) => {
          if (ok) setCopiedId(m.id);
        })
      }
    />
  );
}
