"use client";

import { useState } from "react";
import { copyText } from "@/components/admin/iriss-piedavajumi/pd-actions";
import { formatOfferDeadlineLv } from "@/lib/iriss-offer-valid-until";
import { irissPdOpenQuestionCount } from "@/lib/iriss-piedavajumi-messages";
import { IRISS_PD_NOTE_MAX, type IrissPdMessage } from "@/lib/iriss-piedavajumi-types";

const KIND_LV: Record<IrissPdMessage["kind"], string> = {
  question: "Klienta jautājums",
  decline: "Klients noraidīja",
  note: "Piezīme (iekšēja)",
};

/**
 * Nils 07.11: klienta ziņas no saites (jautājumi, noraidījuma iemesls) + admina atbilde kā iekšēja piezīme.
 * Klientam nekas automātiski netiek sūtīts - atbildi var nokopēt un nosūtīt pats (WhatsApp / e-pasts).
 */
export function PdClientMessagesView({
  messages,
  draft,
  busy,
  err,
  onDraft,
  onSave,
  onCopy,
  copiedId,
}: {
  messages: readonly IrissPdMessage[];
  draft: string;
  busy: boolean;
  err: string;
  onDraft?: (v: string) => void;
  onSave?: () => void;
  onCopy?: (m: IrissPdMessage) => void;
  copiedId?: string;
}) {
  const open = irissPdOpenQuestionCount(messages);
  return (
    <div className="pd-msgs">
      {messages.length === 0 ? <p className="pd-hint">Klients vēl nav rakstījis.</p> : null}
      {open > 0 ? <p className="pd-msg-open">Neatbildēti jautājumi: {open}</p> : null}
      {[...messages].reverse().map((m) => (
        <div key={m.id} className={`pd-msg ${m.from === "admin" ? "admin" : "client"} k-${m.kind}`}>
          <div className="pd-msg-h">
            <b>{KIND_LV[m.kind]}</b>
            <small>
              {m.from === "admin" && m.by ? `${m.by} · ` : ""}
              {formatOfferDeadlineLv(m.at)}
            </small>
          </div>
          {m.text ? <p className="pd-msg-t">{m.text}</p> : <p className="pd-msg-t pd-mu">Bez iemesla</p>}
          {m.from === "admin" && onCopy ? (
            <button type="button" className="pd-btn s" onClick={() => onCopy(m)}>
              {copiedId === m.id ? "Nokopēts" : "Kopēt tekstu"}
            </button>
          ) : null}
        </div>
      ))}
      <div className="pd-fld" style={{ marginTop: 10 }}>
        <label htmlFor="pd-msg-note">Atbilde / piezīme</label>
        <textarea id="pd-msg-note" maxLength={IRISS_PD_NOTE_MAX} value={draft} onChange={(e) => onDraft?.(e.target.value)} />
      </div>
      <p className="pd-hint">Tikai iekšēji - klientam netiek sūtīta un saitē nav redzama. Atbildi klientam nosūti pats.</p>
      {err ? (
        <p className="pd-err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="pd-acts" style={{ marginTop: 8 }}>
        <button type="button" className="pd-btn p" disabled={busy || !draft.trim()} onClick={onSave}>
          {busy ? "Saglabā..." : "Saglabāt piezīmi"}
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function save() {
    if (busy || !draft.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/iriss-piedavajumi/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "note", text: draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; record?: unknown; message?: string };
      if (!data.ok || !data.record) throw new Error(data.message || "Neizdevās saglabāt.");
      setDraft("");
      onRecord(data.record);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās saglabāt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PdClientMessagesView
      messages={messages}
      draft={draft}
      busy={busy}
      err={err}
      onDraft={setDraft}
      onSave={() => void save()}
      copiedId={copiedId}
      onCopy={(m) =>
        void copyText(m.text).then((ok) => {
          if (ok) setCopiedId(m.id);
        })
      }
    />
  );
}
