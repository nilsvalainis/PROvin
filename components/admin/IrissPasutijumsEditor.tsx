"use client";

import { ArrowLeft, FileDown, Loader2, Paperclip, Phone, Plus, Save, Trash2, X } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import type { IrissOfferAttachment, IrissOfferRecord, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import {
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
} from "@/lib/iriss-listing-links";
import { fileToCompressedOfferAttachment } from "@/lib/iriss-offer-image-compress";
import { patchJsonWithUploadProgress, type JsonPatchResult } from "@/lib/iriss-json-patch-upload";

/** Mobilajā — kvadrātveida FAB (`rounded-xl`); no `sm:` — apaļas pogas ar tekstu. */
const toolbarBtnBase =
  "inline-flex shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50 " +
  "h-12 w-12 shadow-md hover:opacity-95 " +
  "sm:h-11 sm:min-h-[44px] sm:w-auto sm:rounded-full sm:gap-1.5 sm:px-4 sm:shadow-sm sm:hover:opacity-100 sm:active:scale-100";

const fieldClass =
  "min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[16px] text-[var(--color-apple-text)] shadow-sm outline-none transition focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const textareaClass = `${fieldClass} min-h-[100px] resize-y py-2.5 leading-snug`;

const offerPChipButtonClass = `${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} cursor-pointer select-none`;

/** Mobilajā rindā ar P čipiem — tāds pats augstums kā platformu čipiem. */
const headerMobileSaveChipBtnClass =
  `${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} cursor-pointer border border-[var(--color-provin-accent)] ` +
  "bg-transparent text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent)]/8";

const headerMobilePdfChipBtnClass =
  `${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} cursor-pointer border border-[var(--color-provin-accent)]/35 ` +
  "bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent-soft)]";

const offerDialogMainBtnClass =
  "inline-flex min-h-[44px] min-w-[116px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50";

function normalizePhoneForLv(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const cleaned = `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
    if (cleaned.startsWith("+371")) return cleaned;
    return cleaned;
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00371")) return `+${digits.slice(2)}`;
  if (digits.startsWith("371")) return `+${digits}`;
  return `+371${digits}`;
}

function parseRecordFromPatchResponse(data: unknown): IrissPasutijumsRecord | null {
  if (typeof data !== "object" || data === null) return null;
  if (!("record" in data)) return null;
  const r = (data as { record: unknown }).record;
  if (typeof r !== "object" || r === null) return null;
  return r as IrissPasutijumsRecord;
}

type SaveResult = { ok: true } | { ok: false; error: string };

function formatPatchFailureMessage(
  status: number,
  data: unknown,
  responseTextSnippet?: string,
  networkError?: boolean,
): string {
  if (networkError) return "Tīkla kļūda: nav HTTP atbildes (status 0).";
  if (status === 413) {
    return "Kļūda 413: dati pārāk lieli serverim (Payload Too Large). Samaziniet attēlu skaitu / izmēru.";
  }
  if (status === 504 || status === 502) {
    return `Kļūda ${status}: servera noildze vai starpniekservera kļūda.`;
  }
  const parts: string[] = [`Kļūda ${status}`];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string") parts.push(o.error);
    if (typeof o.detail === "string") parts.push(o.detail.slice(0, 220));
  }
  if (responseTextSnippet) parts.push(responseTextSnippet.slice(0, 180));
  return parts.join(" — ");
}

function formatXhrPatchFailure(result: Extract<JsonPatchResult, { ok: false }>): string {
  return formatPatchFailureMessage(result.status, result.data, result.responseTextSnippet, result.networkError);
}

/** PDF no API — slēpts `<a download target="_self">`; mobilajam — `onFallbackLink` atkārtotai lejupielādei. */
async function downloadPdfBlobFromResponse(
  res: Response,
  fallbackName: string,
  onFallbackLink?: (blobUrl: string, fileName: string) => void,
): Promise<void> {
  const cd = res.headers.get("Content-Disposition");
  let name = fallbackName;
  if (cd) {
    const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
    const quoted = /filename="([^"]+)"/i.exec(cd);
    try {
      if (star?.[1]) name = decodeURIComponent(star[1]);
      else if (quoted?.[1]) name = quoted[1];
    } catch {
      /* keep fallback */
    }
  }
  const blob = await res.blob();
  if (blob.size < 32) throw new Error("empty_pdf");
  const objectUrl = URL.createObjectURL(blob);
  const safeName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = safeName;
  a.target = "_self";
  a.rel = "noopener";
  a.hidden = true;
  a.style.cssText = "display:none;position:fixed;left:-9999px;top:0;";
  document.body.appendChild(a);
  try {
    a.click();
  } catch {
    window.location.assign(objectUrl);
  }
  const mobileCoarse =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
  if (mobileCoarse && onFallbackLink) {
    window.setTimeout(() => onFallbackLink(objectUrl, safeName), 400);
  }
  const revokeMs = mobileCoarse && onFallbackLink ? 120_000 : 12_000;
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }, revokeMs);
}

type OfferDraft = {
  id: string;
  title: string;
  brandModel: string;
  year: string;
  mileage: string;
  priceGermany: string;
  comment: string;
  attachments: IrissOfferAttachment[];
  createdAt: string;
};

function newOfferDraft(nextNumber: number): OfferDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: `Piedāvājums ${nextNumber}`,
    brandModel: "",
    year: "",
    mileage: "",
    priceGermany: "",
    comment: "",
    attachments: [],
    createdAt: now,
  };
}

function buildIrissOfferClientShareBody(
  draft: OfferDraft,
  clientFirstName: string,
  clientLastName: string,
): string {
  const name = [clientFirstName, clientLastName].map((s) => s.trim()).filter(Boolean).join(" ");
  const greeting = name ? `Sveiki, ${name}!` : "Sveiki!";
  const vehicle = [draft.brandModel.trim(), draft.year.trim()].filter(Boolean).join(", ");
  return [
    greeting,
    "",
    "Pielikumā nosūtu PDF ar piedāvājumu no PROVIN.LV.",
    ...(vehicle ? [`Objekts: ${vehicle}.`] : []),
    "",
    "Labu dienu,",
    "PROVIN.LV",
  ].join("\n");
}

function buildIrissOfferShareSubject(draft: OfferDraft): string {
  const vehicle = [draft.brandModel.trim(), draft.year.trim()].filter(Boolean).join(", ");
  return `PROVIN.LV — piedāvājums${vehicle ? `: ${vehicle}` : ""}`;
}

function isOfferDraftSyncedWithRecord(draft: OfferDraft, offer: IrissOfferRecord | null): boolean {
  if (!offer) return false;
  if (draft.id !== offer.id) return false;
  if (draft.title !== offer.title) return false;
  if (draft.brandModel !== offer.brandModel) return false;
  if (draft.year !== offer.year) return false;
  if (draft.mileage !== offer.mileage) return false;
  if (draft.priceGermany !== offer.priceGermany) return false;
  if (draft.comment !== offer.comment) return false;
  if (draft.attachments.length !== offer.attachments.length) return false;
  for (let i = 0; i < draft.attachments.length; i += 1) {
    const a = draft.attachments[i];
    const b = offer.attachments[i];
    if (!b) return false;
    if (a.id !== b.id || a.name !== b.name || a.mimeType !== b.mimeType || a.size !== b.size || a.dataUrl !== b.dataUrl) {
      return false;
    }
  }
  return true;
}

function WhatsAppGlyphIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z"
      />
    </svg>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 border-l-4 border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/50 py-2 pl-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-provin-accent)]">
      {children}
    </h2>
  );
}

function LabeledInput({
  label,
  ...rest
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <input className={fieldClass} {...rest} />
    </label>
  );
}

function LabeledTextarea({
  label,
  ...rest
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">{label}</span>
      <textarea className={textareaClass} {...rest} />
    </label>
  );
}

const ADMIN_MAIN_SCROLL_ID = "admin-main-scroll";
const ADMIN_SCROLL_LOCK_CLASS = "admin-scroll-locked";

/** Ilgā piespiešana (~450 ms), tad vilkšana — lai vertikālais skrolls netraucē `Reorder`. */
function IrissOfferAttachmentReorderItem({
  attachment: a,
  onRemove,
}: {
  attachment: IrissOfferAttachment;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = null;
    pressOrigin.current = null;
  }, []);

  const onThumbPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      pressOrigin.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        dragControls.start(e.nativeEvent);
      }, 450);
    },
    [dragControls],
  );

  const onThumbPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const o = pressOrigin.current;
      if (o == null || longPressTimer.current == null) return;
      if (Math.hypot(e.clientX - o.x, e.clientY - o.y) > 12) clearLongPress();
    },
    [clearLongPress],
  );

  return (
    <Reorder.Item
      value={a}
      dragListener={false}
      dragControls={dragControls}
      className="relative shrink-0 touch-none"
      style={{ WebkitTouchCallout: "none" }}
    >
      <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div
          className="absolute inset-0 z-0 cursor-grab touch-none active:cursor-grabbing"
          aria-hidden
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onPointerLeave={(ev) => {
            if (ev.buttons === 0) clearLongPress();
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nav next/image */}
        <img src={a.dataUrl} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
        <button
          type="button"
          title="Noņemt"
          aria-label="Noņemt attēlu"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          className="pointer-events-auto absolute right-0.5 top-0.5 z-[1] inline-flex h-5 min-w-5 items-center justify-center rounded bg-black/55 px-1 text-[10px] font-bold text-white shadow-sm"
        >
          ×
        </button>
      </div>
    </Reorder.Item>
  );
}

export function IrissPasutijumsEditor({ initialRecord }: { initialRecord: IrissPasutijumsRecord }) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissPasutijumsRecord>(initialRecord);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerBusy, setOfferBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [offerDeleteConfirmOpen, setOfferDeleteConfirmOpen] = useState(false);
  const [offerDeleteBusy, setOfferDeleteBusy] = useState(false);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(() => newOfferDraft(1));
  const lastSavedSnapshot = useRef(JSON.stringify(initialRecord));
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);

  type TransferUiState = { title: string; detail: string; pct: number; longWait: boolean };
  const [transferUi, setTransferUi] = useState<TransferUiState | null>(null);
  const transferLongWaitTimer = useRef<number | null>(null);
  const [pdfRetryBar, setPdfRetryBar] = useState<{ href: string; name: string } | null>(null);
  const [orderPdfRetryOpen, setOrderPdfRetryOpen] = useState(false);
  const [offerFilePrepare, setOfferFilePrepare] = useState<{ pct: number; label: string } | null>(null);
  const beginTransfer = useCallback((title: string, detail: string) => {
    if (transferLongWaitTimer.current) window.clearTimeout(transferLongWaitTimer.current);
    setTransferUi({ title, detail, pct: 0, longWait: false });
    transferLongWaitTimer.current = window.setTimeout(() => {
      setTransferUi((u) => (u ? { ...u, longWait: true } : null));
      transferLongWaitTimer.current = null;
    }, 10_000);
  }, []);

  const endTransfer = useCallback(() => {
    if (transferLongWaitTimer.current) window.clearTimeout(transferLongWaitTimer.current);
    transferLongWaitTimer.current = null;
    setTransferUi(null);
  }, []);

  const patch = useCallback(<K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => {
    setRec((r) => ({ ...r, [key]: value }));
  }, []);

  const patchRecord = useCallback((p: Partial<IrissPasutijumsRecord>) => {
    setRec((r) => ({ ...r, ...p }));
  }, []);

  const save = useCallback(
    async (opts?: {
      redirectToList?: boolean;
      silent?: boolean;
      payload?: IrissPasutijumsRecord;
      onUploadProgress?: (loaded: number, total: number) => void;
    }): Promise<SaveResult> => {
      const redirectToList = opts?.redirectToList === true;
      const silent = opts?.silent === true;
      const onUploadProgress = opts?.onUploadProgress;
      const payload = opts?.payload ?? rec;
      const useXhr = Boolean(onUploadProgress) || !silent;

      if (!silent) setBusy(true);
      if (!silent) setSaveMsg(null);
      if (silent && autosaveInFlight.current) return { ok: false, error: "Saglabāšana jau notiek (race)." };
      if (silent) autosaveInFlight.current = true;

      const url = `/api/admin/iriss-pasutijumi/${encodeURIComponent(payload.id)}`;

      const finishOk = (record: IrissPasutijumsRecord | null): SaveResult => {
        if (!silent && record) setRec(record);
        lastSavedSnapshot.current = JSON.stringify(record ?? payload);
        if (redirectToList) {
          router.push("/admin/iriss/pasutijumi");
          router.refresh();
          return { ok: true };
        }
        if (!silent) setSaveMsg("Saglabāts.");
        return { ok: true };
      };

      try {
        if (useXhr) {
          const result = await patchJsonWithUploadProgress(url, payload, onUploadProgress);
          if (!result.ok) {
            const err = formatXhrPatchFailure(result);
            if (!silent) setSaveMsg(err);
            return { ok: false, error: err };
          }
          const record = parseRecordFromPatchResponse(result.data);
          return finishOk(record);
        }

        const res = await fetch(url, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data: unknown = {};
        try {
          if (text) data = JSON.parse(text) as unknown;
        } catch {
          data = {};
        }
        if (!res.ok) {
          const err = formatPatchFailureMessage(res.status, data, text ? text.slice(0, 280) : undefined);
          if (!silent) setSaveMsg(err);
          return { ok: false, error: err };
        }
        const record = parseRecordFromPatchResponse(data);
        return finishOk(record);
      } catch (e) {
        const err = `Tīkla kļūda: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`;
        if (!silent) setSaveMsg(err);
        return { ok: false, error: err };
      } finally {
        if (!silent) setBusy(false);
        if (silent) autosaveInFlight.current = false;
      }
    },
    [rec, router],
  );

  const saveRedirectToList = useCallback(() => {
    void (async () => {
      setPdfRetryBar(null);
      beginTransfer(
        "Augšupielādē foto un saglabā",
        "Nelietojiet pārlūka atsvaidzināšanu — gaidiet, līdz pāriet uz sarakstu.",
      );
      try {
        await save({
          redirectToList: true,
          onUploadProgress: (loaded, total) => {
            const pct = Math.min(99, Math.round((100 * loaded) / Math.max(total, 1)));
            setTransferUi((u) => (u ? { ...u, pct } : null));
          },
        });
      } finally {
        endTransfer();
      }
    })();
  }, [beginTransfer, endTransfer, save]);

  useEffect(() => {
    const snap = JSON.stringify(rec);
    if (snap === lastSavedSnapshot.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void save({ silent: true });
    }, 900);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [rec, save]);

  const openPdf = useCallback(async () => {
    setPdfRetryBar(null);
    setOrderPdfRetryOpen(false);
    beginTransfer("Augšupielādē foto un saglabā", "Nelietojiet pārlūka atsvaidzināšanu un neaizveriet cilni.");
    try {
      const saved = await save({
        silent: true,
        onUploadProgress: (loaded, total) => {
          const pct = Math.min(85, Math.round((100 * loaded) / Math.max(total, 1)));
          setTransferUi((u) => (u ? { ...u, title: "Augšupielādē foto (saglabā)…", pct } : null));
        },
      });
      if (!saved.ok) {
        alert(saved.error);
        return;
      }
      setTransferUi((u) =>
        u
          ? {
              ...u,
              title: "Ģenerē PDF serverī…",
              pct: 88,
              detail: "Ar lieliem attēliem tas var aizņemt līdz ~30 s.",
            }
          : null,
      );
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/print`, {
        credentials: "include",
        cache: "no-store",
      });
      setTransferUi((u) => (u ? { ...u, pct: 96 } : null));
      if (!res.ok) {
        const errBody = await res.text();
        let errData: unknown = {};
        try {
          if (errBody) errData = JSON.parse(errBody) as unknown;
        } catch {
          /* keep empty */
        }
        setSaveMsg(formatPatchFailureMessage(res.status, errData, errBody.slice(0, 240)));
        setOrderPdfRetryOpen(true);
        return;
      }
      await downloadPdfBlobFromResponse(res, "pasutijums.pdf", (href, name) => setPdfRetryBar({ href, name }));
    } catch (e) {
      alert(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
      setOrderPdfRetryOpen(true);
    } finally {
      endTransfer();
    }
  }, [beginTransfer, endTransfer, rec.id, save]);

  const retryOrderPdfOnly = useCallback(async () => {
    setPdfRetryBar(null);
    beginTransfer("Ģenerē PDF (bez atkārtotas saglabāšanas)…", "Servera ģenerēšana — gaidiet.");
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/print`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const errBody = await res.text();
        let errData: unknown = {};
        try {
          if (errBody) errData = JSON.parse(errBody) as unknown;
        } catch {
          /* */
        }
        setSaveMsg(formatPatchFailureMessage(res.status, errData, errBody.slice(0, 240)));
        return;
      }
      await downloadPdfBlobFromResponse(res, "pasutijums.pdf", (href, name) => setPdfRetryBar({ href, name }));
      setOrderPdfRetryOpen(false);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      endTransfer();
    }
  }, [beginTransfer, endTransfer, rec.id]);

  const openCreateOffer = useCallback(() => {
    setOfferDraft(newOfferDraft(rec.offers.length + 1));
    setOfferOpen(true);
  }, [rec.offers.length]);

  const openEditOffer = useCallback((offer: IrissOfferRecord) => {
    setOfferDraft({
      id: offer.id,
      title: offer.title,
      brandModel: offer.brandModel,
      year: offer.year,
      mileage: offer.mileage,
      priceGermany: offer.priceGermany,
      comment: offer.comment,
      attachments: offer.attachments,
      createdAt: offer.createdAt || new Date().toISOString(),
    });
    setOfferOpen(true);
  }, []);

  const onOfferFilesPick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).slice(0, 6);
    setOfferFilePrepare({ pct: 0, label: "Saspiež attēlus…" });
    const loaded: IrissOfferAttachment[] = [];
    for (let i = 0; i < fileArr.length; i++) {
      const att = await fileToCompressedOfferAttachment(fileArr[i]);
      if (att) loaded.push(att);
      setOfferFilePrepare({
        pct: Math.round(((i + 1) / fileArr.length) * 100),
        label: "Saspiež attēlus…",
      });
    }
    setOfferFilePrepare(null);
    setOfferDraft((d) => ({
      ...d,
      attachments: [...d.attachments, ...loaded].slice(0, 12),
    }));
  }, []);

  const commitOfferDraftToRecord = useCallback(
    async (
      onUploadProgress?: (loaded: number, total: number) => void,
    ): Promise<{ offer: IrissOfferRecord | null; error?: string }> => {
      const now = new Date().toISOString();
      const cleanedTitle = offerDraft.title.trim() || `Piedāvājums ${rec.offers.length + 1}`;
      const offerOut: IrissOfferRecord = {
        id: offerDraft.id,
        title: cleanedTitle,
        brandModel: offerDraft.brandModel,
        year: offerDraft.year,
        mileage: offerDraft.mileage,
        priceGermany: offerDraft.priceGermany,
        comment: offerDraft.comment,
        attachments: offerDraft.attachments,
        createdAt: offerDraft.createdAt || now,
        updatedAt: now,
      };
      const exists = rec.offers.some((o) => o.id === offerOut.id);
      const nextOffers = exists ? rec.offers.map((o) => (o.id === offerOut.id ? offerOut : o)) : [...rec.offers, offerOut];
      const renumbered = nextOffers.map((o, idx) => ({ ...o, title: `Piedāvājums ${idx + 1}` }));
      const nextRec: IrissPasutijumsRecord = { ...rec, offers: renumbered };
      const r = await save({ payload: nextRec, silent: true, onUploadProgress });
      if (!r.ok) return { offer: null, error: r.error };
      setRec(nextRec);
      const savedOffer = nextRec.offers.find((o) => o.id === offerOut.id) ?? offerOut;
      return { offer: savedOffer };
    },
    [offerDraft, rec, save],
  );

  useEffect(() => {
    const lock = offerOpen || deleteConfirmOpen || offerDeleteConfirmOpen || Boolean(transferUi);
    if (!lock) return;
    const html = document.documentElement;
    const scrollEl = document.getElementById(ADMIN_MAIN_SCROLL_ID);
    const prevBodyOverflow = document.body.style.overflow;
    html.classList.add(ADMIN_SCROLL_LOCK_CLASS);
    scrollEl?.classList.add(ADMIN_SCROLL_LOCK_CLASS);
    document.body.style.overflow = "hidden";
    return () => {
      html.classList.remove(ADMIN_SCROLL_LOCK_CLASS);
      scrollEl?.classList.remove(ADMIN_SCROLL_LOCK_CLASS);
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [offerOpen, deleteConfirmOpen, offerDeleteConfirmOpen, transferUi]);

  const onConfirmDeleteOrder = useCallback(async () => {
    setDeleteBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setSaveMsg("Dzēšana neizdevās.");
        return;
      }
      setDeleteConfirmOpen(false);
      router.push("/admin/iriss/pasutijumi");
      router.refresh();
    } catch {
      setSaveMsg("Tīkla kļūda.");
    } finally {
      setDeleteBusy(false);
    }
  }, [rec.id, router]);

  const onConfirmDeleteOffer = useCallback(async () => {
    const id = offerDraft.id;
    const exists = rec.offers.some((o) => o.id === id);
    if (!exists) {
      setOfferDeleteConfirmOpen(false);
      setOfferOpen(false);
      return;
    }
    setOfferDeleteBusy(true);
    try {
      const nextOffers = rec.offers
        .filter((o) => o.id !== id)
        .map((o, idx) => ({ ...o, title: `Piedāvājums ${idx + 1}` }));
      const nextRec: IrissPasutijumsRecord = { ...rec, offers: nextOffers };
      const r = await save({ payload: nextRec, silent: true });
      if (!r.ok) {
        alert(r.error ?? "Dzēšana neizdevās.");
        return;
      }
      setRec(nextRec);
      setOfferDeleteConfirmOpen(false);
      setOfferOpen(false);
    } catch {
      alert("Tīkla kļūda.");
    } finally {
      setOfferDeleteBusy(false);
    }
  }, [offerDraft.id, rec, save]);

  const shellCard = useMemo(
    () => "rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  const normalizedPhone = useMemo(() => normalizePhoneForLv(rec.phone), [rec.phone]);

  const triggerCall = useCallback(() => {
    if (!normalizedPhone) return;
    if (normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    window.location.href = `tel:${normalizedPhone}`;
  }, [normalizedPhone, patch, rec.phone]);

  const triggerWhatsapp = useCallback(() => {
    if (!normalizedPhone) return;
    if (normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    const digits = normalizedPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }, [normalizedPhone, patch, rec.phone]);

  const generateOfferPdfBlob = useCallback(
    async (offerId: string): Promise<Blob> => {
      const base = `/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/offer/${encodeURIComponent(offerId)}/print`;
      let res = await fetch(base, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        await res.text().catch(() => "");
        res = await fetch(`${base}?images=0`, { credentials: "include", cache: "no-store" });
      }
      if (!res.ok) {
        const errBody = await res.text();
        let errData: unknown = {};
        try {
          if (errBody) errData = JSON.parse(errBody) as unknown;
        } catch {
          /* keep empty */
        }
        throw new Error(formatPatchFailureMessage(res.status, errData, errBody.slice(0, 240)));
      }
      const blob = await res.blob();
      if (blob.size < 32) throw new Error("PDF ir tukšs vai bojāts.");
      return blob;
    },
    [rec.id],
  );

  const persistOffer = useCallback(async (): Promise<IrissOfferRecord | null> => {
    setOfferBusy(true);
    setPdfRetryBar(null);
    beginTransfer("Saglabā piedāvājumu", "Augšupielādē foto — nelietojiet atsvaidzināšanu.");
    try {
      const { offer: offerOut, error: commitErr } = await commitOfferDraftToRecord((loaded, total) => {
        const pct = Math.min(98, Math.round((100 * loaded) / Math.max(total, 1)));
        setTransferUi((u) => (u ? { ...u, title: "Augšupielādē foto (saglabā)…", pct } : null));
      });
      if (!offerOut) {
        alert(commitErr ?? "Saglabāšana neizdevās.");
        return null;
      }
      setOfferDraft((d) => ({
        ...d,
        title: offerOut.title,
        createdAt: offerOut.createdAt || d.createdAt,
      }));
      return offerOut;
    } finally {
      endTransfer();
      setOfferBusy(false);
    }
  }, [beginTransfer, commitOfferDraftToRecord, endTransfer]);

  const openOfferPdfInNewTab = useCallback(async () => {
    const offerOut = await persistOffer();
    if (!offerOut) return;
    beginTransfer("Ģenerē piedāvājuma PDF", "Sagatavo failu atvēršanai jaunā logā.");
    try {
      setTransferUi((u) => (u ? { ...u, pct: 92, title: "Ģenerē piedāvājuma PDF…", detail: "Lūdzu, uzgaidiet." } : null));
      const blob = await generateOfferPdfBlob(offerOut.id);
      const pdfUrl = URL.createObjectURL(blob);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120_000);
      setTransferUi((u) => (u ? { ...u, pct: 100 } : null));
    } catch (e) {
      alert(e instanceof Error ? e.message.slice(0, 220) : "PDF ģenerēšana neizdevās.");
    } finally {
      endTransfer();
    }
  }, [beginTransfer, endTransfer, generateOfferPdfBlob, persistOffer]);

  const openOfferShareWhatsApp = useCallback(async () => {
    if (!normalizedPhone) return;
    if (normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    const digits = normalizedPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    const offerOut = await persistOffer();
    if (!offerOut) return;
    beginTransfer("Ģenerē PDF priekš WhatsApp", "Sagatavo failu un atver WhatsApp.");
    try {
      setTransferUi((u) =>
        u ? { ...u, pct: 92, title: "Ģenerē PDF un gatavo eksportu…", detail: "Lūdzu, uzgaidiet." } : null,
      );
      const blob = await generateOfferPdfBlob(offerOut.id);
      const shareText = buildIrissOfferClientShareBody(offerDraft, rec.clientFirstName, rec.clientLastName);
      const filenameBase = buildIrissOfferShareSubject(offerDraft).replace(/[^\p{L}\p{N}\-_. ]/gu, "").trim() || "piedavajums";
      const safeFileName = filenameBase.endsWith(".pdf") ? filenameBase : `${filenameBase}.pdf`;
      const file = new File([blob], safeFileName, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else {
        const pdfUrl = URL.createObjectURL(blob);
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120_000);
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
      }
      setTransferUi((u) => (u ? { ...u, pct: 100 } : null));
    } catch (e) {
      alert(e instanceof Error ? e.message.slice(0, 220) : "WhatsApp eksports neizdevās.");
    } finally {
      endTransfer();
    }
  }, [
    endTransfer,
    beginTransfer,
    generateOfferPdfBlob,
    normalizedPhone,
    offerDraft,
    patch,
    persistOffer,
    rec.clientFirstName,
    rec.clientLastName,
    rec.phone,
  ]);

  const persistedOfferRecord = useMemo(() => rec.offers.find((o) => o.id === offerDraft.id) ?? null, [rec.offers, offerDraft.id]);
  const offerPersistedInRecord = Boolean(persistedOfferRecord);
  const offerShareWhatsAppEnabled = Boolean(normalizedPhone);
  const offerReadyForPdfActions = useMemo(
    () => isOfferDraftSyncedWithRecord(offerDraft, persistedOfferRecord),
    [offerDraft, persistedOfferRecord],
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] bg-white px-3 pb-8 sm:px-6 lg:px-10">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/iriss/pasutijumi"
            title="Atpakaļ"
            aria-label="Atpakaļ"
            className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.3} aria-hidden />
            <span>Atpakaļ</span>
          </Link>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-2">
            <div className="hidden min-w-0 md:block">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
                IRISS · PASŪTĪJUMI
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
                  Pasūtījums
                </h1>
                {rec.offers.map((offer, idx) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => openEditOffer(offer)}
                    className={offerPChipButtonClass}
                    style={{ backgroundColor: "#34C759", color: "black", border: "1px solid #2AB650" }}
                    title={offer.title}
                  >
                    P{idx + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className={`md:hidden min-w-0 w-full ${LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}`}>
              {rec.offers.map((offer, idx) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => openEditOffer(offer)}
                  className={offerPChipButtonClass}
                  style={{ backgroundColor: "#34C759", color: "black", border: "1px solid #2AB650" }}
                  title={offer.title}
                >
                  P{idx + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={busy || !!transferUi}
                title="Saglabāt"
                aria-label={busy || !!transferUi ? "Saglabā" : "Saglabāt"}
                onClick={saveRedirectToList}
                className={headerMobileSaveChipBtnClass}
              >
                <Save className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
              <button
                type="button"
                disabled={!!transferUi}
                title="PDF"
                aria-label="PDF"
                onClick={() => void openPdf()}
                className={headerMobilePdfChipBtnClass}
              >
                <FileDown className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <div className="hidden shrink-0 flex-nowrap items-center justify-end gap-1 sm:flex-wrap sm:gap-2 md:flex">
              <button
                type="button"
                disabled={busy || !!transferUi}
                title="Saglabāt"
                aria-label={busy || !!transferUi ? "Saglabā" : "Saglabāt"}
                onClick={saveRedirectToList}
                className={`${toolbarBtnBase} border border-[var(--color-provin-accent)] bg-transparent text-[var(--color-provin-accent)] shadow-sm hover:bg-[var(--color-provin-accent)]/10 sm:hover:bg-[var(--color-provin-accent)]/10`}
              >
                <Save className="h-6 w-6 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
                <span className="hidden text-[13px] font-semibold sm:inline">{busy || !!transferUi ? "Saglabā…" : "Saglabāt"}</span>
              </button>
              <button
                type="button"
                disabled={!!transferUi}
                title="PDF"
                aria-label="PDF"
                onClick={() => void openPdf()}
                className={`${toolbarBtnBase} border border-[var(--color-provin-accent)]/35 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-provin-accent)] hover:bg-[var(--color-provin-accent-soft)] sm:hover:bg-[var(--color-provin-accent-soft)]`}
              >
                <FileDown className="h-6 w-6 shrink-0 sm:h-4 sm:w-4" strokeWidth={2.25} aria-hidden />
                <span className="hidden text-[13px] font-semibold sm:inline">PDF</span>
              </button>
            </div>
          </div>
        </div>
        {saveMsg ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
            {saveMsg}
          </p>
        ) : null}
        {orderPdfRetryOpen ? (
          <div
            className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950"
            role="status"
          >
            <p className="font-semibold">Saglabāšana ir veiksmīga; PDF ģenerēšana vai lejupielāde neizdevās.</p>
            <button
              type="button"
              onClick={() => void retryOrderPdfOnly()}
              className="mt-1.5 inline-flex min-h-9 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-amber-50"
            >
              Lejupielādēt PDF vēlreiz (bez atkārtotas saglabāšanas)
            </button>
            <button
              type="button"
              onClick={() => setOrderPdfRetryOpen(false)}
              className="ml-2 text-[11px] font-medium text-slate-600 underline"
            >
              Aizvērt
            </button>
          </div>
        ) : null}
      </AdminDashboardHeaderWithMenu>

      <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-5">
        <section className={shellCard}>
          <IrissListingPlatformChipsRow rec={rec} />
          <BlockTitle>Klienta dati</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Vārds"
              value={rec.clientFirstName}
              onChange={(e) => patch("clientFirstName", e.target.value)}
              autoComplete="given-name"
            />
            <LabeledInput
              label="Uzvārds"
              value={rec.clientLastName}
              onChange={(e) => patch("clientLastName", e.target.value)}
              autoComplete="family-name"
            />
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Tālrunis</span>
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  className={`${fieldClass} min-w-0 flex-1`}
                  value={rec.phone}
                  onChange={(e) => patch("phone", e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
                <button
                  type="button"
                  onClick={triggerCall}
                  disabled={!normalizedPhone}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-35"
                  title="Zvanīt"
                  aria-label="Zvanīt"
                >
                  <Phone className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={triggerWhatsapp}
                  disabled={!normalizedPhone}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100/70 aria-disabled:pointer-events-none aria-disabled:opacity-35"
                  title="Atvērt WhatsApp"
                  aria-label="Atvērt WhatsApp"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                    <path d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z" />
                  </svg>
                </button>
              </div>
            </label>
            <LabeledInput
              label="E-pasts"
              value={rec.email}
              onChange={(e) => patch("email", e.target.value)}
              inputMode="email"
              autoComplete="email"
            />
            <LabeledInput
              label="Pasūtījuma datums"
              type="date"
              value={rec.orderDate}
              onChange={(e) => patch("orderDate", e.target.value)}
            />
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Transportlīdzekļa specifikācija</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Marka / modelis"
              value={rec.brandModel}
              onChange={(e) => patch("brandModel", e.target.value)}
            />
            <LabeledInput
              label="Ražošanas gadi"
              value={rec.productionYears}
              onChange={(e) => patch("productionYears", e.target.value)}
              placeholder="piem., 2018–2021"
            />
            <LabeledInput
              label="Kopējais budžets"
              value={rec.totalBudget}
              onChange={(e) => patch("totalBudget", e.target.value)}
            />
            <LabeledInput
              label="Dzinēja tips"
              value={rec.engineType}
              onChange={(e) => patch("engineType", e.target.value)}
            />
            <LabeledInput
              label="Ātrumkārba"
              value={rec.transmission}
              onChange={(e) => patch("transmission", e.target.value)}
            />
            <LabeledInput
              label="Maks. nobraukums"
              value={rec.maxMileage}
              onChange={(e) => patch("maxMileage", e.target.value)}
            />
            <LabeledInput
              label="Vēlamās krāsas"
              value={rec.preferredColors}
              onChange={(e) => patch("preferredColors", e.target.value)}
            />
            <LabeledInput
              label="Nevēlamās krāsas"
              value={rec.nonPreferredColors}
              onChange={(e) => patch("nonPreferredColors", e.target.value)}
            />
            <div className="sm:col-span-2">
              <LabeledInput
                label="Salona apdare"
                value={rec.interiorFinish}
                onChange={(e) => patch("interiorFinish", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Aprīkojums</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledTextarea
              label="Obligātās prasības"
              value={rec.equipmentRequired}
              onChange={(e) => patch("equipmentRequired", e.target.value)}
            />
            <LabeledTextarea
              label="Vēlamās prasības"
              value={rec.equipmentDesired}
              onChange={(e) => patch("equipmentDesired", e.target.value)}
            />
          </div>
        </section>

        <section className={shellCard}>
          <BlockTitle>Piezīmes</BlockTitle>
          <LabeledTextarea label="Piezīmes" value={rec.notes} onChange={(e) => patch("notes", e.target.value)} />
        </section>

        <section className={shellCard}>
          <BlockTitle>Sludinājumu platformas (saites)</BlockTitle>
          <IrissListingPlatformsFields rec={rec} onPatch={patchRecord} />
        </section>

        <section className={`${shellCard} border-red-100/80 bg-red-50/20`}>
          <p className="text-[12px] leading-snug text-red-950/90">
            Neatgriezeniski dzēst šo pasūtījumu un visus piedāvājumus. Pirms dzēšanas tiek prasīts apstiprinājums.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={openCreateOffer}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Izveidot piedāvājumu
            </button>
            <button
              type="button"
              disabled={busy || !!transferUi}
              onClick={saveRedirectToList}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full border border-[var(--color-provin-accent)] bg-transparent px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-50 sm:w-auto"
            >
              {busy || !!transferUi ? "Saglabā…" : "Saglabāt"}
            </button>
            <button
              type="button"
              disabled={busy || deleteBusy}
              onClick={() => {
                setOfferOpen(false);
                setDeleteConfirmOpen(true);
              }}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-50 sm:w-auto"
            >
              <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
              Dzēst pasūtījumu
            </button>
          </div>
        </section>
      </div>

      {offerOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center overscroll-y-contain bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !offerBusy && !offerFilePrepare && setOfferOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-offer-dialog-title"
            className="flex max-h-[min(92dvh,920px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 sm:px-5">
              <h2
                id="iriss-offer-dialog-title"
                className="min-w-0 flex-1 truncate pr-2 text-base font-semibold text-[var(--color-apple-text)]"
              >
                {offerDraft.title}
              </h2>
              <button
                type="button"
                disabled={offerBusy || !!offerFilePrepare}
                aria-label="Aizvērt"
                title="Aizvērt"
                onClick={() => setOfferOpen(false)}
                className="inline-flex h-10 min-h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 [-webkit-overflow-scrolling:touch] pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LabeledInput
                  label="Marka/modelis"
                  value={offerDraft.brandModel}
                  onChange={(e) => setOfferDraft((d) => ({ ...d, brandModel: e.target.value }))}
                />
                <LabeledInput
                  label="Gads"
                  value={offerDraft.year}
                  onChange={(e) => setOfferDraft((d) => ({ ...d, year: e.target.value }))}
                />
                <LabeledInput
                  label="Nobraukums"
                  value={offerDraft.mileage}
                  onChange={(e) => setOfferDraft((d) => ({ ...d, mileage: e.target.value }))}
                />
                <LabeledInput
                  label="Cena Vācijā"
                  value={offerDraft.priceGermany}
                  onChange={(e) => setOfferDraft((d) => ({ ...d, priceGermany: e.target.value }))}
                />
              </div>
              <div className="mt-3">
                <LabeledTextarea
                  label="Komentāri"
                  value={offerDraft.comment}
                  onChange={(e) => setOfferDraft((d) => ({ ...d, comment: e.target.value }))}
                />
              </div>
              <div className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 select-none">
                <label
                  className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 ${offerFilePrepare ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                  Pievienot failus
                  <input
                    type="file"
                    multiple
                    disabled={!!offerFilePrepare}
                    className="hidden"
                    onChange={(e) => {
                      void onOfferFilesPick(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {offerFilePrepare ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3" role="status" aria-live="polite">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
                      <span className="text-[12px] font-medium text-[var(--color-apple-text)]">{offerFilePrepare.label}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[var(--color-provin-accent)] transition-[width] duration-150"
                        style={{ width: `${offerFilePrepare.pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] tabular-nums text-slate-500">{offerFilePrepare.pct}%</p>
                  </div>
                ) : null}
                {offerDraft.attachments.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-medium text-slate-500">
                      Turiet nospiestu uz attēla ~0,5 s, tad velciet, lai mainītu secību.
                    </p>
                    <Reorder.Group
                      axis="x"
                      values={offerDraft.attachments}
                      onReorder={(next) => setOfferDraft((d) => ({ ...d, attachments: next }))}
                      className="mt-2 flex list-none flex-row flex-nowrap gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
                      style={{ WebkitUserSelect: "none", userSelect: "none" }}
                    >
                      {offerDraft.attachments.map((a) => (
                        <IrissOfferAttachmentReorderItem
                          key={a.id}
                          attachment={a}
                          onRemove={() =>
                            setOfferDraft((d) => ({ ...d, attachments: d.attachments.filter((x) => x.id !== a.id) }))
                          }
                        />
                      ))}
                    </Reorder.Group>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={offerBusy || !!offerFilePrepare || offerDeleteBusy}
                  onClick={() => setOfferDeleteConfirmOpen(true)}
                  className={`${offerDialogMainBtnClass} sm:self-start`}
                >
                  Dzēst
                </button>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:min-w-0 sm:flex-1">
                  <button
                    type="button"
                    disabled={offerBusy || !!offerFilePrepare}
                    onClick={() => setOfferOpen(false)}
                    className={offerDialogMainBtnClass}
                  >
                    Atcelt
                  </button>
                  {offerReadyForPdfActions ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={offerBusy || !!offerFilePrepare}
                        onClick={() => void openOfferPdfInNewTab()}
                        className={offerDialogMainBtnClass}
                      >
                        PDF
                      </button>
                      {offerShareWhatsAppEnabled ? (
                        <button
                          type="button"
                          disabled={offerBusy || !!offerFilePrepare}
                          onClick={openOfferShareWhatsApp}
                          title="Sūtīt WhatsApp klientam"
                          aria-label="Sūtīt WhatsApp klientam"
                          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-[#25D366] text-white shadow-sm transition hover:brightness-105 active:scale-[0.98] disabled:opacity-40"
                        >
                          <WhatsAppGlyphIcon className="h-5 w-5" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={offerBusy || !!offerFilePrepare}
                    onClick={() => void persistOffer()}
                    className={offerDialogMainBtnClass}
                  >
                    Saglabāt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {transferUi ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 p-6"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-labelledby="iriss-transfer-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <Loader2 className="h-8 w-8 shrink-0 animate-spin text-[var(--color-provin-accent)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p id="iriss-transfer-title" className="text-[14px] font-semibold text-[var(--color-apple-text)]">
                  {transferUi.title}
                </p>
                <p className="mt-1 text-[12px] text-slate-600">{transferUi.detail}</p>
                {transferUi.longWait ? (
                  <p className="mt-2 text-[12px] font-medium text-amber-900">Vēl apstrādā… Lūdzu, gaidiet.</p>
                ) : null}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--color-provin-accent)] transition-[width] duration-200"
                    style={{ width: `${transferUi.pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-slate-500">{transferUi.pct}%</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pdfRetryBar ? (
        <div className="fixed inset-x-0 bottom-0 z-[195] border-t border-slate-200 bg-white/98 p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-center text-[12px] leading-snug text-slate-800">
            Ja PDF neparādījās vai pārlūks bloķēja lejupielādi,{" "}
            <a
              href={pdfRetryBar.href}
              download={pdfRetryBar.name}
              className="font-semibold text-[var(--color-provin-accent)] underline"
            >
              spied šeit, lai mēģinātu vēlreiz
            </a>
            .
          </p>
          <button
            type="button"
            className="mx-auto mt-2 block text-[11px] font-medium text-slate-500 underline"
            onClick={() => setPdfRetryBar(null)}
          >
            Aizvērt joslu
          </button>
        </div>
      ) : null}

      {offerDeleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-[138] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !offerDeleteBusy && setOfferDeleteConfirmOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              {offerPersistedInRecord
                ? "Vai tiešām vēlaties neatgriezeniski dzēst šo piedāvājumu?"
                : "Vai atmest šo nepabeigto piedāvājumu? Tas vēl nav saglabāts pasūtījumā."}
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOfferDeleteConfirmOpen(false)}
                disabled={offerDeleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDeleteOffer()}
                disabled={offerDeleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {offerDeleteBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !deleteBusy && setDeleteConfirmOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              Vai tiešām vēlaties neatgriezeniski dzēst šo pasūtījumu?
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDeleteOrder()}
                disabled={deleteBusy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {deleteBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
