"use client";

import { AdminSaveButton, useSaveMessageState } from "@/components/admin/AdminSaveButton";
import { ArrowLeft, FileDown, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminWorkspaceRevisionConflictBanner } from "@/components/admin/AdminWorkspaceRevisionConflictBanner";
import { IrissListingPlatformChipsRow } from "@/components/admin/IrissListingPlatformsSection";
import { IrissOfferForm } from "@/components/admin/IrissOfferForm";
import {
  OFFER_SOURCE_LABEL_LV,
  offerSourceRefString,
  parseOfferSourceRef,
  pendingDropboxPhotoCount,
} from "@/lib/iriss-stock-photos";
import { IrissOfferClientPicker, type IrissOfferClientChoice } from "@/components/admin/IrissOfferClientPicker";
import { IrissOfferSourceSheet } from "@/components/admin/IrissOfferSourceSheet";
import { irissPdNewHref } from "@/lib/iriss-pd-entry";
import { irissHitAuctionUrl } from "@/lib/iriss-order-search-view";
import { IrissOrderRoom, IrissOrderStepCards } from "@/components/admin/IrissOrderRoom";
import { IRISS_ORDER_STEPS } from "@/lib/iriss-order-steps";
import { IrissUnsavedChangesGuard } from "@/components/admin/IrissUnsavedChangesGuard";
import type { IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import { IRISS_OFFER_LINK_NEEDS_DEADLINE, offerClientLinkDeadlineReady, pickReusableOfferClientLink } from "@/lib/iriss-offer-form-link";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import { coerceIrissDuplicatesByListing, coerceIrissHitStatusMap, coerceIrissOrderRoomTab } from "@/lib/iriss-order-room-match-props";
import {
  OFFER_AUTO_FIELD_KEYS,
  OFFER_UNSAVED_CLOSE_CONFIRM,
  isOfferDraftSyncedWithRecord,
  newOfferDraft,
  offerDraftHasOperatorInput,
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
import { irissAuctionListingFieldMap, type IrissAuctionListingRaw } from "@/lib/iriss-auction-listing-field-map";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { IRISS_AUCTION_LINK_LABEL, offerLinkErrorNote, parseIrissAuctionLink } from "@/lib/iriss-auction-link";
import type { IrissAuctionDetailExtras } from "@/lib/iriss-auction-detail";
import { mergeServerOwnedIrissFields } from "@/lib/iriss-server-owned-fields";
import {
  irissDraftFieldLabel,
  takeIrissDraftHandoff,
  writeIrissDraftHandoff,
} from "@/lib/iriss-pasutijumi-draft-handoff";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { adoptServerMergedFields, pickRecordAfterOrderSave, type IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import { withAutoEcarstradeLinks } from "@/lib/iriss-pasutijumi-ecarstrade-links";
import {
  applyIrissOrderRangeEdit,
  applyIrissOrderSpecTextEdit,
  isIrissOrderSpecTextKey,
  syncIrissOrderRangesFromLegacy,
  type IrissOrderRangeField,
  type IrissOrderSpecTextKey,
} from "@/lib/iriss-order-range-fields";
import {
  appendIrissStatusHistory,
  applyIrissFieldEdit,
  irissRequiredFieldWarnings,
  isIrissRecordDeleted,
  setIrissInactiveReason,
} from "@/lib/iriss-pasutijumi-audit-fields";
import {
  IRISS_EMPTY_NEW_ORDER_MSG,
  IRISS_STALE_REVISION,
  irissPasutijumsHasOperatorContent,
  irissWorkspaceRevision,
  mergeIrissPasutijumsRecords,
  planSilentAutosave,
} from "@/lib/iriss-pasutijumi-save-safety";
import { inspectIrissPhone } from "@/lib/iriss-phone-normalize";
import { createIrissPdFromListing, irissPdHref } from "@/lib/iriss-pd-from-listing-client";
import {
  clearIrissOrderBackup,
  formatIrissBackupTime,
  irissAutosaveRetryDelayMs,
  irissAutosaveShouldRetry,
  irissOrderBackupDiffers,
  readIrissOrderBackup,
  writeIrissOrderBackup,
  type IrissOrderBackup,
} from "@/lib/iriss-order-save-status";
import {
  buildIrissOfferClientShareBody,
  buildIrissOfferShareSubject,
  irissOfferImagesOmittedNotice,
} from "@/lib/iriss-offer-share";
import { irissVinWarning } from "@/lib/iriss-vin-check";
import {
  IRISS_MAX_OFFER_ATTACHMENTS,
  type IrissGeneratedDocument,
  type IrissOfferAttachment,
  type IrissOfferRecord,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
  buildListingPlatformChips,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
} from "@/lib/iriss-listing-links";
import { fileToCompressedOfferAttachment } from "@/lib/iriss-offer-image-compress";
import type { IrissOrderPhotoAlbumId } from "@/lib/iriss-order-photos";
import {
  deriveOfferValidUntil,
  formatOfferValidUntilLv,
  isIrissOfferExpired,
  offerValidUntilYmdFromAt,
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



/** P1/P2/+ telefonā: pieskāriena mērķis vismaz 44x44 (bāzes čips ir logo platumā - "+" bija 11 px). */
const offerPChipButtonClass = `${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} min-h-11 min-w-11 cursor-pointer select-none rounded-full px-3`;



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
  if (status === 400 && data && typeof data === "object" && (data as { error?: unknown }).error === "empty_record") {
    return IRISS_EMPTY_NEW_ORDER_MSG;
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

/** Esošais Gemini tulkojuma ceļš (translate-damage); kļūdas gadījumā tukšs. */
async function translateDamageLv(text: string): Promise<string> {
  try {
    const res = await fetch("/api/admin/iriss-offer-seed/translate-damage", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = res.ok ? ((await res.json().catch(() => ({}))) as { lv?: string }) : null;
    return data?.lv?.trim() ?? "";
  } catch {
    return "";
  }
}

type OfferSeedStatus = { loading: boolean; note: string; sourceLabel: string; linkUrl?: string };

/** Piedāvājuma lauki + foto (izsoles secībā) no izsoles hit; kopīgs "Sagatavot piedāvājumu" un "No saites" ceļam. */
function offerSeedPatchFromHit(hit: IrissOrderRoomHit): { fields: Partial<OfferDraft>; auto: Set<string>; damageText: string } {
  const seed = irissOfferSeedFromHit(hit);
  const auto = new Set<string>();
  for (const key of OFFER_AUTO_FIELD_KEYS) {
    const v = seed[key as keyof typeof seed];
    if (typeof v === "string" && v.trim()) auto.add(key);
  }
  if (seed.doorCount.trim()) auto.add("doorCount");
  const fields: Partial<OfferDraft> = {
    ...seed,
    odometerReading: seed.odometerReading || seed.mileage,
    comment: "",
    attachments: attachmentsFromAuctionPhotoUrls(auctionPhotoUrlsFromHit(hit)),
  };
  const damageText =
    irissAuctionListingFieldMap(hit.platform)?.freeText(hit as unknown as IrissAuctionListingRaw).visualDamageText?.trim() ?? "";
  return { fields, auto, damageText };
}

/** Lauki, kurus lietotājs jau sāka rakstīt (nav tukši), netiek pārrakstīti. Izsoles foto nāk pirms paša pievienotajiem. */
function mergeOfferSeedIntoDraft(
  d: OfferDraft,
  fields: Partial<OfferDraft>,
  auto: ReadonlySet<string>,
  /** Iepriekš auto-aizpildīti un vēl neaiztikti lauki: precīzāki dati (detaļu lapa) tos var aizstāt. */
  overwrite: ReadonlySet<string> = new Set(),
): { draft: OfferDraft; auto: Set<string> } {
  const next: OfferDraft = { ...d };
  const filled = new Set<string>();
  for (const [key, value] of Object.entries(fields) as Array<[keyof OfferDraft, OfferDraft[keyof OfferDraft]]>) {
    if (key === "attachments") continue;
    const cur = d[key];
    if (typeof value !== "string" || typeof cur !== "string") continue;
    if (!value.trim() || (cur.trim() && !overwrite.has(key))) continue;
    (next as Record<string, unknown>)[key] = value;
    if (auto.has(key)) filled.add(key);
  }
  if (fields.attachments?.length) next.attachments = [...fields.attachments, ...d.attachments].slice(0, IRISS_MAX_OFFER_ATTACHMENTS);
  return { draft: next, auto: filled };
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
  pdEntry = false,
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
  /** Administrators: jauni piedāvājumi tikai PD sadaļā (Nils 27.10, viena sistēma). Darbinieks - esošā forma. */
  pdEntry?: boolean;
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
  const [offerSeedStatus, setOfferSeedStatus] = useState<OfferSeedStatus | null>(null);
  const [offerBusy, setOfferBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [offerDeleteConfirmOpen, setOfferDeleteConfirmOpen] = useState(false);
  const [offerDeleteBusy, setOfferDeleteBusy] = useState(false);
  const offerDeleteBackdropClose = useModalBackdropClose(() => setOfferDeleteConfirmOpen(false), !offerDeleteBusy);
  const deleteBackdropClose = useModalBackdropClose(() => setDeleteConfirmOpen(false), !deleteBusy);
  const [orderPdfBusy, setOrderPdfBusy] = useState(false);
  const [offerPdfBusy, setOfferPdfBusy] = useState(false);
  const [offerPdfNotice, setOfferPdfNotice] = useState<string | null>(null);
  const [offerPdfAllowWithoutImages, setOfferPdfAllowWithoutImages] = useState(false);
  const [offerWhatsappBusy, setOfferWhatsappBusy] = useState(false);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(() => newOfferDraft(1));
  const offerAutoFieldsRef = useRef(offerAutoFields);
  offerAutoFieldsRef.current = offerAutoFields;
  const offerDraftRef = useRef(offerDraft);
  offerDraftRef.current = offerDraft;
  const autoOpenOfferDone = useRef(false);
  const lastSavedSnapshot = useRef(JSON.stringify(withAutoEcarstradeLinks(initialRecord)));
  const recRef = useRef(rec);
  recRef.current = rec;
  const autosaveTimer = useRef<number | null>(null);
  const autosaveInFlight = useRef(false);
  const autosaveQueued = useRef(false);
  const saveRef = useRef<(opts?: { silent?: boolean }) => Promise<SaveResult>>(async () => ({ ok: false, error: "init" }));
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const [autoSaving, setAutoSaving] = useState(0);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [backupOffer, setBackupOffer] = useState<IrissOrderBackup | null>(null);
  const backupPending = useRef(true);
  const persistedIdRef = useRef(unsavedDraft ? "" : initialRecord.id);
  const draftHandoffPending = useRef(false);
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

  const saveRaw = useCallback(
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
      const persistId = persistedIdRef.current;
      const isCreate = !persistId;
      // FABLE v3: tukšs jauns pasūtījums - serveris atbild 400 empty_record; neko nesūta un nerāda tehnisku kļūdu.
      if (isCreate && !irissPasutijumsHasOperatorContent(payload)) {
        if (!silent) setSaveMsg(IRISS_EMPTY_NEW_ORDER_MSG);
        return { ok: false, error: "empty_record" };
      }
      if (!silent) {
        setBusy(true);
        const required = irissRequiredFieldWarnings(payload);
        setSaveMsg(required.length ? required.join(" ") : null);
      }
      if (silent) autosaveInFlight.current = true;

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
            const picked =
              JSON.stringify(current) !== JSON.stringify(payload)
                ? adoptServerMergedFields(current, payload, record, ["offers"])
                : pickRecordAfterOrderSave(current, payload, record);
            const merged = mergeServerAttachmentStorage(mergeServerOwnedIrissFields(picked, record), record);
            lastSavedSnapshot.current = JSON.stringify(merged);
            return merged;
          });
        } else {
          setRec((current) => {
            const concurrent = JSON.stringify(current) !== JSON.stringify(payload);
            const base = adoptServerMergedFields(concurrent ? current : payload, payload, record, ["offers"]);
            const merged = mergeServerAttachmentStorage(mergeServerOwnedIrissFields(base, record), record);
            lastSavedSnapshot.current = JSON.stringify(
              mergeServerAttachmentStorage(
                mergeServerOwnedIrissFields(adoptServerMergedFields(payload, payload, record, ["offers"]), record),
                record,
              ),
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
        if (isCreate && (record?.id || payload.id)) draftHandoffPending.current = true;
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
              void saveRef.current({ silent: true });
            }, 0);
          }
        }
      }
    },
    [router],
  );

  // Drošā saglabāšana (Nils 29.10): patiesais stāvoklis galvenē + automātiska atkārtošana, ja neizdodas.
  const save = useCallback(
    async (opts?: Parameters<typeof saveRaw>[0]): Promise<SaveResult> => {
      const silent = opts?.silent === true;
      if (silent) setAutoSaving((n) => n + 1);
      let result: SaveResult;
      try {
        result = await saveRaw(opts);
      } finally {
        if (silent) setAutoSaving((n) => Math.max(0, n - 1));
      }
      if (retryTimer.current) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      if (result.ok) {
        retryAttempt.current = 0;
        setAutoSaveError(null);
      } else if (irissAutosaveShouldRetry(result.error)) {
        setAutoSaveError(result.error);
        // Pēc ~8 mēģinājumiem (~6 min) pārstāj; stāvoklis paliek sarkans, poga ļauj mēģināt vēlreiz.
        if (retryAttempt.current >= 8) return result;
        const delay = irissAutosaveRetryDelayMs(retryAttempt.current);
        retryAttempt.current += 1;
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          void saveRef.current({ silent: true });
        }, delay);
      }
      return result;
    },
    [saveRaw],
  );
  saveRef.current = save;

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
              void saveRef.current({ silent: true });
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

  // Bez interneta: rāda stāvokli; kad savienojums atgriežas, saglabā uzreiz.
  useEffect(() => {
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      if (JSON.stringify(recRef.current) !== lastSavedSnapshot.current) void saveRef.current({ silent: true });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, []);

  // Rezerves kopija pārlūkā: ja iepriekšējā reizē izmaiņas nepaspēja aiziet uz serveri, piedāvā atjaunot.
  useEffect(() => {
    const id = persistedIdRef.current;
    if (!id) {
      backupPending.current = false;
      return;
    }
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const backup = storage ? readIrissOrderBackup(storage, id, new Date()) : null;
    if (backup && irissOrderBackupDiffers(backup.rec, withAutoEcarstradeLinks(initialRecord))) {
      setBackupOffer(backup);
    } else {
      backupPending.current = false;
      if (storage) clearIrissOrderBackup(storage, id);
    }
    // Tikai atverot ierakstu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = persistedIdRef.current;
    if (!id || backupPending.current) return;
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }
    if (!dirty) {
      clearIrissOrderBackup(storage, id);
      return;
    }
    const t = window.setTimeout(() => writeIrissOrderBackup(storage, recRef.current, new Date()), 400);
    return () => window.clearTimeout(t);
  }, [rec, dirty]);

  const restoreBackup = useCallback(() => {
    if (!backupOffer) return;
    const merged = withAutoEcarstradeLinks(mergeIrissPasutijumsRecords(recRef.current, backupOffer.rec));
    backupPending.current = false;
    setBackupOffer(null);
    setRec(merged);
    recRef.current = merged;
    setSaveMsg("Izmaiņas atjaunotas no rezerves kopijas - saglabājas.");
  }, [backupOffer]);

  const dismissBackup = useCallback(() => {
    backupPending.current = false;
    setBackupOffer(null);
    try {
      clearIrissOrderBackup(window.localStorage, persistedIdRef.current);
    } catch {
      /* nav krātuves */
    }
  }, []);

  // Jauns pasūtījums → /pasutijumi/{id} ir cita lapa: redaktors tiek uzstādīts no jauna.
  // Nesaglabātais teksts un fokuss tiek nodots jaunajam redaktoram, citādi «Toyota» paliek «To».
  useLayoutEffect(() => {
    if (!unsavedDraft) return;
    return () => {
      const id = persistedIdRef.current;
      if (!draftHandoffPending.current || !id) return;
      const active = document.activeElement;
      const field =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
      let selectionStart: number | null = null;
      let selectionEnd: number | null = null;
      try {
        selectionStart = field?.selectionStart ?? null;
        selectionEnd = field?.selectionEnd ?? null;
      } catch {
        /* type=date u.c. bez selection */
      }
      const label = irissDraftFieldLabel(field);
      writeIrissDraftHandoff(
        window.sessionStorage,
        id,
        recRef.current,
        label ? { label, selectionStart, selectionEnd } : null,
        Date.now(),
      );
    };
  }, [unsavedDraft]);

  useLayoutEffect(() => {
    if (unsavedDraft) return;
    const handoff = takeIrissDraftHandoff<IrissPasutijumsRecord>(window.sessionStorage, initialRecord.id, Date.now());
    if (!handoff) return;
    const server = recRef.current;
    const merged = withAutoEcarstradeLinks(
      mergeServerAttachmentStorage(mergeServerOwnedIrissFields(handoff.rec, server), server),
    );
    merged.workspaceRevision = Math.max(
      irissWorkspaceRevision(server),
      irissWorkspaceRevision(handoff.rec),
    );
    if (JSON.stringify(merged) !== JSON.stringify(server)) {
      setRec(merged);
      recRef.current = merged;
    }
    const focus = handoff.focus;
    if (!focus) return;
    const raf = window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).find(
        (el) => !el.disabled && irissDraftFieldLabel(el) === focus.label,
      );
      if (!target || document.activeElement !== document.body) return;
      target.focus({ preventScroll: false });
      try {
        if (focus.selectionStart !== null && focus.selectionEnd !== null) {
          target.setSelectionRange(focus.selectionStart, focus.selectionEnd);
        }
      } catch {
        /* lauks bez selection */
      }
    });
    return () => window.cancelAnimationFrame(raf);
    // Tikai uzstādīšanas brīdī.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** "Pagarināt" saites joslā: serveris jau saglabāja jauno termiņu - pārņem to bez konflikta. */
  const ingestOfferDeadline = useCallback((offerId: string, validUntilAt: string, workspaceRevision?: number | null) => {
    const apply = (r: IrissPasutijumsRecord): IrissPasutijumsRecord => ({
      ...r,
      offers: r.offers.map((o) =>
        o.id === offerId ? { ...o, validUntilAt, validUntil: offerValidUntilYmdFromAt(validUntilAt) } : o,
      ),
      ...(typeof workspaceRevision === "number" ? { workspaceRevision } : {}),
    });
    setRec((r) => {
      const next = apply(r);
      try {
        lastSavedSnapshot.current = JSON.stringify(apply(JSON.parse(lastSavedSnapshot.current) as IrissPasutijumsRecord));
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

  // Viena piedāvājumu sistēma (Nils 27.10): saglabātā pasūtījumā administrators veido piedāvājumu PD,
  // klients un pasūtījums piesaistās automātiski. Vecie piedāvājumi šeit paliek lasāmi un nosūtāmi.
  const pdNew = pdEntry && !unsavedDraft;
  const createOfferEntry = useCallback(() => {
    if (pdNew) router.push(irissPdNewHref({ orderId: rec.id }));
    else openCreateOffer();
  }, [pdNew, router, rec.id, openCreateOffer]);

  // Nils 29.10: piedāvājums no Meklētāja atbilstības - tieši no sludinājuma datiem, šī pasūtījuma klientam.
  const hitOfferBusy = useRef(false);
  const prepareOfferFromHit = useCallback(
    async (hit: IrissOrderRoomHit) => {
      if (hitOfferBusy.current) return;
      hitOfferBusy.current = true;
      const name = [rec.clientFirstName, rec.clientLastName].map((x) => x.trim()).filter(Boolean).join(" ");
      const res = await createIrissPdFromListing(hit.id, { name, phone: rec.phone, email: rec.email, orderId: rec.id });
      hitOfferBusy.current = false;
      if (res.ok) {
        router.push(irissPdHref(res.id));
        return;
      }
      // Sludinājums vairs nav kopā (piem. pazudis) - kā agrāk, no izsoles saites.
      router.push(irissPdNewHref({ link: irissHitAuctionUrl(hit), orderId: rec.id }));
    },
    [rec.clientFirstName, rec.clientLastName, rec.phone, rec.email, rec.id, router],
  );

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

  /** Bojājumu teksts (AUTO1/OPENLANE) vienmēr jātulko latviski (Gemini) - fonā, nekavējot loga atvēršanu. */
  const translateOfferDamage = useCallback((draftId: string, text: string, status: OfferSeedStatus) => {
    setOfferSeedStatus({ ...status, loading: true, note: "tulko bojājumu aprakstu" });
    void (async () => {
      try {
        const res = await fetch("/api/admin/iriss-offer-seed/translate-damage", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = res.ok ? ((await res.json().catch(() => ({}))) as { lv?: string }) : null;
        const lv = data?.lv?.trim() ?? "";
        if (lv) {
          setOfferDraft((d) => {
            if (d.id !== draftId) return d;
            const patch: { damageGrade?: string; visualAssessment?: string } = {};
            // Manuāli rakstītu tekstu nepārrakstam - lietotājs varēja sākt rakstīt tulkošanas brīdī.
            if (!d.damageGrade.trim()) patch.damageGrade = lv;
            if (!d.visualAssessment.trim()) patch.visualAssessment = lv;
            return Object.keys(patch).length > 0 ? { ...d, ...patch } : d;
          });
          setOfferSeedStatus({ ...status, loading: false, note: "" });
        } else {
          setOfferSeedStatus(status.linkUrl ? { ...status, loading: false, note: "" } : null);
        }
      } catch {
        setOfferSeedStatus(status.linkUrl ? { ...status, loading: false, note: "" } : null);
      }
    })();
  }, []);

  const openCreateOfferFromHit = useCallback(
    (hit: IrissOrderRoomHit) => {
      const { fields, auto, damageText } = offerSeedPatchFromHit(hit);
      const nextDraft: OfferDraft = { ...newOfferDraft(rec.offers.length + 1), ...fields };
      setOfferAutoFields(auto);
      setOfferSeedStatus(null);
      setOfferDraft(nextDraft);
      setOfferOpen(true);
      if (damageText) {
        const sourceLabel = IRISS_LISTING_PLATFORM_LABEL[hit.platform] ?? hit.platform;
        translateOfferDamage(nextDraft.id, damageText, { loading: true, note: "", sourceLabel });
      }
    },
    [rec.offers.length, translateOfferDamage],
  );

  /**
   * j56 "No saites": logs atveras uzreiz tukšs. 1) IRISS sarakstu hit (ātri, A), 2) releja detaļu lapa (B):
   * papildlauki + pilns foto komplekts izsoles secībā. Lietotāja ierakstītais netiek pārrakstīts.
   */
  const openCreateOfferFromLink = useCallback(
    (url: string) => {
      const link = parseIrissAuctionLink(url);
      if (!link) return;
      const draft = newOfferDraft(rec.offers.length + 1);
      const status: OfferSeedStatus = { loading: true, note: "", sourceLabel: IRISS_AUCTION_LINK_LABEL[link.platform], linkUrl: link.url };
      setOfferAutoFields(new Set());
      setOfferDraft(draft);
      setOfferSeedStatus(status);
      setOfferOpen(true);
      const stillOpen = () => offerDraftRef.current.id === draft.id;
      const post = async (mode: "listing" | "detail") => {
        const res = await fetch("/api/admin/iriss-offer-seed/from-link", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: link.url, mode }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          hit?: IrissOrderRoomHit;
          extras?: IrissAuctionDetailExtras;
          error?: string;
          note?: string;
        };
        return res.ok && data.hit ? data : { ...data, hit: undefined };
      };
      const applyHit = (hit: IrissOrderRoomHit, replacePhotoIds: readonly string[] | null) => {
        const { fields, auto, damageText } = offerSeedPatchFromHit(hit);
        const cur = offerDraftRef.current;
        // Foto: ja lietotājs saraksta foto nav aiztikis, detaļu lapas pilnais komplekts tos aizstāj.
        const untouched = replacePhotoIds != null && cur.attachments.map((a) => a.id).join("|") === replacePhotoIds.join("|");
        const base = untouched ? { ...cur, attachments: [] } : cur;
        const photosForMerge = replacePhotoIds && !untouched ? { ...fields, attachments: [] } : fields;
        const overwrite = replacePhotoIds ? offerAutoFieldsRef.current : new Set<string>();
        const merged = mergeOfferSeedIntoDraft(base, photosForMerge, auto, overwrite);
        setOfferDraft((d) =>
          d.id === draft.id ? mergeOfferSeedIntoDraft(untouched ? { ...d, attachments: [] } : d, photosForMerge, auto, overwrite).draft : d,
        );
        setOfferAutoFields((prev) => new Set([...prev, ...merged.auto]));
        return { damageText, photoIds: merged.draft.attachments.map((a) => a.id) };
      };
      void (async () => {
        let listingPhotoIds: string[] | null = null;
        let damageText = "";
        try {
          const listed = await post("listing");
          if (!stillOpen()) return;
          if (listed.hit) {
            const r = applyHit(listed.hit, null);
            listingPhotoIds = r.photoIds;
            damageText = r.damageText;
          }
          setOfferSeedStatus({ ...status, note: "lasa izsoles lapu" });
          const detail = await post("detail");
          if (!stillOpen()) return;
          if (detail.hit) {
            const r = applyHit(detail.hit, listingPhotoIds);
            damageText = r.damageText || damageText;
            const ex = detail.extras;
            if (ex) {
              const extraFields: Partial<OfferDraft> = {
                keyCount: ex.keyCount,
                emissionClass: ex.emissionClass,
                engineDisplacement: ex.engineDisplacement,
                equipmentHighlights: ex.equipmentHighlights,
                technicalAssessment: ex.technicalFacts,
              };
              const extraAuto = new Set(["keyCount", "emissionClass", "engineDisplacement"]);
              const merged = mergeOfferSeedIntoDraft(offerDraftRef.current, extraFields, extraAuto);
              setOfferDraft((d) =>
                d.id === draft.id
                  ? {
                      ...mergeOfferSeedIntoDraft(d, extraFields, extraAuto).draft,
                      hasFullServiceHistory: d.hasFullServiceHistory || ex.hasFullServiceHistory,
                    }
                  : d,
              );
              setOfferAutoFields((prev) => new Set([...prev, ...merged.auto]));
              if (ex.technicalIssueText.trim()) {
                void translateDamageLv(ex.technicalIssueText).then((lv) => {
                  if (!lv) return;
                  setOfferDraft((d) => {
                    if (d.id !== draft.id || d.technicalAssessment.includes(lv)) return d;
                    const prev = d.technicalAssessment.trim();
                    return { ...d, technicalAssessment: prev ? `${prev}. ${lv}` : lv };
                  });
                });
              }
            }
          } else if (!listed.hit) {
            setOfferSeedStatus({ ...status, loading: false, note: offerLinkErrorNote(detail.error, detail.note) });
            return;
          }
          if (damageText) translateOfferDamage(draft.id, damageText, status);
          else setOfferSeedStatus({ ...status, loading: false, note: "" });
        } catch {
          setOfferSeedStatus({ ...status, loading: false, note: "Neizdevās ielādēt auto datus - aizpildi ar roku." });
        }
      })();
    },
    [rec.offers.length, translateOfferDamage],
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
    () => "rounded-xl border border-[var(--iriss-line)] bg-white p-4 shadow-sm sm:p-5",
    [],
  );

  const phoneInspect = useMemo(() => inspectIrissPhone(rec.phone), [rec.phone]);
  const normalizedPhone = phoneInspect.hrefValue;
  const orderVinWarning = useMemo(() => irissVinWarning(rec.vin), [rec.vin]);
  const triggerCall = useCallback(() => {
    if (!normalizedPhone) return;
    if (phoneInspect.appliedLvPrefix && normalizedPhone !== rec.phone.trim()) patch("phone", normalizedPhone);
    window.location.href = `tel:${normalizedPhone}`;
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

  const persistOffer = useCallback(async (reason: "save" | "pdf" | "whatsapp" | "link"): Promise<IrissOfferRecord | null> => {
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

  // j61 kājene "Links": saglabā, tad nokopē esošo aktīvo klienta saiti vai izveido jaunu (termiņš obligāts).
  const [offerLinkBusy, setOfferLinkBusy] = useState(false);
  const [offerLinkNotice, setOfferLinkNotice] = useState<{ text: string; url: string } | null>(null);
  const openOfferClientLink = useCallback(async () => {
    setOfferLinkBusy(true);
    setOfferLinkNotice(null);
    try {
      const offerOut = await persistOffer("link");
      const orderId = persistedIdRef.current;
      if (!offerOut || !orderId) return;
      const base = `/api/admin/iriss-pasutijumi/${encodeURIComponent(orderId)}`;
      let path = "";
      const listRes = await fetch(`${base}/client-links`, { credentials: "include", cache: "no-store" });
      if (listRes.ok) {
        const data = (await listRes.json().catch(() => ({}))) as { links?: IrissOfferClientLinkAdminView[] };
        path = pickReusableOfferClientLink(Array.isArray(data.links) ? data.links : [], offerOut.id)?.path ?? "";
      }
      if (!path) {
        if (!offerClientLinkDeadlineReady(offerOut.validUntilAt, Date.now())) {
          setOfferLinkNotice({ text: IRISS_OFFER_LINK_NEEDS_DEADLINE, url: "" });
          return;
        }
        const res = await fetch(`${base}/offer/${encodeURIComponent(offerOut.id)}/client-link`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", expiresInDays: null }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; link?: IrissOfferClientLinkAdminView };
        if (!res.ok || !data.link?.path) {
          setOfferLinkNotice({
            text: data.error === "save_first" ? "Vispirms saglabājiet pasūtījumu un piedāvājumu." : "Saiti neizdevās izveidot.",
            url: "",
          });
          return;
        }
        path = data.link.path;
      }
      const url = `${window.location.origin}${path}`;
      // Pēc await pārlūks (īpaši iOS) var kopēšanu noraidīt vai atstāt karājamies - tad paliek poga "Kopēt".
      const copied = await Promise.race([
        navigator.clipboard?.writeText(url).then(
          () => true,
          () => false,
        ) ?? Promise.resolve(false),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 1500)),
      ]);
      setOfferLinkNotice({ text: copied ? "Klienta saite nokopēta" : "Klienta saite gatava", url });
    } catch {
      setOfferLinkNotice({ text: "Tīkla kļūda - saiti neizdevās iegūt.", url: "" });
    } finally {
      setOfferLinkBusy(false);
    }
  }, [persistOffer]);

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
          ? "mx-auto w-full max-w-[1200px] bg-[#f4f5f7] px-3 pb-8 max-md:px-0 max-md:pb-28 sm:px-6 lg:px-10"
          : "mx-auto w-full min-w-0 max-w-[1280px] overflow-x-hidden bg-[#f4f5f7] px-3 pb-4 max-md:px-0 max-md:pb-28 sm:px-4 lg:px-5"
      }
    >
      <IrissUnsavedChangesGuard dirty={dirty} onSave={saveCurrentPage} />
      {unsavedDraft ? (
      <>
      <AdminDashboardHeaderWithMenu
        mobileTitle={rec.brandModel.trim() || "Jauns pasūtījums"}
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
                  Jauns pasūtījums
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
                onClick={createOfferEntry}
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
                label="Izveidot pasūtījumu"
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
          onClick={createOfferEntry}
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
        {/* Bez saitēm rinda neko nerāda - bez tukšas kartītes (FABLE 25.10). */}
        {buildListingPlatformChips(rec).length > 0 ? (
          <section className={shellCard}>
            <IrissListingPlatformChipsRow rec={rec} />
          </section>
        ) : null}

        {/* Nils 31.10 (makets «Jauns pasūtījums v2»): tie paši 6 soļi kā atvērtā pasūtījumā; tāme, avanss un dokumenti - pēc izveides. */}
        <nav aria-label="Soļi" className="flex flex-wrap gap-1.5 max-md:px-3">
          {IRISS_ORDER_STEPS.map((step, i) => (
            <a
              key={step.id}
              href={i === IRISS_ORDER_STEPS.length - 1 ? "#iriss-room-client" : `#iriss-step-${step.id}`}
              className="inline-flex min-h-[32px] items-center rounded-full bg-white px-3 text-[12.5px] font-semibold text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)]"
            >
              {i + 1} {step.title}
            </a>
          ))}
        </nav>
        <div className="space-y-3">
          <IrissOrderStepCards
            draft
            rec={rec}
            onPatch={patch}
            onPatchRange={patchRange}
            onPatchRecord={patchRecord}
            onInactiveReason={(value) => setRec((r) => withAutoEcarstradeLinks(setIrissInactiveReason(r, value)))}
            onReadLink={(url) => void readListingLink(url)}
            readingUrl={readingListingUrl}
            readCountByUrl={listingReadByUrl}
            phoneWarning={phoneInspect.warning}
            googleContactsConfigured={googleContactsConfigured}
            googleContactBusy={googleContactBusy}
            onRetryGoogleContact={() => void retryGoogleContact()}
          />
        </div>

        <section className={`${shellCard} border-red-100/80 bg-red-50/20`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={createOfferEntry}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Izveidot piedāvājumu
            </button>
            <AdminSaveButton
              onSave={saveCurrentPage}
              state={pageSaveState}
              label="Izveidot pasūtījumu"
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
          onClick={createOfferEntry}
          className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-[var(--iriss-graphite)] text-[15px] font-semibold text-white"
        >
          Piedāvājums
        </button>
        <AdminSaveButton
          onSave={saveCurrentPage}
          state={pageSaveState}
          label="Izveidot"
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
          saveState={{ dirty, saving: busy || autoSaving > 0, error: autoSaveError, offline }}
          conflict={
            revisionConflict ? (
              <AdminWorkspaceRevisionConflictBanner
                kind={IRISS_STALE_REVISION}
                busy={conflictBusy || busy}
                onReload={reloadConflict}
                onSafeMerge={mergeConflict}
                layout="room"
              />
            ) : backupOffer ? (
              <div
                role="status"
                className="flex flex-wrap items-center gap-2 rounded-[14px] bg-[var(--iriss-surface)] px-3 py-2.5 text-[13px] text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-warn)]"
              >
                <span className="min-w-0 flex-1">
                  Atrastas nesaglabātas izmaiņas ({formatIrissBackupTime(backupOffer.at)}), kas neaizgāja uz serveri.
                </span>
                <button
                  type="button"
                  onClick={restoreBackup}
                  className="inline-flex h-9 items-center rounded-full bg-[var(--iriss-graphite)] px-4 text-[13px] font-semibold text-[var(--iriss-on-graphite)]"
                >
                  Atjaunot
                </button>
                <button
                  type="button"
                  onClick={dismissBackup}
                  className="inline-flex h-9 items-center rounded-[12px] bg-[var(--iriss-surface)] px-3 text-[13px] font-semibold text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)]"
                >
                  Atmest
                </button>
              </div>
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
          onCreateOffer={pdNew ? createOfferEntry : () => setOfferSourceSheetOpen(true)}
          onEditOffer={openEditOffer}
          onPrepareOffer={pdNew ? (hit) => void prepareOfferFromHit(hit) : openCreateOfferFromHit}
          googleContactsConfigured={googleContactsConfigured}
          googleContactBusy={googleContactBusy}
          onRetryGoogleContact={() => void retryGoogleContact()}
          onGeneratedDocument={ingestGeneratedDocument}
          onOfferDeadlineExtended={ingestOfferDeadline}
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
          onClose={() => {
            // FABLE v3: «×» ar nesaglabātām izmaiņām klusi zaudēja ievadīto (cenas u.c.).
            const unsaved = persistedOfferRecord ? !offerReadyForPdfActions : offerDraftHasOperatorInput(offerDraft);
            if (unsaved && !offerBusy && !window.confirm(OFFER_UNSAVED_CLOSE_CONFIRM)) return;
            setOfferOpen(false);
            setOfferLinkNotice(null);
          }}
          onDelete={() => setOfferDeleteConfirmOpen(true)}
          onSave={() => void persistOffer("save")}
          onPdf={(allowWithoutImages) => void openOfferPdfInNewTab(allowWithoutImages)}
          onWhatsApp={openOfferShareWhatsApp}
          onFilesPick={(files) => void onOfferFilesPick(files)}
          onAutoFieldEdited={onOfferAutoFieldEdited}
          seedStatus={offerSeedStatus}
          onLink={() => void openOfferClientLink()}
          linkBusy={offerLinkBusy}
          linkNotice={offerLinkNotice}
          onLinkNoticeClose={() => setOfferLinkNotice(null)}
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
          onOpenLink={(url) => {
            setOfferSourceSheetOpen(false);
            openCreateOfferFromLink(url);
          }}
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
          {...offerDeleteBackdropClose}
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
          {...deleteBackdropClose}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              Pārvietot pasūtījumu uz Miskasti? To var atjaunot sadaļā Miskaste.
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
