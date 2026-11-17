"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";

export type SendReportKind = "audits" | "business" | "dealer" | "asv";

export const SEND_REPORT_KIND_LV: Record<SendReportKind, string> = {
  audits: "PROVIN AUDITS",
  business: "BUSINESS",
  dealer: "Dīlera dati",
  asv: "ASV vēsture",
};

const LANG_LV: Record<ClientReportLang, string> = { lv: "Latviešu", en: "Angļu", ru: "Krievu", de: "Vācu" };

export type SendReportPrepared = { pdfPathname: string; downloadUrl: string; filename: string; bytes: number };
export type SendReportResult = {
  sentTo: string;
  version: number;
  dropboxPath?: string;
  dropboxError?: string;
  completedAt?: string | null;
};

/**
 * "Sūtīt atskaiti" (2. posms, Nils 17.11): veids, valoda, pielikumu ķekši -> PDF serverī -> "Skatīt PDF" -> sūtīt.
 * Pēc sūtīšanas: versija, Dropbox, "Izpildīts" ar 30 s "Atsaukt", WhatsApp ziņa.
 * Valodas izvēle tikai dīlera datiem un B2B (G2); Google atsauksme noklusējumā izslēgta (G6).
 */
export function AdminSendReportDialog({
  open,
  onClose,
  dark,
  email,
  defaultKind,
  b2b,
  attachments,
  whatsappHref,
  prepare,
  send,
  undoComplete,
}: {
  open: boolean;
  onClose: () => void;
  dark: boolean;
  email: string;
  defaultKind: SendReportKind;
  b2b: boolean;
  attachments: ReadonlyArray<{ id: string; name: string; size: number }>;
  whatsappHref: string | null;
  prepare: (kind: SendReportKind, lang: ClientReportLang) => Promise<SendReportPrepared>;
  send: (input: {
    prepared: SendReportPrepared;
    lang: ClientReportLang;
    attachmentIds: string[];
    includeGoogleReview: boolean;
    markComplete: boolean;
    saveDropbox: boolean;
  }) => Promise<SendReportResult>;
  undoComplete: () => Promise<void>;
}) {
  const [kind, setKind] = useState<SendReportKind>(defaultKind);
  const [lang, setLang] = useState<ClientReportLang>("lv");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [google, setGoogle] = useState(false);
  const [markComplete, setMarkComplete] = useState(true);
  const [saveDropbox, setSaveDropbox] = useState(true);
  const [phase, setPhase] = useState<"idle" | "preparing" | "ready" | "sending" | "sent">("idle");
  const [prepared, setPrepared] = useState<SendReportPrepared | null>(null);
  const [result, setResult] = useState<SendReportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const [undone, setUndone] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setLang("lv");
    setPicked(new Set(attachments.map((a) => a.id)));
    setGoogle(false);
    setMarkComplete(true);
    setSaveDropbox(true);
    setPhase("idle");
    setPrepared(null);
    setResult(null);
    setErr(null);
    setUndone(false);
    setUndoLeft(0);
    // Atverot tikai; pielikumu saraksts dialoga laikā nemainās.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (undoLeft <= 0) return;
    timer.current = window.setTimeout(() => setUndoLeft((n) => n - 1), 1000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [undoLeft]);

  if (!open || typeof document === "undefined") return null;

  const langSelectable = kind === "dealer" || b2b;
  const effLang: ClientReportLang = langSelectable ? lang : "lv";
  const busy = phase === "preparing" || phase === "sending";
  // Izvēle mainīta pēc PDF sagatavošanas: PDF jāveido no jauna.
  const reset = () => {
    setPrepared(null);
    if (phase === "ready") setPhase("idle");
  };

  const doPrepare = async () => {
    setErr(null);
    setPhase("preparing");
    try {
      const p = await prepare(kind, effLang);
      setPrepared(p);
      setPhase("ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās sagatavot PDF");
      setPhase("idle");
    }
  };

  const doSend = async () => {
    if (!prepared) return;
    setErr(null);
    setPhase("sending");
    try {
      const r = await send({ prepared, lang: effLang, attachmentIds: [...picked], includeGoogleReview: google, markComplete, saveDropbox });
      setResult(r);
      setPhase("sent");
      if (r.completedAt) setUndoLeft(30);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās nosūtīt");
      setPhase("ready");
    }
  };

  const doUndo = async () => {
    setUndoLeft(0);
    try {
      await undoComplete();
      setUndone(true);
    } catch {
      setErr("Neizdevās atsaukt atzīmi «Izpildīts».");
    }
  };

  const label = "text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]";
  const chip = (on: boolean) =>
    `rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${
      on ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[var(--admin-border-subtle)] text-[var(--color-apple-text)]"
    }`;
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

  return createPortal(
    <div
      className={`admin-order-page fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-3 ${dark ? "dark" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-report-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--admin-border-subtle)] px-4 pb-3 pt-4">
          <h3 id="send-report-title" className="text-sm font-semibold text-[var(--color-apple-text)]">
            Sūtīt atskaiti
          </h3>
          <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">
            Uz: <b className="text-[var(--color-apple-text)]">{email || "nav e-pasta"}</b>
          </p>
        </div>

        {phase === "sent" && result ? (
          <div className="space-y-2 px-4 py-4 text-[13px] text-[var(--color-apple-text)]" data-send-report="sent">
            <p className="font-semibold">
              Nosūtīts uz {result.sentTo} · versija {result.version}
              {result.version > 1 ? " (labota)" : ""}
            </p>
            <p className="text-[12px] text-[var(--color-provin-muted)]">
              {result.dropboxPath ? `Dropbox: ${result.dropboxPath}` : `Dropbox: ${result.dropboxError ?? "nav saglabāts"}`}
            </p>
            {result.completedAt ? (
              <p className="flex items-center gap-2 text-[12px]">
                {undone ? "Atzīme «Izpildīts» atsaukta." : "Pasūtījums atzīmēts «Izpildīts»."}
                {!undone && undoLeft > 0 ? (
                  <button type="button" className="rounded-lg border border-[var(--admin-border-subtle)] px-2 py-1 font-semibold" onClick={() => void doUndo()}>
                    Atsaukt ({undoLeft})
                  </button>
                ) : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25d366] px-3 py-2 text-[13px] font-semibold text-white">
                  WhatsApp: atskaite nosūtīta
                </a>
              ) : null}
              <button type="button" className="rounded-lg border border-[var(--admin-border-subtle)] px-3 py-2 text-[13px] font-semibold" onClick={onClose}>
                Aizvērt
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <p className={label}>Atskaite</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.keys(SEND_REPORT_KIND_LV) as SendReportKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={busy}
                      className={chip(kind === k)}
                      aria-pressed={kind === k}
                      onClick={() => {
                        setKind(k);
                        reset();
                      }}
                    >
                      {SEND_REPORT_KIND_LV[k]}
                    </button>
                  ))}
                </div>
              </div>

              {langSelectable ? (
                <label className="block">
                  <span className={label}>Valoda (atskaite un e-pasts)</span>
                  <select
                    className="mt-1.5 block w-full rounded-lg border border-[var(--admin-border-subtle)] bg-transparent px-2.5 py-2 text-[13px]"
                    value={lang}
                    disabled={busy}
                    onChange={(e) => {
                      setLang(e.target.value as ClientReportLang);
                      reset();
                    }}
                  >
                    {CLIENT_REPORT_LANGS.map((l) => (
                      <option key={l} value={l}>
                        {LANG_LV[l]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div>
                <p className={label}>Pielikumi</p>
                {attachments.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <label className="flex items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={picked.has(a.id)}
                            onChange={(e) =>
                              setPicked((cur) => {
                                const n = new Set(cur);
                                if (e.target.checked) n.add(a.id);
                                else n.delete(a.id);
                                return n;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                          <span className="shrink-0 text-[11px] text-[var(--color-provin-muted)]">{mb(a.size)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Tikai atskaites PDF (pielikumu nav).</p>
                )}
              </div>

              <div className="space-y-1.5 text-[13px]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" disabled={busy || b2b} checked={google && !b2b} onChange={(e) => setGoogle(e.target.checked)} />
                  Lūgt Google atsauksmi
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" disabled={busy} checked={saveDropbox} onChange={(e) => setSaveDropbox(e.target.checked)} />
                  Kopija Dropbox /_PROv/
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" disabled={busy} checked={markComplete} onChange={(e) => setMarkComplete(e.target.checked)} />
                  Pēc nosūtīšanas atzīmēt «Izpildīts»
                </label>
              </div>

              {prepared ? (
                <p className="rounded-lg border border-[var(--admin-border-subtle)] px-3 py-2 text-[12px]" data-send-report="ready">
                  PDF gatavs: {prepared.filename} · {mb(prepared.bytes)} ·{" "}
                  <a href={prepared.downloadUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                    Skatīt PDF
                  </a>
                </p>
              ) : null}
              {err ? <p className="text-[12px] font-medium text-red-600">{err}</p> : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--admin-border-subtle)] px-4 py-3">
              <button type="button" disabled={busy} className="rounded-lg border border-[var(--admin-border-subtle)] px-3 py-2 text-[13px] font-semibold" onClick={onClose}>
                Atcelt
              </button>
              {prepared ? (
                <button
                  type="button"
                  disabled={busy || !email}
                  className="rounded-lg bg-[#1d1d1f] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  onClick={() => void doSend()}
                >
                  {phase === "sending" ? "Sūta..." : "Sūtīt klientam"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-[#1d1d1f] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  onClick={() => void doPrepare()}
                >
                  {phase === "preparing" ? "Sagatavo PDF..." : "Sagatavot PDF"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
