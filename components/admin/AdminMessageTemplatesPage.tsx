"use client";

import { AdminSaveButton, useSaveMessageState } from "@/components/admin/AdminSaveButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminProvinTiptapEditor,
  type AdminProvinTiptapEditorHandle,
} from "@/components/admin/AdminProvinTiptapEditor";
import { adminTiptapPlainPreview } from "@/lib/admin-tiptap/storage-format";
import { renderTemplateString, renderTemplateSubject } from "@/lib/messages/render-template";
import {
  enrichVarsWithSharedBlocks,
  messageTemplatesDocFromOverrides,
} from "@/lib/messages/shared-block-vars";
import { previewMessage, validateMessageOverride } from "@/lib/messages/resolve-message";
import type { MessageChannel, MessageTemplateDef } from "@/lib/messages/types";

type TemplateRow = MessageTemplateDef & {
  overridden: boolean;
  override: { subject?: string; body: string; updatedAt: string; updatedBy: string } | null;
};

type HistoryEntry = {
  ts: number;
  body: string;
  subject?: string;
  updatedAt: string;
  updatedBy: string;
};

const CHANNELS: { key: MessageChannel; label: string }[] = [
  { key: "email", label: "E-pasts" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "iriss", label: "IRISS" },
  { key: "block", label: "Kopīgie bloki" },
];

