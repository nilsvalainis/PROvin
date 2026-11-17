"use client";

import { useRef, useState } from "react";

/** iPhone / iPad (arī iPadOS, kas sakās par Mac). */
function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
}

/** Vai pārlūks prot dalīties ar PDF failu (iOS Safari 15+, Android Chrome). Pārbaude sinhrona - lietotāja žests saglabājas. */
export function canShareWaybillPdfFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof File === "undefined") return false;
  try {
    return navigator.canShare({ files: [new File([""], "pavadzime.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

export type WaybillPdfSaveMode = "share" | "open" | "download";

/** iPhone: kopīgošanas logs ar failu; ja nevar - PDF jaunā cilnē ("Saglabāt failos"); dators: lejupielāde. */
export function waybillPdfSaveMode(env: { ios: boolean; canShareFiles: boolean }): WaybillPdfSaveMode {
  if (env.ios) return env.canShareFiles ? "share" : "open";
  return "download";
}

/**
 * "Saglabāt PDF" - tikai izdotai pavadzīmei (rāda tikai, ja serveris atbildē ielicis `canSavePdf`).
 * PDF nāk no `/api/admin/iriss/waybill-requests/<id>/pdf` (piekļuvi pārbauda serveris).
 */
export function IrissWaybillSavePdfButton({
  href,
  fileName,
  className,
  label = "Saglabāt PDF",
}: {
  href: string;
  fileName: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "again" | "error">("idle");
  const cached = useRef<File | null>(null);

  const download = () => {
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: fileName.replace(/\.pdf$/i, "") });
      setState("idle");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") setState("idle");
      // Safari: ielāde aizņēma par ilgu un žests beidzies - otrais pieskāriens dalās uzreiz ar jau ielādēto failu.
      else if (name === "NotAllowedError") setState("again");
      else setState("error");
    }
  };

  const onClick = async () => {
    if (state === "busy") return;
    const mode = waybillPdfSaveMode({ ios: isIos(), canShareFiles: canShareWaybillPdfFiles() });
    if (mode === "download") {
      download();
      return;
    }
    if (mode === "open") {
      window.open(`${href}${href.includes("?") ? "&" : "?"}inline=1`, "_blank", "noopener,noreferrer");
      return;
    }
    if (cached.current) {
      await share(cached.current);
      return;
    }
    setState("busy");
    try {
      const res = await fetch(href, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("pdf");
      const blob = await res.blob();
      cached.current = new File([blob], fileName, { type: "application/pdf" });
      await share(cached.current);
    } catch {
      setState("error");
    }
  };

  const text =
    state === "busy" ? "Ielādē PDF..." : state === "again" ? "Pieskaries vēlreiz" : state === "error" ? "Neizdevās - mēģini vēlreiz" : label;
  return (
    <button type="button" className={className} onClick={() => void onClick()} disabled={state === "busy"} aria-label={`${label}: ${fileName}`}>
      {text}
    </button>
  );
}
