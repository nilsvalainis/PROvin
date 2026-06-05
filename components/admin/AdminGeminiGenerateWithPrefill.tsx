"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";

import { AdminGeminiGenerateButton } from "@/components/admin/AdminGeminiGenerateButton";
import type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";

type Props = {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  demoOnly?: boolean;
  title?: string;
  dialogTitle?: string;
  dialogHint?: string;
  onGenerate: (operatorNotes: string, modelTier: GeminiAdminModelTier) => void | Promise<void>;
};

export function AdminGeminiGenerateWithPrefill({
  label,
  disabled,
  busy,
  demoOnly,
  title,
  dialogTitle = "Papildu piezīmes AI",
  dialogHint = "Ievadi korekcijas, papildinājumus vai kontekstu. AI apvienos tos ar automātiski ģenerēto tekstu un esošo melnrakstu.",
  onGenerate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pendingTier, setPendingTier] = useState<GeminiAdminModelTier>("pro");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const openDialog = (tier: GeminiAdminModelTier) => {
    setPendingTier(tier);
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
  };

  const confirm = () => {
    const trimmed = notes.trim();
    setOpen(false);
    setNotes("");
    void onGenerate(trimmed, pendingTier);
  };

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <AdminGeminiGenerateButton
          label={label}
          variant="pro"
          disabled={disabled}
          busy={busy}
          demoOnly={demoOnly}
          title={title}
          onClick={() => openDialog("pro")}
        />
        <AdminGeminiGenerateButton
          label="Flash"
          variant="flash"
          disabled={disabled}
          busy={busy}
          demoOnly={demoOnly}
          onClick={() => openDialog("flash")}
        />
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start gap-2">
              <MessageSquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
              <div>
                <h3 id={titleId} className="text-sm font-semibold text-[var(--color-apple-text)]">
                  {dialogTitle}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-[var(--color-provin-muted)]">{dialogHint}</p>
                <p className="mt-1 text-[10px] font-medium text-[var(--color-provin-muted)]">
                  Modelis: {pendingTier === "flash" ? "Gemini 2.5 Flash" : "Gemini 2.5 Pro"}
                </p>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="mb-3 min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="Piem., ņem vērā LTAB negadījumu 2022; paskaidro odometra kritumu; pievieno manu secinājumu par pārdevēju…"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 8000))}
              disabled={busy}
              aria-label="Papildu piezīmes AI ģenerēšanai"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={busy}
                onClick={close}
              >
                Atcelt
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50 ${
                  pendingTier === "flash" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-violet-600 hover:bg-violet-700"
                }`}
                disabled={busy}
                onClick={confirm}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {pendingTier === "flash" ? "Ģenerēt (Flash)" : "Ģenerēt (Pro)"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
