"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

import { uploadNotifyPortfolioBlobs } from "@/lib/admin-notify-upload-portfolio-client";
import {
  PARTNER_ARCHIVE_DIRECT_MAX_BYTES,
  PARTNER_ARCHIVE_PDF_MAX_BYTES,
  partnerArchiveErrorMessage,
  partnerArchiveTooLargeMessage,
} from "@/lib/partner-archive-pdf-upload";

export function AdminPartnerArchivePdfButton({
  sessionId,
  compact = false,
  variant = "button",
}: {
  sessionId: string;
  compact?: boolean;
  /** «link» - maza pelēka saite (pasūtījumu saraksta summas šūnā). */
  variant?: "button" | "link";
}) {
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
      if (file.size > PARTNER_ARCHIVE_PDF_MAX_BYTES) {
        setErr(partnerArchiveTooLargeMessage(file.size));
        return;
      }
      const name = file.name || "PROVIN_BUSINESS.pdf";
      let res: Response;
      try {
        // Caur Vercel Blob - API ķermenis ~4,5 MB, lielāki PDF agrāk krita ar 413.
        const [ref] = await uploadNotifyPortfolioBlobs({
          sessionId,
          files: [{ blob: file, filename: name, mime: "application/pdf" }],
        });
        res = await fetch("/api/admin/partner-client-report", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, blobUrl: ref!.url, filename: name }),
        });
      } catch (blobErr) {
        if (file.size > PARTNER_ARCHIVE_DIRECT_MAX_BYTES) throw blobErr;
        // Rezerve maziem failiem (Blob nav pieejams).
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("reportPdf", file, name);
        res = await fetch("/api/admin/partner-client-report", { method: "POST", credentials: "include", body: fd });
      }
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        setErr(partnerArchiveErrorMessage(res.status, data, file.size));
        return;
      }
      setOk("PDF ir partnera arhīvā pie šī pasūtījuma.");
    } catch {
      setErr("PDF neizdevās augšupielādēt (tīkls vai failu krātuve). Mēģini vēlreiz.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <span className={`inline-flex flex-col ${compact ? "items-stretch" : "items-end"} gap-0.5`}>
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
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className={
          variant === "link"
            ? "inline-flex items-center !rounded-none !border-0 bg-transparent p-0 whitespace-nowrap text-[11.5px] font-medium leading-tight text-[#6e6e73] underline underline-offset-2 transition hover:text-[#1d1d1f] disabled:opacity-50"
            : compact
            ? "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border border-violet-700/25 bg-violet-50/90 px-2.5 py-1.5 text-[10px] font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100/95 disabled:opacity-50"
            : "inline-flex items-center gap-1 rounded-md border border-violet-700/25 bg-violet-50/90 px-2 py-1 text-[10px] font-semibold text-violet-950 shadow-sm transition hover:bg-violet-100/95 disabled:opacity-50"
        }
        title="Ielikt PDF partnera profilā pie šī pasūtījuma (bez e-pasta)"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : variant === "link" ? null : (
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