export function AdminMessageTemplatesPage() {
  const bodyEditorRef = useRef<AdminProvinTiptapEditorHandle | null>(null);
  const [channel, setChannel] = useState<MessageChannel>("email");
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const templateSaveState = useSaveMessageState(status, busy);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPreviewTs, setHistoryPreviewTs] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/message-templates", { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { templates: TemplateRow[]; counts: Record<string, number> };
    setCounts(data.counts);
    setRows(data.templates);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const channelRows = useMemo(() => rows.filter((r) => r.channel === channel), [rows, channel]);

  const groups = useMemo(() => {
    const m = new Map<string, TemplateRow[]>();
    for (const r of channelRows) {
      const g = m.get(r.group) ?? [];
      g.push(r);
      m.set(r.group, g);
    }
    return [...m.entries()];
  }, [channelRows]);

  const selected = useMemo(
    () => channelRows.find((r) => r.id === selectedId) ?? channelRows[0] ?? null,
    [channelRows, selectedId],
  );

  const templatesDoc = useMemo(() => {
    const overrides: Record<string, { subject?: string; body: string; updatedAt: string; updatedBy: string }> =
      {};
    for (const r of rows) {
      if (r.override) overrides[r.id] = r.override;
    }
    if (selected?.channel === "block") {
      overrides[selected.id] = {
        body,
        subject: selected.subject != null ? subject : undefined,
        updatedAt: "",
        updatedBy: "",
      };
    }
    return messageTemplatesDocFromOverrides(overrides);
  }, [rows, selected?.id, selected?.channel, body, subject]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    const o = selected.override;
    setSubject(o?.subject ?? selected.subject ?? "");
    setBody(o?.body ?? selected.body);
    setErr(null);
    setStatus(null);
    setHistoryPreviewTs(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    void (async () => {
      const res = await fetch(`/api/admin/message-templates/${encodeURIComponent(selected.id)}/history`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setHistory([]);
        return;
      }
      const data = (await res.json()) as { history?: HistoryEntry[] };
      setHistory(Array.isArray(data.history) ? data.history : []);
    })();
  }, [selected?.id, status]);

  const validation = useMemo(() => {
    if (!selected) return { ok: true as const, errors: [] as string[] };
    const v = validateMessageOverride(selected.id, { subject, body });
    return v.ok ? { ok: true as const, errors: [] } : { ok: false as const, errors: v.errors };
  }, [selected, subject, body]);

  const preview = useMemo(() => {
    if (!selected) return null;
    const partial = Object.fromEntries(selected.vars.map((v) => [v.key, v.sample]));
    return previewMessage(selected.id, partial, templatesDoc);
  }, [selected, templatesDoc]);

  const previewRendered = useMemo(() => {
    if (!selected) return null;
    const partial: Record<string, string> = {};
    for (const v of selected.vars) partial[v.key] = v.sample;
    const merged = enrichVarsWithSharedBlocks(partial, templatesDoc);
    const bodyForRender = adminTiptapPlainPreview(body);
    const text = renderTemplateString(bodyForRender, merged);
    const subj = selected.subject != null ? renderTemplateSubject(subject, merged) : undefined;
    return { text, subject: subj };
  }, [selected, body, subject, templatesDoc]);

  const editorMode = selected?.channel === "whatsapp" ? "plain" : "rich";

  const save = async () => {
    if (!selected || !validation.ok) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/message-templates/${encodeURIComponent(selected.id)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: selected.subject != null ? subject : undefined, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(Array.isArray(data.details) ? data.details.join(" ") : data.error ?? "Kļūda");
        return;
      }
      setStatus("Saglabāts");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await fetch(`/api/admin/message-templates/${encodeURIComponent(selected.id)}/reset`, {
        method: "POST",
        credentials: "include",
      });
      setStatus("Atjaunots noklusējums");
      await load();
      setSubject(selected.subject ?? "");
      setBody(selected.body);
    } finally {
      setBusy(false);
    }
  };

  const restoreHistory = async (ts: number) => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/message-templates/${encodeURIComponent(selected.id)}/history/${ts}/restore`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(Array.isArray(data.details) ? data.details.join(" ") : data.error ?? "Atjaunošana neizdevās");
        return;
      }
      setStatus("Versija atjaunota");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const historyPreview = useMemo(
    () => history.find((h) => h.ts === historyPreviewTs) ?? null,
    [history, historyPreviewTs],
  );

  const testSend = async () => {
    if (!selected || selected.channel !== "email") return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/message-templates/${encodeURIComponent(selected.id)}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, text: previewRendered?.text ?? body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Tests neizdevās");
        return;
      }
      setStatus(`Tests nosūtīts uz ${data.to ?? "admin e-pastu"}`);
    } finally {
      setBusy(false);
    }
  };

  const tabCount = (key: MessageChannel) => counts[key] ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 md:px-8">
      <h1 className="text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Tekstu šabloni</h1>
      <p className="mt-1 text-[14px] text-[#8e8e93]">
        Visi automātiskie un iepriekš aizpildītie teksti. Ja tekstu nemaini, tiek lietots noklusējums no koda.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setChannel(c.key);
              setSelectedId(null);
            }}
            className={`rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
              channel === c.key
                ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                : "border-[#e5e5ea] bg-white text-[#3a3a3c] hover:bg-[#f5f5f7]"
            }`}
          >
            {c.label}
            <span className={`ml-1.5 tabular-nums ${channel === c.key ? "text-[#aaa]" : "text-[#8e8e93]"}`}>
              {tabCount(c.key)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[290px_1fr_400px]">
        <div className="rounded-[14px] border border-[#e5e5ea] bg-white p-4">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-3">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">{group}</p>
              {items.map((it) => {
                const on = selected?.id === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13.5px] ${
                      on ? "bg-[#f2f2f7] font-semibold" : "hover:bg-[#f9f9fb]"
                    }`}
                  >
                    <span className="min-w-0 truncate">{it.title}</span>
                    <span className="ml-2 flex shrink-0 gap-1">
                      {it.overridden ? (
                        <span className="rounded-md bg-[#eef4ff] px-1.5 py-0.5 text-[10.5px] font-medium text-[#0a66d8]">
                          mainīts
                        </span>
                      ) : null}
                      {it.tags?.includes("auto") ? (
                        <span className="text-[10.5px] text-[#8e8e93]">{it.tags.includes("4 valodas") ? "4 val." : "auto"}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="rounded-[14px] border border-[#e5e5ea] bg-white p-4">
          {selected ? (
            <>
              {selected.subject != null ? (
                <>
                  <label className="text-[12px] text-[#8e8e93]">Temats</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mb-3 mt-1 w-full rounded-[10px] border border-[#d2d2d7] bg-[#fbfbfd] px-3 py-2.5 text-[14px]"
                  />
                </>
              ) : null}
              <label className="text-[12px] text-[#8e8e93]">Teksts</label>
              <div className="mt-1">
                <AdminProvinTiptapEditor
                  ref={bodyEditorRef}
                  value={body}
                  onChange={setBody}
                  mode={editorMode}
                  enableHeadings={selected.channel === "email"}
                  placeholder="Šablona teksts…"
                  aria-label="Šablona teksts"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.vars.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => bodyEditorRef.current?.insertAtCursor(`{{${v.key}}}`)}
                    className={`rounded-full border px-2.5 py-1 text-[12px] ${
                      v.required ? "border-[#0a84ff] text-[#0a66d8]" : "border-[#d2d2d7] text-[#3a3a3c]"
                    }`}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <AdminSaveButton
                  onSave={() => void save()}
                  state={templateSaveState}
                  disabled={!validation.ok}
                  dirty
                  shortcut
                />
                <button
                  type="button"
                  disabled={busy || selected.channel !== "email"}
                  onClick={() => void testSend()}
                  className="rounded-[10px] border border-[#d2d2d7] bg-white px-4 py-2 text-[13px]"
                >
                  Sūtīt testu sev
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void reset()}
                  className="rounded-[10px] border border-[#d2d2d7] bg-white px-4 py-2 text-[13px]"
                >
                  Atjaunot noklusējumu
                </button>
                {validation.ok ? (
                  <span className="ml-auto text-[12px] text-[#34c759]">✓ Visi mainīgie derīgi</span>
                ) : (
                  <span className="ml-auto text-[12px] text-red-600">{validation.errors.join(" · ")}</span>
                )}
              </div>
              {status ? <p className="mt-2 text-[12px] text-[#6e6e73]">{status}</p> : null}
              {err ? <p className="mt-2 text-[12px] text-red-600">{err}</p> : null}
              {selected.override ? (
                <p className="mt-3 text-[12px] text-[#6e6e73]">
                  Pēdējā saglabāšana: {new Date(selected.override.updatedAt).toLocaleString("lv-LV")} ·{" "}
                  {selected.override.updatedBy}
                </p>
              ) : (
                <p className="mt-3 text-[12px] text-[#6e6e73]">Noklusējums (kods)</p>
              )}
              {history.length > 0 ? (
                <div className="mt-4 rounded-[10px] border border-[#e5e5ea] bg-[#fbfbfd] p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">
                    Versiju vēsture (Blob)
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto">
                    {history.map((h) => (
                      <li key={h.ts} className="flex flex-wrap items-center gap-2 text-[12px] text-[#3a3a3c]">
                        <span className="tabular-nums">{new Date(h.ts).toLocaleString("lv-LV")}</span>
                        <span className="text-[#8e8e93]">{h.updatedBy}</span>
                        <button
                          type="button"
                          className="rounded-md border border-[#d2d2d7] px-2 py-0.5 text-[11px]"
                          onClick={() => setHistoryPreviewTs(h.ts)}
                        >
                          Priekšskatīt
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-md border border-[#0a84ff] px-2 py-0.5 text-[11px] text-[#0a66d8]"
                          onClick={() => void restoreHistory(h.ts)}
                        >
                          Atjaunot
                        </button>
                      </li>
                    ))}
                  </ul>
                  {historyPreview ? (
                    <div className="mt-3 rounded-lg border border-[#d2d2d7] bg-white p-2.5">
                      <p className="mb-1 text-[11px] text-[#8e8e93]">
                        Priekšskatījums ({new Date(historyPreview.ts).toLocaleString("lv-LV")})
                      </p>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed">
                        {historyPreview.body}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[14px] text-[#8e8e93]">Izvēlies šablonu sarakstā.</p>
          )}
        </div>

        <div className="rounded-[14px] border border-[#e5e5ea] bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#8e8e93]">
            <span>Priekšskatījums</span>
            <span>kopīgie bloki no aktuālā saglabājuma</span>
          </div>
          {selected?.channel === "email" ? (
            <div className="overflow-hidden rounded-xl border border-[#e5e5ea]">
              <div className="border-b border-[#eee] bg-[#fafafa] px-3.5 py-2.5 text-[12px] text-[#6e6e73]">
                Temats: <strong className="text-[#1d1d1f]">{previewRendered?.subject ?? preview?.subject ?? "-"}</strong>
              </div>
              <div className="whitespace-pre-wrap p-4 text-[13.5px] leading-relaxed text-[#1d1d1f]">
                {previewRendered?.text ?? preview?.text ?? ""}
              </div>
            </div>
          ) : null}
          {selected?.channel === "whatsapp" || selected?.channel === "email" ? (
            <div className="mt-3 rounded-xl bg-[#efeae2] p-3">
              <p className="mb-2 text-[12px] text-[#8e8e93]">WhatsApp teksts</p>
              <div className="ml-auto max-w-[92%] whitespace-pre-wrap rounded-[10px] bg-[#dcf8c6] p-3 text-[12.5px] leading-relaxed">
                {previewRendered?.text ?? preview?.text ?? ""}
              </div>
            </div>
          ) : null}
          {selected?.channel === "iriss" || selected?.channel === "block" ? (
            <div className="whitespace-pre-wrap rounded-xl border border-[#e5e5ea] p-4 text-[13px] leading-relaxed">
              {previewRendered?.text ?? preview?.text ?? ""}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
