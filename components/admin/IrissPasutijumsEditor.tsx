"use client";

import { AdminSaveButton, useSaveMessageState } from "@/components/admin/AdminSaveButton";
import { ArrowLeft, FileDown, Phone, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminWorkspaceRevisionConflictBanner } from "@/components/admin/AdminWorkspaceRevisionConflictBanner";
import { DzintarzemeTameSection } from "@/components/admin/DzintarzemeTameSection";
import { IrissGoogleContactStatusRow } from "@/components/admin/IrissGoogleContactStatusRow";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import { IrissOfferForm } from "@/components/admin/IrissOfferForm";
import {
  OFFER_SOURCE_LABEL_LV,
  offerSourceRefString,
  parseOfferSourceRef,
  pendingDropboxPhotoCount,
} from "@/lib/iriss-stock-photos";
import { IrissLabeledInput as LabeledInput, irissOfferFieldClass } from "@/components/admin/IrissOfferFormFields";
import { IrissOfferClientPicker, type IrissOfferClientChoice } from "@/components/admin/IrissOfferClientPicker";
import { IrissOfferSourceSheet } from "@/components/admin/IrissOfferSourceSheet";
import { IrissOrderRoom } from "@/components/admin/IrissOrderRoom";
import { IrissUnsavedChangesGuard } from "@/components/admin/IrissUnsavedChangesGuard";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import { IrissOrderSectionSaveButton } from "@/components/admin/IrissOrderSectionSaveButton";
import { IrissInternalNoteField } from "@/components/admin/IrissInternalNoteField";
import { IrissSpecChoiceSelect } from "@/components/admin/IrissSpecChoiceSelect";
import { IrissSpecDiapazoniBlock } from "@/components/admin/IrissSpecDiapazoniBlock";
import { SharedOrderCriteriaForm } from "@/components/shared/SharedOrderCriteriaForm";
import type { IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { coerceIrissDuplicatesByListing, coerceIrissHitStatusMap, coerceIrissOrderRoomTab } from "@/lib/iriss-order-room-match-props";
import {
  OFFER_AUTO_FIELD_KEYS,
  isOfferDraftSyncedWithRecord,
  newOfferDraft,
  offerDraftFromRecord,
  offerRecordFromDraft,
  type OfferDraft,
} from "@/lib/iriss-offer-draft";
import { irissSaveWirePayload, mergeServerAttachmentStorage } from "@/lib/iriss-pasutijumi-autosave-wire";
import { attachmentsFromAuctionPhotoUrls, auctionPhotoUrlsFromHit } from "@/lib/iriss-auction-offer-photos";
import {
  IRISS_GENERATED_DOCUMENT_HEADER,
  mergeGeneratedDocuments,
  readGeneratedDocumentFromResponseHeader,
} from "@/lib/iriss-generated-documents";
import { irissOfferSeedFromHit } from "@/lib/iriss-order-offer-from-hit";
import { appendIrissOrderRoomNote, type IrissOrderRoomHit, type IrissOrderRoomTab } from "@/lib/iriss-order-room";
import { mergeServerOwnedIrissFields } from "@/lib/iriss-server-owned-fields";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { pickRecordAfterOrderSave, type IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import { withAutoEcarstradeLinks } from "@/lib/iriss-pasutijumi-ecarstrade-links";
import {
  applyIrissOrderRangeEdit,
  applyIrissOrderSpecTextEdit,
  irissOrderRangeErrorFor,
  irissOrderRangeView,
  isIrissOrderSpecTextKey,
  syncIrissOrderRangesFromLegacy,
  type IrissOrderRangeField,
  type IrissOrderSpecTextKey,
} from "@/lib/iriss-order-range-fields";
import {
  IRISS_BODY_SELECT_OPTIONS,
  IRISS_FUEL_SELECT_OPTIONS,
  IRISS_GEARBOX_SELECT_OPTIONS,
  bodySelectValue,
  fuelSelectValue,
  gearboxSelectValue,
  persistBodySelect,
  persistFuelSelect,
  persistGearboxSelect,
} from "@/lib/iriss-order-spec-selects";
import {
  appendIrissStatusHistory,
  applyIrissFieldEdit,
  irissRequiredFieldWarnings,
  isIrissRecordDeleted,
  setIrissInactiveReason,
} from "@/lib/iriss-pasutijumi-audit-fields";
import {
  IRISS_STALE_REVISION,
  irissPasutijumsHasOperatorContent,
  irissWorkspaceRevision,
  mergeIrissPasutijumsRecords,
  planSilentAutosave,
} from "@/lib/iriss-pasutijumi-save-safety";
import { inspectIrissPhone } from "@/lib/iriss-phone-normalize";
import {
  buildIrissOfferClientShareBody,
  buildIrissOfferShareSubject,
  irissOfferImagesOmittedNotice,
} from "@/lib/iriss-offer-share";
import { irissVinWarning } from "@/lib/iriss-vin-check";
import {
  defaultIrissDzintarzemeTameDraft,
  IRISS_DEAL_DETAIL_OPTIONS,
  IRISS_MAX_OFFER_ATTACHMENTS,
  canonicalIrissPasutijumsListStatus,
  displayIrissPasutijumsListStatusLabel,
  IRISS_PASUTIJUMS_PICKER_STATUSES,
  IRISS_PASUTIJUMS_PICKER_STATUS_LV,
  parseIrissPasutijumsListStatus,
  type IrissGeneratedDocument,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
} from "@/lib/iriss-listing-links";
import { fileToCompressedOfferAttachment } from "@/lib/iriss-offer-image-compress";
import type { IrissOrderPhotoAlbumId } from "@/lib/iriss-order-photos";
import {
  deriveOfferValidUntil,
  formatOfferValidUntilLv,
  isIrissOfferExpired,
} from "@/lib/iriss-offer-valid-until";
import { patchJsonWithUploadProgress, type JsonPatchResult } from "@/lib/iriss-json-patch-upload";
import {
  irissRecordNeedsOfferImageHydration,
  mergeIrissOfferImageDataUrls,
} from "@/lib/iriss-pasutijums-offer-images";

/** Mobilajā — kvadrātveida FAB (`rounded-xl`); no `sm:` — apaļas pogas ar tekstu. */
const toolbarBtnBase =
  "inline-flex shrink-0 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50 " +
  "h-12 w-12 shadow-md hover:opacity-95 " +
  "sm:h-11 sm:min-h-[44px] sm:w-auto sm:rounded-full sm:gap-1.5 sm:px-4 sm:shadow-sm sm:hover:opacity-100 sm:active:scale-100";

const fieldClass = irissOfferFieldClass;

const textareaClass = `${fieldClass} min-h-[100px] resize-y py-2.5 leading-snug`;

const offerPChipButtonClass = `${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} cursor-pointer select-none`;



function parseRecordFromPatchResponse(data: unknown): IrissPasutijumsRecord | null {
  if (typeof data !== "object" || data === null) return null;
  if (!("record" in data)) return null;
  const r = (data as { record: unknown }).record;
  if (typeof r !== "object" || r === null) return null;
  return r as IrissPasutijumsRecord;
}

type SaveResult = IrissOrderSaveResult;

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
  return parts.join(" - ");
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

function attachmentNameSizeKey(name: string, size: number): string {
  return `${name.trim().toLowerCase()}|${Math.max(0, Math.trunc(size))}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildAttachmentFingerprint(att: IrissOfferAttachment): Promise<string> {
  const key = attachmentNameSizeKey(att.name, att.size);
  const digest = await sha256Hex(att.dataUrl);
  return `${key}|${digest}`;
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <IrissSectionHeading>{children}</IrissSectionHeading>;
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

/** Noklusējumi ārpus komponentes: `= []` katrā renderī ir jauns masīvs, un efekts ar [roomHits] tad griežas bez gala. */
const EMPTY_ROOM_HITS: IrissOrderRoomHit[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_OFFER_LINKS: IrissOfferClientLinkAdminView[] = [];
const EMPTY_HIT_STATUS: Record<string, IrissListingHitStatus> = {};
const EMPTY_DUPLICATES: Record<string, IrissVinDuplicateLink[]> = {};

export function IrissPasutijumsEditor({
  initialRecord,
  autoOpenNewOffer = false,
  autoOpenOfferId = "",
  forceNoClientPdf = false,
  seedFrom = "",
  unsavedDraft = false,
  roomHits = EMPTY_ROOM_HITS,
  dismissedHitIds = EMPTY_IDS,
  listingsCache = "off",
  initialOfferLinks = EMPTY_OFFER_LINKS,
  initialHitStatus = EMPTY_HIT_STATUS,
  duplicatesByListing = EMPTY_DUPLICATES,
  initialRoomTab = "overview",
  googleContactsConfigured: googleContactsConfiguredInitial = false,
}: {
  initialRecord: IrissPasutijumsRecord;
  autoOpenNewOffer?: boolean;
  autoOpenOfferId?: string;
  forceNoClientPdf?: boolean;
  /** "autoparks:<id>" | "logistics:<id>": jaunais piedāvājums ar auto datiem un /STOCK bildēm. */
  seedFrom?: string;
  unsavedDraft?: boolean;
  /** Jau nolasītie Meklētāja auto šim pasūtījumam. Tukšs jaunam melnrakstam. */
  roomHits?: IrissOrderRoomHit[];
  dismissedHitIds?: string[];
  listingsCache?: "on" | "off";
  initialOfferLinks?: IrissOfferClientLinkAdminView[];
  initialHitStatus?: Record<string, IrissListingHitStatus>;
  duplicatesByListing?: Record<string, IrissVinDuplicateLink[]>;
  initialRoomTab?: IrissOrderRoomTab;
  googleContactsConfigured?: boolean;
}) {
  const router = useRouter();
  const [rec, setRec] = useState<IrissPasutijumsRecord>(() => withAutoEcarstradeLinks(initialRecord));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const saveFailed = Boolean(saveMsg && /neizdev|kļūd/i.test(saveMsg));
  const [busy, setBusy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  /** "Klients ▾" jaunam piedāvājumam (tikai jaunā, vēl nesaglabātā pasūtījumā). */
  const [offerClient, setOfferClient] = useState<IrissOfferClientChoice>(null);
  /** Klienta kabinetā: auto izvēle Autoparks | Loģistika | Tukšs pirms formas. */
  const [offerSourceSheetOpen, setOfferSourceSheetOpen] = useState(false);
  const [offerAutoFields, setOfferAutoFields] = useState<ReadonlySet<string>>(() => new Set());
  const [offerSeedStatus, setOfferSeedStatus] = useState<{ loading: boolean; note: string; sourceLabel: string } | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [offerDeleteConfirmOpen, setOfferDeleteConfirmOpen] = useState(false);
  const [offerDeleteBusy, setOfferDeleteBusy] = useState(false);
  const [orderPdfBusy, setOrderPdfBusy] = useState(false);
  const [offerPdfBusy, setOfferPdfBusy] = useState(false);
  const [offerPdfNotice, setOfferPdfNotice] = useState<string | null>(null);
  const [offerPdfAllowWithoutImages, setOfferPdfAllowWithoutImages] = useState(false);
  const [offerWhatsappBusy, setOfferWhatsappBusy] = useState(false);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(() => newOfferDraft(1));
  const autoOpenOfferDone = useRef(false);
  const lastSavedSnapshot = useRef(JSON.stringify(withAutoEcarstradeLinks(initialRecord)));
  const recRef = useRef(rec);
  recRef.current = rec;
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);
  const autosaveQueued = useRef(false);
  const persistedIdRef = useRef(unsavedDraft ? "" : initialRecord.id);
  const imagesHydrating = useRef(irissRecordNeedsOfferImageHydration(initialRecord));
  const [imagesReady, setImagesReady] = useState(!imagesHydrating.current);

  const [pdfRetryBar, setPdfRetryBar] = useState<{ href: string; name: string } | null>(null);
  const [orderPdfRetryOpen, setOrderPdfRetryOpen] = useState(false);
  const [offerFilePrepare, setOfferFilePrepare] = useState<{ pct: number; label: string } | null>(null);
  const [revisionConflict, setRevisionConflict] = useState<IrissPasutijumsRecord | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [dirty, setDirty] = useState(Boolean(unsavedDraft));
  const [roomHitsLive, setRoomHitsLive] = useState<IrissOrderRoomHit[]>(roomHits);
  const [readingListingUrl, setReadingListingUrl] = useState<string | null>(null);
  const [listingReadByUrl, setListingReadByUrl] = useState<Record<string, string>>({});
  const [googleContactsConfigured, setGoogleContactsConfigured] = useState(googleContactsConfiguredInitial);
  const [googleContactBusy, setGoogleContactBusy] = useState(false);

  const patch = useCallback(<K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => {
    setRec((r) => {
      if (isIrissOrderSpecTextKey(String(key)) && typeof value === "string") {
        return withAutoEcarstradeLinks(applyIrissOrderSpecTextEdit(r, key as IrissOrderSpecTextKey, value, Date.now()));
      }
      return withAutoEcarstradeLinks(applyIrissFieldEdit(r, { [key]: value } as Partial<IrissPasutijumsRecord>, Date.now()));
    });
  }, []);

  const patchRange = useCallback((field: IrissOrderRangeField, raw: string) => {
    setRec((r) => withAutoEcarstradeLinks(applyIrissOrderRangeEdit(r, field, raw, Date.now())));
  }, []);

  const patchRecord = useCallback((p: Partial<IrissPasutijumsRecord>) => {
    setRec((r) => withAutoEcarstradeLinks(applyIrissFieldEdit(r, p, Date.now())));
  }, []);

  const setListStatus = useCallback((status: IrissPasutijumsListStatus) => {
    setRec((r) =>
      withAutoEcarstradeLinks(
        appendIrissStatusHistory(r, status, {
          at: new Date().toISOString(),
          reason: status === "inactive" ? r.inactiveReason : undefined,
        }),
      ),
    );
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
      const payload = withAutoEcarstradeLinks(opts?.payload ?? recRef.current);
      const useXhr = Boolean(onUploadProgress) || !silent;

      if (silent) {
        const plan = planSilentAutosave(autosaveInFlight.current, imagesHydrating.current);
        if (plan.queue) {
          autosaveQueued.current = true;
          return { ok: false, error: "Saglabāšana rindā." };
        }
      }
      if (imagesHydrating.current) {
        autosaveQueued.current = true;
        return { ok: false, error: "Ielādē attēlus." };
      }
      if (!silent) {
        setBusy(true);
        const required = irissRequiredFieldWarnings(payload);
        setSaveMsg(required.length ? required.join(" ") : null);
      }
      if (silent) autosaveInFlight.current = true;

      const persistId = persistedIdRef.current;
      const isCreate = !persistId;
      const url = isCreate
        ? "/api/admin/iriss-pasutijumi"
        : `/api/admin/iriss-pasutijumi/${encodeURIComponent(payload.id)}`;
      // Bez bildēm: jau saglabātās bildes (blobPath) netiek sūtītas atkārtoti.
      const body = {
        ...irissSaveWirePayload(payload),
        expectedWorkspaceRevision: irissWorkspaceRevision(payload),
      };

      const finishOk = (record: IrissPasutijumsRecord | null, data?: unknown): SaveResult => {
        if (record?.id) persistedIdRef.current = record.id;
        if (data && typeof data === "object" && "googleContactsConfigured" in data) {
          setGoogleContactsConfigured(Boolean((data as { googleContactsConfigured: unknown }).googleContactsConfigured));
        }
        if (!silent) {
          setRec((current) => {
            const picked = pickRecordAfterOrderSave(current, payload, record);
            const merged = mergeServerAttachmentStorage(mergeServerOwnedIrissFields(picked, record), record);
            lastSavedSnapshot.current = JSON.stringify(merged);
            return merged;
          });
        } else {
          setRec((current) => {
            const concurrent = JSON.stringify(current) !== JSON.stringify(payload);
            const merged = mergeServerAttachmentStorage(
              mergeServerOwnedIrissFields(concurrent ? current : payload, record),
              record,
            );
            lastSavedSnapshot.current = JSON.stringify(
              mergeServerAttachmentStorage(mergeServerOwnedIrissFields(payload, record), record),
            );
            return merged;
          });
        }
        if (redirectToList) {
          router.push("/admin/iriss/pasutijumi");
          router.refresh();
          return { ok: true };
        }
        if (!silent) {
          const required = irissRequiredFieldWarnings(payload);
          setSaveMsg(required.length ? `Saglabāts. ${required.join(" ")}` : "Saglabāts.");
        }
        setRevisionConflict(null);
        setDirty(JSON.stringify(recRef.current) !== lastSavedSnapshot.current);
        return { ok: true };
      };

      const applyStale = (data: unknown): SaveResult => {
        const server = parseRecordFromPatchResponse(data);
        if (!server) return { ok: false, error: "Konflikts saglabājot. Pārlādē lapu." };
        setRevisionConflict(server);
        if (!silent) setSaveMsg("Konflikts: cita cilne jau saglabāja jaunāku ierakstu.");
        return { ok: false, error: IRISS_STALE_REVISION };
      };

      try {
        if (!isCreate && useXhr) {
          const result = await patchJsonWithUploadProgress(url, body, onUploadProgress);
          if (!result.ok) {
            if (result.status === 409) return applyStale(result.data);
            const err = formatXhrPatchFailure(result);
            if (!silent) setSaveMsg(err);
            return { ok: false, error: err };
          }
          const record = parseRecordFromPatchResponse(result.data);
          return finishOk(record, result.data);
        }

        const res = await fetch(url, {
          method: isCreate ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isCreate ? { record: body } : body),
        });
        const text = await res.text();
        let data: unknown = {};
        try {
          if (text) data = JSON.parse(text) as unknown;
        } catch {
          data = {};
        }
        if (res.status === 409) return applyStale(data);
        if (!res.ok) {
          const err = formatPatchFailureMessage(res.status, data, text ? text.slice(0, 280) : undefined);
          if (!silent) setSaveMsg(err);
          return { ok: false, error: err };
        }
        const record = parseRecordFromPatchResponse(data);
        if (isCreate && record?.id && record.id !== payload.id) {
          router.replace(`/admin/iriss/pasutijumi/${encodeURIComponent(record.id)}`);
        } else if (isCreate && persistId === "" && payload.id) {
          router.replace(`/admin/iriss/pasutijumi/${encodeURIComponent(payload.id)}`);
        }
        return finishOk(record, data);
      } catch (e) {
        const err = `Tīkla kļūda: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`;
        if (!silent) setSaveMsg(err);
        return { ok: false, error: err };
      } finally {
        if (!silent) setBusy(false);
        if (silent) {
          autosaveInFlight.current = false;
          if (autosaveQueued.current) {
            autosaveQueued.current = false;
            window.setTimeout(() => {
              void save({ silent: true });
            }, 0);
          }
        }
      }
    },
    [router],
  );

  const saveCurrentPage = useCallback(async (): Promise<SaveResult> => {
    setPdfRetryBar(null);
    return save();
  }, [save]);

  const saveCriteria = useCallback(
    async (partial: Partial<IrissPasutijumsRecord>): Promise<SaveResult> => {
      const now = Date.now();
      let next = applyIrissFieldEdit(recRef.current, partial, now);
      for (const key of ["engineType", "transmission", "bodyType", "driveType"] as const) {
        if (typeof partial[key] === "string") {
          next = applyIrissOrderSpecTextEdit(next, key, partial[key] as string, now);
        }
      }
      next = syncIrissOrderRangesFromLegacy(next, now);
      next = withAutoEcarstradeLinks(next);
      setRec(next);
      recRef.current = next;
      return save({ payload: next });
    },
    [save],
  );

  const reloadConflict = useCallback(() => {
    if (!revisionConflict) return;
    setConflictBusy(true);
    const fresh = withAutoEcarstradeLinks(revisionConflict);
    setRec(fresh);
    recRef.current = fresh;
    lastSavedSnapshot.current = JSON.stringify(fresh);
    setRevisionConflict(null);
    setSaveMsg("Ielādēta servera versija.");
    setConflictBusy(false);
  }, [revisionConflict]);

  const mergeConflict = useCallback(() => {
    if (!revisionConflict) return;
    setConflictBusy(true);
    const merged = withAutoEcarstradeLinks(mergeIrissPasutijumsRecords(revisionConflict, recRef.current));
    merged.workspaceRevision = irissWorkspaceRevision(revisionConflict);
    setRec(merged);
    recRef.current = merged;
    lastSavedSnapshot.current = JSON.stringify(revisionConflict);
    setRevisionConflict(null);
    setSaveMsg("Apvienots droši. Saglabā vēlreiz.");
    setConflictBusy(false);
  }, [revisionConflict]);

  const restoreDeleted = useCallback(async () => {
    setBusy(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setSaveMsg("Atjaunošana neizdevās.");
        return;
      }
      const data = (await res.json()) as { record?: IrissPasutijumsRecord };
      if (data.record) {
        const next = withAutoEcarstradeLinks(data.record);
        setRec(next);
        recRef.current = next;
        lastSavedSnapshot.current = JSON.stringify(next);
      }
      setSaveMsg("Atjaunots no miskastes.");
    } catch {
      setSaveMsg("Tīkla kļūda.");
    } finally {
      setBusy(false);
    }
  }, [rec.id]);

  useEffect(() => {
    if (!imagesHydrating.current) return;
    let cancelled = false;
    const id = initialRecord.id;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}?images=thumbs`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { record?: IrissPasutijumsRecord; googleContactsConfigured?: boolean };
        if (typeof data.googleContactsConfigured === "boolean") {
          setGoogleContactsConfigured(data.googleContactsConfigured);
        }
        if (!data.record || cancelled) return;
        setRec((prev) => {
          const merged = withAutoEcarstradeLinks(mergeIrissOfferImageDataUrls(prev, data.record!));
          lastSavedSnapshot.current = JSON.stringify(merged);
          return merged;
        });
      } finally {
        if (!cancelled) {
          imagesHydrating.current = false;
          setImagesReady(true);
          if (autosaveQueued.current) {
            autosaveQueued.current = false;
            window.setTimeout(() => {
              void save({ silent: true });
            }, 0);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRecord.id, save]);

  useEffect(() => {
    setRoomHitsLive(roomHits);
  }, [roomHits]);

  useEffect(() => {
    const snap = JSON.stringify(rec);
    setDirty(snap !== lastSavedSnapshot.current);
    if (!imagesReady) return;
    if (!persistedIdRef.current && !irissPasutijumsHasOperatorContent(rec)) return;
    if (snap === lastSavedSnapshot.current) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void save({ silent: true });
    }, 900);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [rec, save, imagesReady]);

  const readListingLink = useCallback(
    async (sourceUrl: string) => {
      const href = sourceUrl.trim();
      if (!href || !persistedIdRef.current) return;
      setReadingListingUrl(href);
      try {
        const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/read-listing`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: href }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          note?: string;
          vehicleCount?: number;
          newCount?: number;
          hits?: IrissOrderRoomHit[];
        };
        if (Array.isArray(data.hits)) setRoomHitsLive(data.hits);
        const count = typeof data.vehicleCount === "number" ? data.vehicleCount : 0;
        const added = typeof data.newCount === "number" ? data.newCount : 0;
        const msg = data.ok
          ? `${count} auto${added > 0 ? ` · ${added} jauni` : ""}`
          : data.note?.trim() || "Nolasīšana neizdevās.";
        setListingReadByUrl((prev) => ({ ...prev, [href]: msg }));
      } catch {
        setListingReadByUrl((prev) => ({ ...prev, [href]: "Tīkla kļūda." }));
      } finally {
        setReadingListingUrl(null);
      }
    },
    [rec.id],
  );

  const refreshRoomHits = useCallback(async () => {
    const id = persistedIdRef.current || rec.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}/room-hits`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { hits?: IrissOrderRoomHit[] };
      if (Array.isArray(data.hits)) setRoomHitsLive(data.hits);
    } catch {
      /* ignore: cards stay as they were */
    }
  }, [rec.id]);

  const ingestGeneratedDocument = useCallback((doc: IrissGeneratedDocument, workspaceRevision?: number) => {
    setRec((r) => {
      const generatedDocuments = mergeGeneratedDocuments([doc], r.generatedDocuments);
      const next = {
        ...r,
        generatedDocuments,
        ...(typeof workspaceRevision === "number" ? { workspaceRevision } : {}),
      };
      try {
        const snap = JSON.parse(lastSavedSnapshot.current) as IrissPasutijumsRecord;
        lastSavedSnapshot.current = JSON.stringify({
          ...snap,
          generatedDocuments,
          ...(typeof workspaceRevision === "number" ? { workspaceRevision } : {}),
        });
      } catch {
        lastSavedSnapshot.current = JSON.stringify(next);
      }
      return next;
    });
  }, []);

  const openPdf = useCallback(async () => {
    setPdfRetryBar(null);
    setOrderPdfRetryOpen(false);
    setOrderPdfBusy(true);
    try {
      const saved = await save({ silent: true });
      if (!saved.ok) {
        setSaveMsg(saved.error);
        return;
      }
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
          /* keep empty */
        }
        setSaveMsg(formatPatchFailureMessage(res.status, errData, errBody.slice(0, 240)));
        setOrderPdfRetryOpen(true);
        return;
      }
      const stored = readGeneratedDocumentFromResponseHeader(res.headers.get(IRISS_GENERATED_DOCUMENT_HEADER));
      if (stored) ingestGeneratedDocument(stored.doc, stored.workspaceRevision);
      await downloadPdfBlobFromResponse(res, "pasutijums.pdf", (href, name) => setPdfRetryBar({ href, name }));
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
      setOrderPdfRetryOpen(true);
    } finally {
      setOrderPdfBusy(false);
    }
  }, [ingestGeneratedDocument, rec.id, save]);

  const retryOrderPdfOnly = useCallback(async () => {
    setPdfRetryBar(null);
    setOrderPdfBusy(true);
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
      const stored = readGeneratedDocumentFromResponseHeader(res.headers.get(IRISS_GENERATED_DOCUMENT_HEADER));
      if (stored) ingestGeneratedDocument(stored.doc, stored.workspaceRevision);
      await downloadPdfBlobFromResponse(res, "pasutijums.pdf", (href, name) => setPdfRetryBar({ href, name }));
      setOrderPdfRetryOpen(false);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      setOrderPdfBusy(false);
    }
  }, [ingestGeneratedDocument, rec.id]);

  const openCreateOffer = useCallback(() => {
    setOfferAutoFields(new Set());
    setOfferSeedStatus(null);
    setOfferDraft(newOfferDraft(rec.offers.length + 1));
    setOfferOpen(true);
  }, [rec.offers.length]);

  const retryGoogleContact = useCallback(async () => {
    if (!persistedIdRef.current) return;
    setGoogleContactBusy(true);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/google-contact`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        record?: IrissPasutijumsRecord;
        googleContactsConfigured?: boolean;
      };
      if (typeof data.googleContactsConfigured === "boolean") {
        setGoogleContactsConfigured(data.googleContactsConfigured);
      }
      if (data.record) {
        setRec((current) => {
          const merged = mergeServerOwnedIrissFields(current, data.record);
          try {
            const snap = JSON.parse(lastSavedSnapshot.current) as IrissPasutijumsRecord;
            lastSavedSnapshot.current = JSON.stringify(mergeServerOwnedIrissFields(snap, data.record));
          } catch {
            /* keep */
          }
          return merged;
        });
      }
    } finally {
      setGoogleContactBusy(false);
    }
  }, [rec.id]);

  const openCreateOfferFromHit = useCallback(
    (hit: IrissOrderRoomHit) => {
      const seed = irissOfferSeedFromHit(hit);
      const draft = newOfferDraft(rec.offers.length + 1);
      const auto = new Set<string>();
      for (const key of OFFER_AUTO_FIELD_KEYS) {
        const v = seed[key as keyof typeof seed];
        if (typeof v === "string" && v.trim()) auto.add(key);
      }
      setOfferAutoFields(auto);
      setOfferSeedStatus(null);
      setOfferDraft({
        ...draft,
        ...seed,
        year: seed.year,
        mileage: seed.mileage,
        priceGermany: seed.priceGermany,
        odometerReading: seed.odometerReading || seed.mileage,
        comment: "",
        attachments: attachmentsFromAuctionPhotoUrls(auctionPhotoUrlsFromHit(hit)),
      });
      setOfferOpen(true);
    },
    [rec.offers.length],
  );

  /** Forma atveras uzreiz; auto lauki un /STOCK bildes ielādējas tajā (bez starplapas). */
  const openCreateOfferFromSource = useCallback(
    (from: string) => {
      const ref = parseOfferSourceRef(from);
      if (!ref) return;
      const draft = { ...newOfferDraft(rec.offers.length + 1), sourceRef: offerSourceRefString(ref) };
      const sourceLabel = OFFER_SOURCE_LABEL_LV[ref.kind];
      setOfferAutoFields(new Set());
      setOfferDraft(draft);
      setOfferSeedStatus({ loading: true, note: "", sourceLabel });
      setOfferOpen(true);
      void (async () => {
        try {
          const res = await fetch(`/api/admin/iriss-offer-seed?from=${encodeURIComponent(from)}`, { credentials: "include" });
          if (!res.ok) {
            setOfferSeedStatus({ loading: false, note: "Auto dati nav atrasti - aizpildi ar roku.", sourceLabel });
            return;
          }
          const seed = (await res.json()) as {
            fields?: Partial<OfferDraft>;
            autoFields?: string[];
            attachments?: IrissOfferAttachment[];
            photosNote?: string;
          };
          setOfferDraft((d) =>
            d.id === draft.id
              ? {
                  ...d,
                  ...(seed.fields ?? {}),
                  attachments: [...(seed.attachments ?? []), ...d.attachments].slice(0, IRISS_MAX_OFFER_ATTACHMENTS),
                }
              : d,
          );
          setOfferAutoFields(new Set(seed.autoFields ?? []));
          setOfferSeedStatus({ loading: false, note: seed.photosNote ?? "", sourceLabel });
        } catch {
          setOfferSeedStatus({ loading: false, note: "Neizdevās ielādēt auto datus - aizpildi ar roku.", sourceLabel });
        }
      })();
    },
    [rec.offers.length],
  );

  const onOfferAutoFieldEdited = useCallback((key: string) => {
    setOfferAutoFields((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const openEditOffer = useCallback((offer: IrissOfferRecord) => {
    setOfferDraft(offerDraftFromRecord(offer));
    setOfferAutoFields(new Set());
    setOfferSeedStatus(null);
    setOfferOpen(true);
  }, []);

  useEffect(() => {
    if (autoOpenOfferDone.current) return;
    if (autoOpenOfferId) {
      const existing = rec.offers.find((o) => o.id === autoOpenOfferId);
      // Gaida sīktēlus, citādi režģis atveras ar tukšām bildēm.
      if (existing && !imagesReady) return;
      if (existing) {
        autoOpenOfferDone.current = true;
        openEditOffer(existing);
        return;
      }
    }
    if (!autoOpenNewOffer) return;
    autoOpenOfferDone.current = true;
    if (seedFrom) openCreateOfferFromSource(seedFrom);
    else openCreateOffer();
  }, [autoOpenNewOffer, autoOpenOfferId, imagesReady, openCreateOffer, openCreateOfferFromSource, openEditOffer, rec.offers, seedFrom]);

  const offerAttachmentCount = offerDraft.attachments.length;
  const onOfferFilesPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const remaining = IRISS_MAX_OFFER_ATTACHMENTS - offerAttachmentCount;
      if (remaining <= 0) return;
      const fileArr = Array.from(files).slice(0, 30);
      const existingNameSize = new Set(offerDraft.attachments.map((a) => attachmentNameSizeKey(a.name, a.size)));
      const seenNameSize = new Set<string>();
      const toProcess: File[] = [];
      let skippedByNameSize = 0;
      for (const file of fileArr) {
        const key = attachmentNameSizeKey(file.name, file.size);
        if (existingNameSize.has(key) || seenNameSize.has(key)) {
          skippedByNameSize += 1;
          continue;
        }
        seenNameSize.add(key);
        toProcess.push(file);
      }
      const candidates = toProcess.slice(0, remaining);
      if (candidates.length === 0) {
        if (skippedByNameSize > 0) {
          setSaveMsg(`Izlaisti ${skippedByNameSize} dublikāti (vienāds nosaukums/izmērs).`);
        }
        return;
      }
      setOfferFilePrepare({ pct: 0, label: "Saspiež attēlus…" });
      const existingFingerprints = new Set<string>();
      for (const att of offerDraft.attachments) {
        existingFingerprints.add(await buildAttachmentFingerprint(att));
      }
      const loaded: IrissOfferAttachment[] = [];
      const loadedFingerprints = new Set<string>();
      let skippedByFingerprint = 0;
      for (let i = 0; i < candidates.length; i++) {
        const att = await fileToCompressedOfferAttachment(candidates[i]);
        if (att) {
          const fp = await buildAttachmentFingerprint(att);
          if (existingFingerprints.has(fp) || loadedFingerprints.has(fp)) {
            skippedByFingerprint += 1;
          } else {
            loaded.push(att);
            loadedFingerprints.add(fp);
          }
        }
        setOfferFilePrepare({
          pct: Math.round(((i + 1) / candidates.length) * 100),
          label: "Saspiež attēlus…",
        });
      }
      setOfferFilePrepare(null);
      if (loaded.length > 0) {
        setOfferDraft((d) => ({
          ...d,
          attachments: [...d.attachments, ...loaded].slice(0, IRISS_MAX_OFFER_ATTACHMENTS),
        }));
      }
      const skippedTotal = skippedByNameSize + skippedByFingerprint;
      if (skippedTotal > 0) {
        setSaveMsg(`Izlaisti ${skippedTotal} dublikāti (nosaukums/izmērs vai SHA-256 saturs).`);
      }
    },
    [offerAttachmentCount, offerDraft.attachments],
  );

  const [albumFileBusy, setAlbumFileBusy] = useState(false);
  const onAlbumFiles = useCallback(
    async (albumId: IrissOrderPhotoAlbumId, files: FileList | null) => {
      if (!files || files.length === 0) return;
      const current = albumId === "inspection" ? rec.inspectionPhotos : rec.documentPhotos;
      const existing = current?.attachments ?? [];
      const remaining = IRISS_MAX_OFFER_ATTACHMENTS - existing.length;
      if (remaining <= 0) return;
      const candidates = Array.from(files).slice(0, remaining);
      setAlbumFileBusy(true);
      try {
        const loaded: IrissOfferAttachment[] = [];
        for (const file of candidates) {
          const att = await fileToCompressedOfferAttachment(file);
          if (att) loaded.push(att);
        }
        if (loaded.length === 0) return;
        const next = {
          attachments: [...existing, ...loaded].slice(0, IRISS_MAX_OFFER_ATTACHMENTS),
          ...(current?.coverAttachmentId ? { coverAttachmentId: current.coverAttachmentId } : {}),
        };
        patchRecord(albumId === "inspection" ? { inspectionPhotos: next } : { documentPhotos: next });
      } finally {
        setAlbumFileBusy(false);
      }
    },
    [patchRecord, rec.documentPhotos, rec.inspectionPhotos],
  );

  const commitOfferDraftToRecord = useCallback(
    async (
      onUploadProgress?: (loaded: number, total: number) => void,
    ): Promise<{ offer: IrissOfferRecord | null; error?: string }> => {
      const now = new Date().toISOString();
      const cleanedTitle = offerDraft.title.trim() || `Piedāvājums ${rec.offers.length + 1}`;
      const offerOut: IrissOfferRecord = offerRecordFromDraft(offerDraft, { title: cleanedTitle, nowIso: now });
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

  useAdminScrollLock(offerOpen || deleteConfirmOpen || offerDeleteConfirmOpen);

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
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      const waitAutosaveIdle = async (timeoutMs = 2400) => {
        const started = Date.now();
        while (autosaveInFlight.current && Date.now() - started < timeoutMs) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 45));
        }
      };
      await waitAutosaveIdle();
      const nextOffers = rec.offers
        .filter((o) => o.id !== id)
        .map((o, idx) => ({ ...o, title: `Piedāvājums ${idx + 1}` }));
      const nextRec: IrissPasutijumsRecord = { ...rec, offers: nextOffers };
      let r = await save({ payload: nextRec, silent: true });
      if (!r.ok && r.error.includes("race")) {
        await waitAutosaveIdle(1200);
        r = await save({ payload: nextRec, silent: true });
      }
      if (!r.ok) {
        setSaveMsg("Dzēšana neizdevās.");
        return;
      }
      setRec(nextRec);
      setOfferDeleteConfirmOpen(false);
      setOfferOpen(false);
      setSaveMsg("Piedāvājums dzēsts.");
    } catch {
      setSaveMsg("Dzēšana neizdevās.");
    } finally {
      setOfferDeleteBusy(false);
    }
  }, [offerDraft.id, rec, save]);

  const shellCard = useMemo(
    () => "rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  const phoneInspect = useMemo(() => inspectIrissPhone(rec.phone), [rec.phone]);
  const normalizedPhone = phoneInspect.hrefValue;
  const orderVinWarning = useMemo(() => irissVinWarning(rec.vin), [rec.vin]);
  const specRanges = irissOrderRangeView(rec);

  const triggerCall = useCallback(() => {
    if (!normalizedPhone) return;
    if (phoneInspect.appliedLvPrefix && normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    window.location.href = `tel:${normalizedPhone}`;
  }, [normalizedPhone, patch, phoneInspect.appliedLvPrefix, rec.phone]);

  const triggerWhatsapp = useCallback(() => {
    if (!normalizedPhone) return;
    if (phoneInspect.appliedLvPrefix && normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    const digits = normalizedPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }, [normalizedPhone, patch, phoneInspect.appliedLvPrefix, rec.phone]);

  const openWhatsappText = useCallback(
    (text: string) => {
      if (!normalizedPhone) return;
      if (phoneInspect.appliedLvPrefix && normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
      const digits = normalizedPhone.replace(/[^\d]/g, "");
      if (!digits) return;
      const body = text.trim();
      const url = body ? `https://wa.me/${digits}?text=${encodeURIComponent(body)}` : `https://wa.me/${digits}`;
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [normalizedPhone, patch, phoneInspect.appliedLvPrefix, rec.phone],
  );

  const appendRoomNote = useCallback(
    (text: string) => {
      patch("notes", appendIrissOrderRoomNote(recRef.current.notes, text, new Date().toISOString()));
    },
    [patch],
  );

  const generateOfferPdfBlob = useCallback(
    async (
      offerId: string,
      includeClientData = true,
      omitImages = false,
    ): Promise<{ blob: Blob; imagesOmitted: number }> => {
      const params = new URLSearchParams();
      if (!includeClientData) params.set("client", "0");
      if (omitImages) params.set("images", "0");
      const qs = params.toString();
      const url = `/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/offer/${encodeURIComponent(offerId)}/print${
        qs ? `?${qs}` : ""
      }`;
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
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
      const omittedRaw = Number(res.headers.get("X-Iriss-Offer-Images-Omitted") ?? "0");
      const imagesOmitted = Number.isFinite(omittedRaw) && omittedRaw > 0 ? Math.trunc(omittedRaw) : 0;
      return { blob, imagesOmitted };
    },
    [rec.id],
  );

  const openOfferPdfForId = useCallback(
    async (offerId: string, omitImages = false) => {
      setOfferPdfBusy(true);
      try {
        const { blob, imagesOmitted } = await generateOfferPdfBlob(offerId, !forceNoClientPdf, omitImages);
        if (imagesOmitted > 0) {
          const notice = irissOfferImagesOmittedNotice(imagesOmitted);
          setOfferPdfNotice(notice);
          setSaveMsg(notice);
        } else {
          setOfferPdfNotice(null);
        }
        const pdfUrl = URL.createObjectURL(blob);
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120_000);
      } catch (e) {
        setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "PDF ģenerēšana neizdevās.");
      } finally {
        setOfferPdfBusy(false);
      }
    },
    [forceNoClientPdf, generateOfferPdfBlob],
  );

  // Vienotā poga: pēc veiksmīga saglabājuma ~2 s zaļš ķeksis, kļūdai sarkans.
  const pageSaveState = useSaveMessageState(saveMsg, busy || orderPdfBusy);
  const offerSaveState = useSaveMessageState(saveMsg, offerBusy);
  const persistedOfferRecord = useMemo(() => rec.offers.find((o) => o.id === offerDraft.id) ?? null, [rec.offers, offerDraft.id]);
  const offerPersistedInRecord = Boolean(persistedOfferRecord);
  const offerShareWhatsAppEnabled = Boolean(normalizedPhone);
  const offerReadyForPdfActions = useMemo(
    () => isOfferDraftSyncedWithRecord(offerDraft, persistedOfferRecord),
    [offerDraft, persistedOfferRecord],
  );
  /** Ar izvēlētu klientu: piedāvājums tiek pievienots klienta pasūtījumam, šis tukšais netiek veidots. */
  const addOfferToClientOrder = useCallback(async (client: NonNullable<IrissOfferClientChoice>): Promise<null> => {
    setOfferBusy(true);
    try {
      const offerOut = offerRecordFromDraft(offerDraft, { title: offerDraft.title, nowIso: new Date().toISOString() });
      const wire = irissSaveWirePayload({ ...rec, offers: [offerOut] }).offers[0] ?? offerOut;
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(client.orderId)}/offers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer: wire }),
      });
      const data = (await res.json().catch(() => ({}))) as { offerId?: string; error?: string };
      if (!res.ok || !data.offerId) {
        setSaveMsg(res.status === 404 ? "Klienta pasūtījums nav atrasts." : "Saglabāšana neizdevās.");
        return null;
      }
      setDirty(false);
      setSaveMsg(`Saglabāts klienta pasūtījumā: ${client.name}`);
      router.replace(
        `/admin/iriss/pasutijumi/${encodeURIComponent(client.orderId)}?offer=${encodeURIComponent(data.offerId)}`,
      );
      return null;
    } catch {
      setSaveMsg("Tīkla kļūda.");
      return null;
    } finally {
      setOfferBusy(false);
    }
  }, [offerDraft, rec, router]);

  const offerClientPickable = unsavedDraft && !persistedIdRef.current && !persistedOfferRecord;

  const persistOffer = useCallback(async (reason: "save" | "pdf" | "whatsapp"): Promise<IrissOfferRecord | null> => {
    if (offerClient && offerClientPickable) return addOfferToClientOrder(offerClient);
    if (offerReadyForPdfActions && persistedOfferRecord) {
      if (reason === "save") setSaveMsg("Saglabāts.");
      return persistedOfferRecord;
    }
    setOfferBusy(true);
    setPdfRetryBar(null);
    try {
      const { offer: offerOut, error: commitErr } = await commitOfferDraftToRecord();
      if (!offerOut) {
        setSaveMsg(commitErr ?? "Saglabāšana neizdevās.");
        return null;
      }
      if (reason === "save") setSaveMsg("Saglabāts.");
      setOfferDraft((d) => ({
        ...d,
        title: offerOut.title,
        createdAt: offerOut.createdAt || d.createdAt,
      }));
      return offerOut;
    } finally {
      setOfferBusy(false);
    }
  }, [addOfferToClientOrder, commitOfferDraftToRecord, offerClient, offerClientPickable, offerReadyForPdfActions, persistedOfferRecord]);

  const openOfferPdfInNewTab = useCallback(async (omitImages = false) => {
    setOfferPdfBusy(true);
    const offerOut = await persistOffer("pdf");
    if (!offerOut) {
      setOfferPdfBusy(false);
      return;
    }
    try {
      const { blob, imagesOmitted } = await generateOfferPdfBlob(offerOut.id, !forceNoClientPdf, omitImages);
      if (omitImages) {
        setOfferPdfNotice("PDF sagatavots bez attēliem.");
        setOfferPdfAllowWithoutImages(false);
      } else if (imagesOmitted > 0) {
        setOfferPdfNotice(irissOfferImagesOmittedNotice(imagesOmitted));
        setOfferPdfAllowWithoutImages(true);
      } else {
        setOfferPdfNotice(null);
        setOfferPdfAllowWithoutImages(false);
      }
      const pdfUrl = URL.createObjectURL(blob);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120_000);
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 180) : "PDF ar attēliem neizdevās.";
      setOfferPdfNotice(`${message} Attēli nav izmesti.`);
      setOfferPdfAllowWithoutImages(!omitImages);
      setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "PDF ģenerēšana neizdevās.");
    } finally {
      setOfferPdfBusy(false);
    }
  }, [forceNoClientPdf, generateOfferPdfBlob, persistOffer]);

  const openOfferShareWhatsApp = useCallback(async () => {
    if (!normalizedPhone) return;
    if (phoneInspect.appliedLvPrefix && normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    const digits = normalizedPhone.replace(/[^\d]/g, "");
    if (!digits) return;
    setOfferWhatsappBusy(true);
    const offerOut = await persistOffer("whatsapp");
    if (!offerOut) {
      setOfferWhatsappBusy(false);
      return;
    }
    try {
      const { blob, imagesOmitted } = await generateOfferPdfBlob(offerOut.id, !forceNoClientPdf);
      if (imagesOmitted > 0) {
        setOfferPdfNotice(irissOfferImagesOmittedNotice(imagesOmitted));
        setOfferPdfAllowWithoutImages(true);
      }
      const filenameBase = buildIrissOfferShareSubject(offerDraft).replace(/[^\p{L}\p{N}\-_. ]/gu, "").trim() || "piedavajums";
      const safeFileName = filenameBase.endsWith(".pdf") ? filenameBase : `${filenameBase}.pdf`;
      const shareText = buildIrissOfferClientShareBody(
        offerDraft,
        forceNoClientPdf ? "" : rec.clientFirstName,
        forceNoClientPdf ? "" : rec.clientLastName,
        safeFileName,
      );

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = safeFileName;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);

      // Neizmantojam `navigator.share({ files })` - iOS atver visu sistēmas „Share” paneli, ne tikai WhatsApp.
      // `wa.me` ar `text=` atver WhatsApp ar sarunu pasūtījuma tālruņa numuram; PDF jāpievieno manuāli pēc lejupielādes.
      const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(shareText)}`;
      window.location.assign(waUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 180) : "PDF ar attēliem neizdevās.";
      setOfferPdfNotice(`${message} Attēli nav izmesti.`);
      setOfferPdfAllowWithoutImages(true);
      setSaveMsg(e instanceof Error ? e.message.slice(0, 220) : "WhatsApp eksports neizdevās.");
    } finally {
      setOfferWhatsappBusy(false);
    }
  }, [
    forceNoClientPdf,
    generateOfferPdfBlob,
    normalizedPhone,
    offerDraft,
    patch,
    persistOffer,
    phoneInspect.appliedLvPrefix,
    rec.clientFirstName,
    rec.clientLastName,
    rec.phone,
  ]);

  return (
    <div
      className={
        unsavedDraft
          ? "mx-auto w-full max-w-[1200px] bg-white px-3 pb-8 max-md:px-0 max-md:pb-28 sm:px-6 lg:px-10"
          : "mx-auto w-full min-w-0 max-w-[1280px] overflow-x-hidden bg-[#f4f5f7] px-3 pb-4 max-md:px-0 max-md:pb-28 sm:px-4 lg:px-5"
      }
    >
      <IrissUnsavedChangesGuard dirty={dirty} onSave={saveCurrentPage} />
      {unsavedDraft ? (
      <>
      <AdminDashboardHeaderWithMenu
        mobileTitle={rec.brandModel.trim() || "Pasūtījums"}
        mobileBackHref="/admin/iriss/pasutijumi"
      >
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/iriss/pasutijumi"
            title="Atpakaļ"
            aria-label="Atpakaļ"
            className="inline-flex min-h-11 items-center gap-0.5 self-start text-[17px] font-medium text-[var(--color-provin-accent)] md:min-h-10 md:gap-1.5 md:rounded-full md:border md:border-slate-200/90 md:bg-white md:px-3 md:py-1.5 md:text-[12px] md:font-semibold md:shadow-sm md:hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5 shrink-0 md:h-4 md:w-4" strokeWidth={2.3} aria-hidden />
            <span>Pasūtījumi</span>
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
                    style={
                      isIrissOfferExpired(offer)
                        ? { backgroundColor: "#E5E7EB", color: "#6B7280", border: "1px solid #D1D5DB" }
                        : { backgroundColor: "#34C759", color: "black", border: "1px solid #2AB650" }
                    }
                    title={
                      isIrissOfferExpired(offer)
                        ? `${offer.title} · beidzies ${formatOfferValidUntilLv(deriveOfferValidUntil(offer))}`
                        : offer.title
                    }
                  >
                    {isIrissOfferExpired(offer) ? `P${idx + 1} beidzies` : `P${idx + 1}`}
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
                  style={
                    isIrissOfferExpired(offer)
                      ? { backgroundColor: "#E5E7EB", color: "#6B7280", border: "1px solid #D1D5DB" }
                      : { backgroundColor: "#34C759", color: "black", border: "1px solid #2AB650" }
                  }
                  title={
                    isIrissOfferExpired(offer)
                      ? `${offer.title} · beidzies ${formatOfferValidUntilLv(deriveOfferValidUntil(offer))}`
                      : offer.title
                  }
                >
                  {isIrissOfferExpired(offer) ? `P${idx + 1} beidzies` : `P${idx + 1}`}
                </button>
              ))}
              <button
                type="button"
                onClick={openCreateOffer}
                className={offerPChipButtonClass}
                style={{ backgroundColor: "#e5e5ea", color: "#3a3a3c", border: "1px solid #d1d1d6" }}
                title="Jauns piedāvājums"
                aria-label="Jauns piedāvājums"
              >
                +
              </button>
            </div>
            <div className="hidden shrink-0 flex-nowrap items-center justify-end gap-1 sm:flex-wrap sm:gap-2 md:flex">
              <AdminSaveButton
                onSave={saveCurrentPage}
                state={pageSaveState}
                shortcut
              />
              <button
                type="button"
                disabled={orderPdfBusy}
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
        {saveMsg && saveMsg !== "Saglabāts." ? (
          <p className={`mt-2 text-[12px] font-medium ${saveFailed ? "text-[#c81e1e]" : "text-[var(--color-provin-muted)]"}`} role="status">
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

      <div className={`md:hidden min-w-0 w-full ${LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}`}>
        {rec.offers.map((offer, idx) => (
          <button
            key={offer.id}
            type="button"
            onClick={() => openEditOffer(offer)}
            className={offerPChipButtonClass}
            style={
              isIrissOfferExpired(offer)
                ? { backgroundColor: "#E5E7EB", color: "#6B7280", border: "1px solid #D1D5DB" }
                : { backgroundColor: "#34C759", color: "black", border: "1px solid #2AB650" }
            }
            title={
              isIrissOfferExpired(offer)
                ? `${offer.title} · beidzies ${formatOfferValidUntilLv(deriveOfferValidUntil(offer))}`
                : offer.title
            }
          >
            {isIrissOfferExpired(offer) ? `P${idx + 1} beidzies` : `P${idx + 1}`}
          </button>
        ))}
        <button
          type="button"
          onClick={openCreateOffer}
          className={offerPChipButtonClass}
          style={{ backgroundColor: "#e5e5ea", color: "#3a3a3c", border: "1px solid #d1d1d6" }}
          title="Jauns piedāvājums"
          aria-label="Jauns piedāvājums"
        >
          +
        </button>
      </div>

      {revisionConflict ? (
        <div className="mt-3">
          <AdminWorkspaceRevisionConflictBanner
            kind={IRISS_STALE_REVISION}
            busy={conflictBusy || busy}
            onReload={reloadConflict}
            onSafeMerge={mergeConflict}
            layout="room"
          />
        </div>
      ) : null}

      {isIrissRecordDeleted(rec) ? (
        <div className="mt-3 rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-2.5 text-amber-950" role="status">
          <p className="text-[12px] font-semibold">Šis pasūtījums ir miskastē.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void restoreDeleted()}
            className="mt-2 inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-amber-400/80 bg-white px-3 text-[12px] font-semibold text-amber-950 disabled:opacity-50"
          >
            Atjaunot
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-4 sm:mt-4 sm:space-y-5">
        <section className={shellCard}>
          <IrissListingPlatformChipsRow rec={rec} />
        </section>

        <section className={shellCard}>
          <BlockTitle>Transportlīdzekļa specifikācija</BlockTitle>
          <div className="iriss-mobile-kv iriss-spec-fields">
            <div className="iriss-spec-top">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]">Statuss</span>
                <select
                  className={fieldClass}
                  value={canonicalIrissPasutijumsListStatus(rec.listStatus)}
                  onChange={(e) => setListStatus(parseIrissPasutijumsListStatus(e.target.value))}
                  aria-label="Pasūtījuma statuss"
                >
                  {IRISS_PASUTIJUMS_PICKER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {IRISS_PASUTIJUMS_PICKER_STATUS_LV[s]}
                    </option>
                  ))}
                </select>
                {rec.listStatus === "inactive" ? (
                  <input
                    className={`${fieldClass} mt-1.5`}
                    value={rec.inactiveReason ?? ""}
                    onChange={(e) => setRec((r) => withAutoEcarstradeLinks(setIrissInactiveReason(r, e.target.value)))}
                    placeholder="Iemesls (neobligāti)"
                    aria-label="Neaktīvs iemesls"
                  />
                ) : null}
                {(rec.statusHistory ?? []).length > 0 ? (
                  <ol className="mt-1.5 space-y-0.5">
                    {[...(rec.statusHistory ?? [])].slice(-6).reverse().map((h) => (
                      <li key={`${h.at}-${h.from}-${h.to}`} className="text-[11px] text-[var(--color-provin-muted)]">
                        {h.at.slice(0, 16).replace("T", " ")}: {displayIrissPasutijumsListStatusLabel(h.from)} →{" "}
                        {displayIrissPasutijumsListStatusLabel(h.to)}
                        {h.reason ? ` (${h.reason})` : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </label>
              <LabeledInput
                label="Marka / modelis"
                value={rec.brandModel}
                onChange={(e) => patch("brandModel", e.target.value)}
              />
              <LabeledInput
                label="Modeļa paplašinājums"
                value={rec.modelExtension}
                placeholder="piem., S-line"
                onChange={(e) => patch("modelExtension", e.target.value)}
              />
            </div>
            <IrissSpecDiapazoniBlock
              ranges={specRanges}
              onPatchRange={patchRange}
              rangeError={(pair) => irissOrderRangeErrorFor(rec, pair)}
              inputClassName={fieldClass}
            />
            <div className="iriss-spec-rest">
              <IrissSpecChoiceSelect
                label="Degviela"
                value={fuelSelectValue(rec.engineType)}
                options={IRISS_FUEL_SELECT_OPTIONS}
                selectClassName={fieldClass}
                labelClassName="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]"
                onChange={(value) => patch("engineType", persistFuelSelect(value, rec.engineType))}
              />
              <IrissSpecChoiceSelect
                label="Ātrumkārba"
                value={gearboxSelectValue(rec.transmission)}
                options={IRISS_GEARBOX_SELECT_OPTIONS}
                selectClassName={fieldClass}
                labelClassName="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]"
                onChange={(value) => patch("transmission", persistGearboxSelect(value, rec.transmission))}
              />
              <IrissSpecChoiceSelect
                label="Virsbūves tips"
                value={bodySelectValue(rec.bodyType)}
                options={IRISS_BODY_SELECT_OPTIONS}
                selectClassName={fieldClass}
                labelClassName="mb-1 block text-[11px] font-medium text-[var(--color-provin-muted)]"
                onChange={(value) => patch("bodyType", persistBodySelect(value, rec.bodyType))}
              />
              <LabeledInput
                label="Piedziņas tips"
                value={rec.driveType}
                onChange={(e) => patch("driveType", e.target.value)}
                placeholder="piem., priekšējā, 4x4"
              />
              <LabeledInput
                label="Sēdvietu skaits"
                value={rec.seatCount}
                onChange={(e) => patch("seatCount", e.target.value)}
                placeholder="piem., 5"
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
              <LabeledInput
                wrapperClassName="iriss-spec-full"
                label="Salona apdare"
                value={rec.interiorFinish}
                onChange={(e) => patch("interiorFinish", e.target.value)}
              />
              <div className="iriss-spec-full">
                <IrissSectionHeading>Darījuma detaļas</IrissSectionHeading>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {IRISS_DEAL_DETAIL_OPTIONS.map((opt) => (
                    <label key={opt.key} className="inline-flex items-center gap-2 text-[12px] text-[var(--color-apple-text)]">
                      <input
                        type="checkbox"
                        checked={Boolean(rec[opt.key])}
                        onChange={(e) => patch(opt.key, e.target.checked)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />
        </section>

        <SharedOrderCriteriaForm source={rec} />

        <section className={shellCard}>
          <BlockTitle>Aprīkojums</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledTextarea
              label="Obligātās prasības"
              value={rec.equipmentRequired}
              onChange={(e) => patch("equipmentRequired", e.target.value)}
            />
            <IrissInternalNoteField
              label="Piezīmes aģentam"
              value={rec.agentNotes}
              onChange={(value) => patch("agentNotes", value)}
              className={textareaClass}
              labelClassName="text-[11px] font-medium text-[var(--color-provin-muted)]"
            />
            <div className="sm:col-span-2">
              <LabeledTextarea
                label="Vēlamās prasības"
                value={rec.equipmentDesired}
                onChange={(e) => patch("equipmentDesired", e.target.value)}
              />
            </div>
          </div>
          <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />
        </section>

        <section className={shellCard}>
          <BlockTitle>Piezīmes</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledTextarea label="Piezīmes" value={rec.notes} onChange={(e) => patch("notes", e.target.value)} />
            <IrissInternalNoteField
              label="Piezīmes (iekšējās)"
              value={rec.internalNotes}
              onChange={(value) => patch("internalNotes", value)}
              className={textareaClass}
              labelClassName="text-[11px] font-medium text-[var(--color-provin-muted)]"
            />
          </div>
          <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />
        </section>

        <section className={shellCard}>
          <BlockTitle>Klienta dati</BlockTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Vārds, uzvārds"
              value={[rec.clientFirstName, rec.clientLastName].filter(Boolean).join(" ").trim()}
              onChange={(e) => {
                const normalized = e.target.value.replace(/\s+/g, " ").trim();
                if (!normalized) {
                  patchRecord({ clientFirstName: "", clientLastName: "" });
                  return;
                }
                const [first, ...rest] = normalized.split(" ");
                patchRecord({ clientFirstName: first ?? "", clientLastName: rest.join(" ") });
              }}
              autoComplete="name"
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
              {phoneInspect.warning ? <p className="mt-1 text-[11px] text-amber-800">{phoneInspect.warning}</p> : null}
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
          <IrissGoogleContactStatusRow
            rec={rec}
            configured={googleContactsConfigured}
            busy={googleContactBusy}
            onRetry={() => void retryGoogleContact()}
            buttonClass="inline-flex h-10 min-h-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[var(--color-provin-accent)] shadow-sm"
          />
          <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />
        </section>

        <section className={shellCard}>
          <BlockTitle>Sludinājumu platformas (saites)</BlockTitle>
          <IrissListingPlatformsFields
            rec={rec}
            onPatch={patchRecord}
            onReadLink={(url) => void readListingLink(url)}
            readingUrl={readingListingUrl}
            readCountByUrl={listingReadByUrl}
          />
          <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />
        </section>

        <DzintarzemeTameSection
          orderId={rec.id}
          shellCard={shellCard}
          draft={rec.dzintarzemeTameDraft ?? defaultIrissDzintarzemeTameDraft()}
          orderBrandModel={rec.brandModel}
          onDraftChange={(next) => patchRecord({ dzintarzemeTameDraft: next })}
          onGeneratedDocument={ingestGeneratedDocument}
          sectionSave={<IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={saveCurrentPage} />}
        />

        <section className={`${shellCard} border-red-100/80 bg-red-50/20`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={openCreateOffer}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Izveidot piedāvājumu
            </button>
            <AdminSaveButton
              onSave={saveCurrentPage}
              state={pageSaveState}
              className="min-h-[44px] w-full sm:w-auto"
            />
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

      <div className="iriss-action-dock md:hidden">
        <button
          type="button"
          disabled={orderPdfBusy}
          onClick={() => void openPdf()}
          className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-[var(--color-provin-accent)] shadow-[inset_0_0_0_1px_#d1d1d6]"
        >
          {orderPdfBusy ? "PDF…" : "Līgums"}
        </button>
        <button
          type="button"
          onClick={openCreateOffer}
          className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-[#111827] text-[15px] font-semibold text-white"
        >
          Piedāvājums
        </button>
        <AdminSaveButton
          onSave={saveCurrentPage}
          state={pageSaveState}
          className="!h-[50px] flex-1 text-[15px]"
        />
      </div>
      </>
      ) : (
        <IrissOrderRoom
          rec={rec}
          hits={roomHitsLive}
          onMarketplaceLoaded={() => void refreshRoomHits()}
          onReadLink={(url) => void readListingLink(url)}
          readingUrl={readingListingUrl}
          readCountByUrl={listingReadByUrl}
          dismissedHitIds={dismissedHitIds}
          listingsCache={listingsCache}
          initialHitStatus={coerceIrissHitStatusMap(initialHitStatus)}
          duplicatesByListing={coerceIrissDuplicatesByListing(duplicatesByListing)}
          initialTab={coerceIrissOrderRoomTab(initialRoomTab)}
          busy={busy}
          orderPdfBusy={orderPdfBusy}
          saveMsg={saveMsg}
          orderPdfRetryOpen={orderPdfRetryOpen}
          phoneWarning={phoneInspect.warning}
          vinWarning={orderVinWarning}
          canCall={Boolean(normalizedPhone)}
          canEmail={Boolean(rec.email.trim())}
          conflict={
            revisionConflict ? (
              <AdminWorkspaceRevisionConflictBanner
                kind={IRISS_STALE_REVISION}
                busy={conflictBusy || busy}
                onReload={reloadConflict}
                onSafeMerge={mergeConflict}
                layout="room"
              />
            ) : null
          }
          deleted={isIrissRecordDeleted(rec)}
          onPatch={patch}
          onPatchRange={patchRange}
          onPatchRecord={patchRecord}
          onInactiveReason={(value) => setRec((r) => withAutoEcarstradeLinks(setIrissInactiveReason(r, value)))}
          onSetStatus={setListStatus}
          onSave={saveCurrentPage}
          onSaveCriteria={saveCriteria}
          onPdf={() => void openPdf()}
          onRetryPdf={() => void retryOrderPdfOnly()}
          onDismissPdfRetry={() => setOrderPdfRetryOpen(false)}
          onCall={triggerCall}
          onWhatsappText={openWhatsappText}
          onAppendNote={appendRoomNote}
          onCreateOffer={() => setOfferSourceSheetOpen(true)}
          onEditOffer={openEditOffer}
          onPrepareOffer={openCreateOfferFromHit}
          googleContactsConfigured={googleContactsConfigured}
          googleContactBusy={googleContactBusy}
          onRetryGoogleContact={() => void retryGoogleContact()}
          onGeneratedDocument={ingestGeneratedDocument}
          onOpenOfferPdf={(offerId, omitImages) => void openOfferPdfForId(offerId, omitImages)}
          onAlbumFiles={(album, files) => void onAlbumFiles(album, files)}
          albumBusy={albumFileBusy}
          onRestore={() => void restoreDeleted()}
          onOrderRestored={(record) => setRec(withAutoEcarstradeLinks(record))}
          initialOfferLinks={initialOfferLinks}
          onDeleteOrder={() => {
            setOfferOpen(false);
            setDeleteConfirmOpen(true);
          }}
        />
      )}

      {offerOpen ? (
        <IrissOfferForm
          orderId={persistedIdRef.current}
          savedPendingPhotos={persistedOfferRecord ? pendingDropboxPhotoCount(persistedOfferRecord.attachments) : 0}
          draft={offerDraft}
          setDraft={setOfferDraft}
          autoFields={offerAutoFields}
          busy={offerBusy}
          filePrepare={offerFilePrepare}
          deleteBusy={offerDeleteBusy}
          pdfBusy={offerPdfBusy}
          whatsappBusy={offerWhatsappBusy}
          readyForPdfActions={offerReadyForPdfActions}
          shareWhatsAppEnabled={offerShareWhatsAppEnabled}
          saveState={offerSaveState}
          pdfNotice={offerPdfNotice}
          pdfAllowWithoutImages={offerPdfAllowWithoutImages}
          onClose={() => setOfferOpen(false)}
          onDelete={() => setOfferDeleteConfirmOpen(true)}
          onSave={() => void persistOffer("save")}
          onPdf={(allowWithoutImages) => void openOfferPdfInNewTab(allowWithoutImages)}
          onWhatsApp={openOfferShareWhatsApp}
          onFilesPick={(files) => void onOfferFilesPick(files)}
          onAutoFieldEdited={onOfferAutoFieldEdited}
          seedStatus={offerSeedStatus}
          headerSlot={
            offerClientPickable ? (
              <IrissOfferClientPicker value={offerClient} onChange={setOfferClient} disabled={offerBusy} />
            ) : (
              <IrissOfferClientPicker
                value={null}
                onChange={() => {}}
                lockedName={`${rec.clientFirstName} ${rec.clientLastName}`.replace(/\s+/g, " ").trim()}
              />
            )
          }
        />
      ) : null}

      {offerSourceSheetOpen ? (
        <IrissOfferSourceSheet
          onClose={() => setOfferSourceSheetOpen(false)}
          onOpen={(from) => {
            setOfferSourceSheetOpen(false);
            if (from) openCreateOfferFromSource(from);
            else openCreateOffer();
          }}
        />
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
