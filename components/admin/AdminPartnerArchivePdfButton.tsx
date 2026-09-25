"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

export function AdminPartnerArchivePdfButton({ sessionId }: { sessionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setOk("");
    setErr("");
    try {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("reportPdf", file, file.name || "PROVIN_BUSINESS.pdf");
      const res = await fetch("/api/admin/partner-client-report", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setErr(data.message || data.error || "Neizdevās saglabāt PDF.");
        return;
      }
      setOk("PDF ir partnera arhīvā pie šī pasūtījuma.");
    } catch {
      setErr("Tīkla kļūda. Mēģini vēlreiz.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={busy}
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-md border border-violet-700/25 bg-violet-50/90 px-2 py-1 text-[10px] font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100/95 disabled:opacity-50"
        title="Ielikt PDF partnera profilā pie šī pasūtījuma (bez e-pasta)"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : (
          <FileUp className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
        )}
        Ielikt PDF arhīvā
      </button>
      {ok ? (
        <span className="max-w-[14rem] text-right text-[10px] font-medium leading-snug text-emerald-800" role="status">
          {ok}
        </span>
      ) : null}
      {err ? (
        <span className="max-w-[14rem] text-right text-[10px] font-medium leading-snug text-amber-800" role="alert">
          {err}
        </span>
      ) : null}
    </span>
  );
}
