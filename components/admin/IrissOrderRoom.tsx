"use client";

import { offerSourceLabel } from "@/lib/iriss-stock-photos";
import { AdminSaveButton, useSaveMessageState } from "@/components/admin/AdminSaveButton";
import { ChevronRight, FileDown, FileText, Mail, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { IrissLazyImage } from "@/components/admin/IrissLazyImage";
import { IrissOrderRoomHitCard } from "@/components/admin/IrissOrderRoomHitCard";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminMobileRoundBtn, AdminMobileSaveStatus, AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { DzintarzemeTameSection } from "@/components/admin/DzintarzemeTameSection";
import { IrissAdvanceSection } from "@/components/admin/IrissAdvanceSection";
import { IrissClientFinancingSection } from "@/components/admin/IrissClientFinancingSection";
import { IrissCommunicationTimeline } from "@/components/admin/IrissCommunicationTimeline";
import { IrissOrderPhotoAlbumSection } from "@/components/admin/IrissOrderPhotoAlbumSection";
import { IrissPriceChangeChip, IrissPriceHistoryPanel } from "@/components/admin/IrissPriceChangeChip";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IrissOrderRoomNextSteps } from "@/components/admin/IrissOrderRoomNextSteps";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import { IrissMarketplaceLoadPanel } from "@/components/admin/IrissMarketplaceLoadPanel";
import { IrissOfferClientLinkBar } from "@/components/admin/IrissOfferClientLinkBar";
import { IrissOrderMatchBoundary, IrissOrderMatchFallback } from "@/components/admin/IrissOrderMatchBoundary";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import { IrissVinDuplicateMark } from "@/components/admin/IrissVinDuplicateMark";
import { AdminChangeHistoryButton } from "@/components/admin/AdminChangeHistoryButton";
import { IrissOrderSectionSaveButton } from "@/components/admin/IrissOrderSectionSaveButton";
import { IrissSpecDiapazoniBlock } from "@/components/admin/IrissSpecDiapazoniBlock";
import { IrissInternalNoteField } from "@/components/admin/IrissInternalNoteField";
import { IrissOrderClientDataCard } from "@/components/admin/IrissOrderClientDataCard";
import { IrissSpecChoiceSelect } from "@/components/admin/IrissSpecChoiceSelect";
import { listingHistoryRecordId } from "@/lib/admin-change-history";
import { IrissBrandLogoSlot } from "@/components/admin/IrissBrandLogoSlot";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import { listingDisplayImageUrl } from "@/lib/iriss-listing-image";
import { parseIrissOrderBudget, serializeListingOrderFilter } from "@/lib/iriss-listings-orders";
import {
  IRISS_LIST_PREFS_KEY,
  irissListBrowserStorage,
  migrateIrissListPrefs,
  parseIrissListPrefs,
  persistIrissListPrefs,
  safeStorageGet,
} from "@/lib/iriss-listings-operator-prefs";
import {
  formatGeneratedDocumentSize,
  formatGeneratedDocumentWhen,
  generatedDocumentKindLabel,
  sortGeneratedDocumentsNewestFirst,
} from "@/lib/iriss-generated-documents";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import { irissAdvancePaidToday } from "@/lib/iriss-advance";
import {
  IRISS_ADVANCE_NOT_RECEIVED,
  IRISS_ADVANCE_RECEIVED,
  IRISS_DEAL_WORKFLOW_STATUSES,
  formatIrissOverviewFinancingChip,
  formatIrissOverviewPlatformsLine,
  formatIrissOverviewSavedCapsule,
  irissDealWorkflowStatusOf,
  irissOverviewAdvanceReceived,
} from "@/lib/iriss-order-overview-view";
import {
  newIrissCommunicationEvent,
  timelineFromPasutijums,
  type IrissCommFilter,
} from "@/lib/iriss-communication-timeline";
import { type IrissCommTypeFilter } from "@/lib/iriss-order-comm-view";
import { hitMatchesIrissPriceFilter, irissPriceChipFilterLabel, irissPriceHistoryRows, latestIrissPriceChip, type IrissPriceChipFilter } from "@/lib/iriss-listing-price-chips";
import { IRISS_OFFERS_CONTINUE, IRISS_OFFERS_SEND, formatIrissOffersLinksSummary, irissOfferCardPrimary } from "@/lib/iriss-order-offers-view";
import { IRISS_SEARCH_BUCKETS, formatIrissHitSourceLine, irissHitAuctionUrl } from "@/lib/iriss-order-search-view";
import {
  IRISS_ORDER_ROOM_TABS,
  IRISS_ORDER_ROOM_TEMPLATES,
  appendIrissOrderRoomNote,
  irissOrderRoomCommunicationCount,
  irissOrderRoomCriteriaChips,
  irissOrderRoomDealPill,
  irissOrderRoomDocumentCount,
  irissOrderRoomExcludeTokens,
  irissOrderRoomHitBucket,
  irissOrderRoomHitPassesCriteria,
  irissOrderRoomHitShareText,
  irissOrderRoomListingLinkCount,
  irissOrderRoomMatch,
  irissOrderRoomNextSteps,
  irissOrderRoomOfferMatchesHit,
  irissOrderRoomOfferStatus,
  irissOrderRoomOfferThumb,
  irissOrderRoomOfferTotal,
  irissOrderRoomPlatformLabels,
  irissOrderRoomRef,
  irissOrderRoomStamp,
  irissOrderRoomStatusLabel,
  irissOrderRoomVisibleHits,
  type IrissOrderRoomHit,
  type IrissOrderRoomHitBucket,
  type IrissOrderRoomTab,
} from "@/lib/iriss-order-room";
import {
  IRISS_LISTING_HIT_STATUS_LV,
  IRISS_LISTING_HIT_STATUSES,
  isIrissListingHitStatus,
  type IrissListingHitStatus,
} from "@/lib/iriss-listing-match-client";
import { irissHorizontalSwipeDirection, irissTabAfterSwipe } from "@/lib/iriss-touch-swipe";
import {
  coerceIrissDuplicatesByListing,
  coerceIrissHitStatusMap,
  coerceIrissOrderRoomTab,
  irissHitStatusIsUnset,
  irissHitStatusOf,
} from "@/lib/iriss-order-room-match-props";
import type { IrissVinDuplicateLink } from "@/lib/iriss-vin-duplicates";
import { formatIrissOfferLinkStamp, type IrissOfferClientLinkAdminView } from "@/lib/iriss-offer-client-link";
import {
  IRISS_DEAL_DETAIL_OPTIONS,
  canonicalIrissPasutijumsListStatus,
  IRISS_PASUTIJUMS_PICKER_STATUSES,
  IRISS_PASUTIJUMS_PICKER_STATUS_LV,
  defaultIrissDzintarzemeTameDraft,
  type IrissGeneratedDocument,
  type IrissOfferRecord,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  irissOrderRangeErrorFor,
  irissOrderRangeView,
  type IrissOrderRangeField,
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

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-[10px] border border-[#e5e7eb] bg-white px-2.5 py-2 text-[16px] text-[#111827] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 sm:min-h-[38px] sm:text-[13px]";

const areaClass = `${fieldClass} min-h-[60px] resize-y py-2 leading-snug sm:min-h-[60px]`;

const cardClass = "min-w-0 rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)]";

/** Nils: pasūtījumu telpas augšējā „Vēsture” pagaidām izslēgta (kods paliek). */
const IRISS_ORDER_ROOM_SHOW_CHANGE_HISTORY = false;

const roomBtn =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-semibold text-[#111827] shadow-[0_1px_2px_#0000000d] transition hover:bg-[#f9fafb] disabled:opacity-40";

const roomBtnWa =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#25D366] bg-[#25D366] px-3 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[#20BD5A] hover:brightness-105 disabled:opacity-40";

const roomBtnPrimary =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#2563eb] bg-[#2563eb] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-105 disabled:opacity-40";

const roomBtnDark =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#111827] bg-[#111827] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-110 disabled:opacity-40";

type CriteriaDraft = Pick<
  IrissPasutijumsRecord,
  | "totalBudget"
  | "productionYears"
  | "engineType"
  | "transmission"
  | "bodyType"
  | "driveType"
  | "maxMileage"
  | "preferredColors"
  | "nonPreferredColors"
  | "interiorFinish"
  | "equipmentRequired"
  | "equipmentDesired"
  | "modelExtension"
  | "agentNotes"
>;

function criteriaFrom(rec: IrissPasutijumsRecord): CriteriaDraft {
  return {
    totalBudget: rec.totalBudget,
    productionYears: rec.productionYears,
    engineType: rec.engineType,
    transmission: rec.transmission,
    bodyType: rec.bodyType,
    driveType: rec.driveType,
    maxMileage: rec.maxMileage,
    preferredColors: rec.preferredColors,
    nonPreferredColors: rec.nonPreferredColors,
    interiorFinish: rec.interiorFinish,
    equipmentRequired: rec.equipmentRequired,
    equipmentDesired: rec.equipmentDesired,
    modelExtension: rec.modelExtension,
    agentNotes: rec.agentNotes,
  };
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4 fill-current"} aria-hidden>
      <path d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return <IrissSectionHeading>{children}</IrissSectionHeading>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  id,
  warning,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
  id?: string;
  warning?: string | null;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block min-w-0${className ? ` ${className}` : ""}`}>
      <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">{label}</span>
      <input
        id={id}
        type={type}
        className={fieldClass}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {warning ? <p className="mt-1 text-[11px] text-amber-800">{warning}</p> : null}
    </label>
  );
}

function offerShareText(offer: IrissOfferRecord): string {
  const total = irissOrderRoomOfferTotal(offer);
  const bits = [offer.brandModel.trim() || offer.title.trim(), offer.firstRegistration.trim() || offer.year.trim()];
  if (total != null) bits.push(listingFmtEur(total));
  return [`Sveiki! Piedāvājums: ${bits.filter(Boolean).join(", ")}.`, "", "Labu dienu,", "PROVIN.LV"].join("\n");
}

function offerPortfolioBadge(
  offer: IrissOfferRecord,
  link: IrissOfferClientLinkAdminView | null,
): { label: string; className: string } {
  if (link?.status === "declined") {
    return { label: "Noraidīts", className: "border border-[#fca5a5] bg-[#fee2e2] text-[#991b1b]" };
  }
  if (link && link.status !== "revoked" && link.viewCount > 0) {
    return { label: `Atvērts ${link.viewCount}×`, className: "border border-[#93c5fd] bg-[#dbeafe] text-[#1e40af]" };
  }
  if (irissOrderRoomOfferStatus(offer) !== "ready") {
    return { label: "Melnraksts", className: "border border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]" };
  }
  if (link && link.status !== "revoked") {
    return { label: link.statusLabel, className: "border border-[#93c5fd] bg-[#dbeafe] text-[#1e40af]" };
  }
  return { label: "Sagatavots", className: "border border-[#93c5fd] bg-[#dbeafe] text-[#1e40af]" };
}

function replyHistoryRows(offers: IrissOfferRecord[], links: IrissOfferClientLinkAdminView[]) {
  const rows: { id: string; text: string; side: string }[] = [];
  for (const link of links) {
    const offer = offers.find((item) => item.id === link.offerId);
    const side = offer?.title.trim() || offer?.brandModel.trim() || "Piedāvājums";
    if (link.viewCount > 0) {
      const when = formatIrissOfferLinkStamp(link.statusAt || link.createdAt);
      rows.push({
        id: `${link.offerId}-view`,
        text: [when, `Klients atvēra ${side} (saite)`].filter(Boolean).join(" - "),
        side: link.statusLabel,
      });
    }
    if (link.question.trim()) {
      const when = formatIrissOfferLinkStamp(link.questionAt);
      rows.push({
        id: `${link.offerId}-q`,
        text: [when, link.question.trim()].filter(Boolean).join(" - "),
        side,
      });
    }
    if (link.decision === "approve" || link.decision === "decline") {
      const when = formatIrissOfferLinkStamp(link.decidedAt);
      rows.push({
        id: `${link.offerId}-d`,
        text: [when, link.decision === "decline" ? "Noraidīts" : "Apstiprināts"].filter(Boolean).join(" - "),
        side,
      });
    }
  }
  return rows;
}

/** Stabili noklusējumi (nevis `= []` katrā renderī). */
const EMPTY_OFFER_LINKS: IrissOfferClientLinkAdminView[] = [];
const EMPTY_HIT_STATUS: Record<string, IrissListingHitStatus> = {};
const EMPTY_DUPLICATES: Record<string, IrissVinDuplicateLink[]> = {};

export function IrissOrderRoom({
  rec,
  hits,
  onReadLink,
  readingUrl = null,
  readCountByUrl,
  dismissedHitIds,
  listingsCache,
  busy,
  orderPdfBusy,
  saveMsg,
  orderPdfRetryOpen,
  phoneWarning,
  vinWarning: _vinWarning,
  canCall,
  canEmail,
  conflict,
  deleted,
  onPatch,
  onPatchRange,
  onPatchRecord,
  onInactiveReason,
  onSetStatus,
  onSave,
  onSaveCriteria,
  onPdf,
  onRetryPdf,
  onDismissPdfRetry,
  onCall,
  onWhatsappText,
  onAppendNote,
  onCreateOffer,
  onEditOffer,
  onPrepareOffer,
  onOpenOfferPdf,
  onOfferDeadlineExtended,
  onRestore,
  onOrderRestored,
  onDeleteOrder,
  initialOfferLinks = EMPTY_OFFER_LINKS,
  initialHitStatus = EMPTY_HIT_STATUS,
  duplicatesByListing = EMPTY_DUPLICATES,
  initialTab = "overview",
  googleContactsConfigured = false,
  googleContactBusy = false,
  onRetryGoogleContact,
  onGeneratedDocument,
  onAlbumFiles,
  albumBusy = false,
  onMarketplaceLoaded,
}: {
  rec: IrissPasutijumsRecord;
  hits: IrissOrderRoomHit[];
  onReadLink?: (url: string) => void;
  readingUrl?: string | null;
  readCountByUrl?: Record<string, string>;
  dismissedHitIds: string[];
  listingsCache: "on" | "off";
  busy: boolean;
  orderPdfBusy: boolean;
  saveMsg: string | null;
  orderPdfRetryOpen: boolean;
  phoneWarning: string | null;
  vinWarning: string | null;
  canCall: boolean;
  canEmail: boolean;
  conflict: ReactNode;
  deleted: boolean;
  onPatch: <K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => void;
  onPatchRange: (field: IrissOrderRangeField, raw: string) => void;
  onPatchRecord: (patch: Partial<IrissPasutijumsRecord>) => void;
  onInactiveReason: (value: string) => void;
  onSetStatus: (status: IrissPasutijumsListStatus) => void;
  onSave: () => Promise<IrissOrderSaveResult>;
  onSaveCriteria: (patch: CriteriaDraft) => Promise<IrissOrderSaveResult>;
  onPdf: () => void;
  onRetryPdf: () => void;
  onDismissPdfRetry: () => void;
  onCall: () => void;
  onWhatsappText: (text: string) => void;
  onAppendNote: (text: string) => void;
  onCreateOffer: () => void;
  onEditOffer: (offer: IrissOfferRecord) => void;
  onPrepareOffer: (hit: IrissOrderRoomHit) => void;
  onOpenOfferPdf: (offerId: string, omitImages?: boolean) => void;
  /** "Pagarināt": serveris saglabāja jauno termiņu (validUntilAt) un revīziju. */
  onOfferDeadlineExtended?: (offerId: string, validUntilAt: string, workspaceRevision?: number | null) => void;
  onRestore: () => void;
  onOrderRestored: (record: IrissPasutijumsRecord) => void;
  onDeleteOrder: () => void;
  initialOfferLinks?: IrissOfferClientLinkAdminView[];
  initialHitStatus?: Record<string, IrissListingHitStatus>;
  duplicatesByListing?: Record<string, IrissVinDuplicateLink[]>;
  initialTab?: IrissOrderRoomTab;
  googleContactsConfigured?: boolean;
  googleContactBusy?: boolean;
  onRetryGoogleContact?: () => void;
  onGeneratedDocument?: (doc: IrissGeneratedDocument, workspaceRevision?: number) => void;
  onAlbumFiles?: (album: "inspection" | "documents", files: FileList | null) => void;
  albumBusy?: boolean;
  onMarketplaceLoaded?: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<IrissOrderRoomTab>(coerceIrissOrderRoomTab(initialTab));
  // Vienotā saglabāšanas poga: saglabā / zaļš ķeksis / kļūda no tās pašas ziņas.
  const roomSaveState = useSaveMessageState(saveMsg, busy || orderPdfBusy);
  const tabSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [bucket, setBucket] = useState<IrissOrderRoomHitBucket>("new");
  const [commFilter, setCommFilter] = useState<IrissCommFilter>("all");
  const [commTypeFilter, setCommTypeFilter] = useState<IrissCommTypeFilter>("all");
  const [priceFilter, setPriceFilter] = useState<IrissPriceChipFilter>("all");
  const [priceFilterOpen, setPriceFilterOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [criteriaOn, setCriteriaOn] = useState(false);
  const [criteriaDraft, setCriteriaDraft] = useState<CriteriaDraft>(() => criteriaFrom(rec));
  const [excludeDraft, setExcludeDraft] = useState("");
  const [criteriaBusy, setCriteriaBusy] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(stringList(dismissedHitIds)));
  const [roomMsg, setRoomMsg] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [linksOpen, setLinksOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [offerLinks, setOfferLinks] = useState<IrissOfferClientLinkAdminView[]>(Array.isArray(initialOfferLinks) ? initialOfferLinks : []);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [hitStatus, setHitStatus] = useState<Record<string, IrissListingHitStatus>>(() => coerceIrissHitStatusMap(initialHitStatus));
  const duplicates = coerceIrissDuplicatesByListing(duplicatesByListing);
  const safeHits = (Array.isArray(hits) ? hits : []).filter((hit) => hit && typeof hit.id === "string");
  useAdminScrollLock(criteriaOpen || priceFilterOpen);

  useEffect(() => {
    setDismissed(new Set(stringList(dismissedHitIds)));
  }, [dismissedHitIds]);

  useEffect(() => {
    const storage = irissListBrowserStorage();
    if (!storage) return;
    setFavIds(new Set(migrateIrissListPrefs(storage).fav));
  }, []);

  useEffect(() => {
    if (tab !== "offers") return;
    let stop = false;
    async function refreshOfferLinks() {
      try {
        const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/client-links`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { links?: IrissOfferClientLinkAdminView[] };
        if (!stop && Array.isArray(data.links)) setOfferLinks(data.links);
      } catch {
        /* statusa atsvaidzināšana ir klusa */
      }
    }
    void refreshOfferLinks();
    const timer = window.setInterval(() => void refreshOfferLinks(), 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [rec.id, tab]);

  async function mutateOfferLink(
    offerId: string,
    body: { action: "create"; expiresInDays: number | null } | { action: "revoke" } | { action: "extend"; validUntilAt: string },
  ) {
    setLinkBusyId(offerId);
    setRoomMsg(null);
    try {
      const res = await fetch(
        `/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/offer/${encodeURIComponent(offerId)}/client-link`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        link?: IrissOfferClientLinkAdminView;
        validUntilAt?: string;
        workspaceRevision?: number | null;
      };
      if (!res.ok || !data.link) {
        setRoomMsg(
          data.error === "save_first"
            ? "Vispirms saglabājiet pasūtījumu un piedāvājumu."
            : body.action === "extend"
              ? data.error === "decided"
                ? "Klients jau atbildējis - pagarināt nevar. Vajadzības gadījumā: Atsaukt un Jauna saite."
                : data.message || "Termiņu neizdevās pagarināt."
              : body.action === "revoke"
                ? "Saiti neizdevās atsaukt."
                : "Saiti neizdevās izveidot.",
        );
        return;
      }
      setOfferLinks((prev) => [...prev.filter((item) => item.offerId !== offerId), data.link!]);
      if (body.action === "extend" && data.validUntilAt) onOfferDeadlineExtended?.(offerId, data.validUntilAt, data.workspaceRevision);
    } catch {
      setRoomMsg(
        body.action === "extend" ? "Termiņu neizdevās pagarināt." : body.action === "revoke" ? "Saiti neizdevās atsaukt." : "Saiti neizdevās izveidot.",
      );
    } finally {
      setLinkBusyId(null);
    }
  }

  const offeredIds = useMemo(() => {
    const ids = new Set<string>();
    const offers = Array.isArray(rec.offers) ? rec.offers : [];
    for (const hit of safeHits) {
      try {
        if (offers.some((offer) => offer && irissOrderRoomOfferMatchesHit(offer, hit))) ids.add(hit.id);
      } catch {
        /* bojāts trāpījums nepaliek visai istabai */
      }
    }
    return ids;
  }, [rec.offers, safeHits]);

  const visibleHits = useMemo(
    () => irissOrderRoomVisibleHits(safeHits, dismissed, offeredIds),
    [dismissed, offeredIds, safeHits],
  );
  const filteredHits = useMemo(
    () =>
      criteriaOn
        ? visibleHits.filter((hit) => {
            try {
              return irissOrderRoomHitPassesCriteria(rec, hit);
            } catch {
              return false;
            }
          })
        : visibleHits,
    [criteriaOn, rec, visibleHits],
  );

  function bucketOf(hit: IrissOrderRoomHit): IrissOrderRoomHitBucket {
    return irissOrderRoomHitBucket({
      dismissed: dismissed.has(hit.id),
      saved: favIds.has(hit.id),
      offered: offeredIds.has(hit.id),
    });
  }

  const bucketCounts = useMemo(() => {
    const counts: Record<IrissOrderRoomHitBucket, number> = { new: 0, saved: 0, offered: 0, reject: 0 };
    for (const hit of filteredHits) counts[bucketOf(hit)] += 1;
    return counts;
    // bucketOf closes over dismissed/fav/offered, which are already in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, favIds, filteredHits, offeredIds]);

  const shownHits = filteredHits.filter(
    (hit) => bucketOf(hit) === bucket && hitMatchesIrissPriceFilter(hit.priceHistory, priceFilter),
  );
  const chips = irissOrderRoomCriteriaChips(rec);
  const dealPill = irissOrderRoomDealPill(rec);
  const financingChip = formatIrissOverviewFinancingChip(rec.clientFinancingPercent, rec.orderDate);
  const clientName = [rec.clientFirstName, rec.clientLastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const savedTime = irissOrderRoomStamp(rec.updatedAt).split(" ")[1] ?? "";
  const savedCapsule = formatIrissOverviewSavedCapsule(savedTime);
  const refLabel = irissOrderRoomRef(rec.id);
  const linkCount = irissOrderRoomListingLinkCount(rec);
  const platforms = irissOrderRoomPlatformLabels(visibleHits);
  const budget = parseIrissOrderBudget(rec.totalBudget);
  const newHits = visibleHits.filter((hit) => bucketOf(hit) === "new").length;
  const steps = irissOrderRoomNextSteps({
    newHits,
    offerCount: rec.offers.length,
    hasPhone: canCall,
    hasVin: Boolean(rec.vin.trim()),
  });
  const commTimeline = timelineFromPasutijums(rec, offerLinks);
  const commCount = commTimeline.length || irissOrderRoomCommunicationCount((rec.statusHistory ?? []).length, Boolean(rec.notes.trim()));
  const generatedDocs = sortGeneratedDocumentsNewestFirst(rec.generatedDocuments ?? []);
  const docCount = irissOrderRoomDocumentCount(rec.offers.length, generatedDocs.length);
  const searchHref = `/admin/iriss/sludinajumi?ord=${encodeURIComponent(serializeListingOrderFilter({ kind: "order", id: rec.id }))}`;
  const history = [...(rec.statusHistory ?? [])].reverse();
  const noteLines = rec.notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const replies = replyHistoryRows(rec.offers, offerLinks);

  function openCriteria() {
    setCriteriaDraft(criteriaFrom(rec));
    setExcludeDraft("");
    setCriteriaOpen(true);
  }

  async function saveCriteria() {
    setCriteriaBusy(true);
    const result = await onSaveCriteria(criteriaDraft);
    setCriteriaBusy(false);
    if (result.ok) {
      setCriteriaOn(true);
      setCriteriaOpen(false);
    }
  }

  function toggleFav(id: string) {
    const storage = irissListBrowserStorage();
    if (!storage) return;
    const prefs = parseIrissListPrefs(safeStorageGet(storage, IRISS_LIST_PREFS_KEY));
    const fav = prefs.fav.includes(id) ? prefs.fav.filter((x) => x !== id) : [...prefs.fav, id];
    persistIrissListPrefs(storage, { ...prefs, fav });
    setFavIds(new Set(fav));
  }

  function statusOf(hitId: string): IrissListingHitStatus {
    return irissHitStatusOf(hitStatus, hitId);
  }

  async function setListingStatus(hit: IrissOrderRoomHit, status: IrissListingHitStatus) {
    const prev = statusOf(hit.id);
    if (prev === status) return;
    setHitStatus((map) => ({ ...coerceIrissHitStatusMap(map), [hit.id]: status }));
    setRoomMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-listings/match-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ orderId: rec.id, listingId: hit.id, status }] }),
      });
      if (!res.ok) throw new Error("status");
      window.dispatchEvent(new Event("admin-iriss-matches-changed"));
    } catch {
      setHitStatus((map) => ({ ...coerceIrissHitStatusMap(map), [hit.id]: prev }));
      setRoomMsg("Sludinājuma statusu neizdevās saglabāt.");
    }
  }

  async function setHitHidden(hit: IrissOrderRoomHit, hidden: boolean) {
    setRoomMsg(null);
    setDismissed((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(hit.id);
      else next.delete(hit.id);
      return next;
    });
    try {
      const res = await fetch("/api/admin/iriss-listings/dismiss", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: hit.id, platform: hit.platform, externalId: hit.externalId, hidden }],
        }),
      });
      if (!res.ok) throw new Error("dismiss");
    } catch {
      setDismissed(new Set(dismissedHitIds));
      setRoomMsg("Sludinājuma statusu neizdevās saglabāt.");
    }
  }

  function openMail(body: string) {
    if (!rec.email.trim()) return;
    const subject = `PROVIN.LV: ${rec.brandModel.trim() || "pasūtījums"}`;
    window.location.href = `mailto:${rec.email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const actionBtn = roomBtn;
  const title = rec.brandModel.trim() || "Pasūtījums";
  const budgetLabel = rec.totalBudget.trim();

  const tabs = (
    <div className="iriss-order-tabs mt-2 flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none] md:mt-3" role="tablist" aria-label="Pasūtījuma istaba">
      {(
        [
          ["overview", "Pārskats", null],
          ["search", "Meklētājs", filteredHits.length],
          ["offers", "Piedāvājumi", rec.offers.length],
          ["communication", "Komunikācija", commCount],
          ["documents", "Dokumenti", docCount],
        ] as const
      ).map(([id, label, count]) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold ${
              active
                ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                : "bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
            }`}
          >
            {label}
            {count != null ? (
              <em className="ml-1.5 rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1.5 py-px text-[11px] font-semibold not-italic">{count}</em>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div data-iriss-order-room="1" className="iriss-parskats-view min-w-0 overflow-x-hidden pb-1">
      <AdminDashboardHeaderWithMenu
        mobileTitle={title}
        mobileBackHref="/admin/iriss/pasutijumi"
        mobileTrailing={
          <>
            <AdminMobileSaveStatus
              saved={!busy && !orderPdfBusy}
              busy={busy || orderPdfBusy}
              onSave={() => void onSave()}
            />
            <AdminMobileRoundBtn name="vairak" label="Vairāk" onClick={() => setMoreOpen(true)} />
          </>
        }
        mobileBelowTitle={
          <div className="flex h-8 items-center gap-2">
            <label className="inline-flex min-w-0 items-center">
              <span className="sr-only">Statuss</span>
              <select
                className="iriss-status-pill h-8 rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] outline-none"
                value={canonicalIrissPasutijumsListStatus(rec.listStatus)}
                aria-label="Pasūtījuma statuss"
                onChange={(e) => onSetStatus(e.target.value as IrissPasutijumsListStatus)}
              >
                {IRISS_PASUTIJUMS_PICKER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {IRISS_PASUTIJUMS_PICKER_STATUS_LV[status]}
                  </option>
                ))}
              </select>
            </label>
            <span className="min-w-0 truncate text-[13px] text-[var(--am-ink2)]">{clientName || refLabel}</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--fill-secondary)] text-[var(--label)] disabled:opacity-35"
                disabled={!canCall}
                onClick={onCall}
                title="Zvanīt"
                aria-label="Zvanīt"
              >
                <Phone className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--fill-secondary)] text-[var(--label)] disabled:opacity-35"
                disabled={!canCall}
                onClick={() => onWhatsappText("")}
                title="Atvērt WhatsApp"
                aria-label="Atvērt WhatsApp"
              >
                <WhatsAppGlyph className="h-4 w-4 fill-current" />
              </button>
              {canEmail ? (
              <button
                type="button"
                className="am-press grid h-9 w-9 place-items-center rounded-full bg-[var(--fill-secondary)] text-[var(--label)]"
                onClick={() => openMail("")}
                title="E-pasts"
                aria-label="E-pasts"
              >
                <Mail className="h-4 w-4" aria-hidden />
              </button>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="min-w-0">
          <Link
            href="/admin/iriss/pasutijumi"
            title={rec.id}
            className="mb-2 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-[#6b7280]"
          >
            <span aria-hidden>←</span>
            <span className="hidden md:inline">IRISS · Pasūtījumi / {refLabel}</span>
          </Link>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 sm:px-[18px] sm:py-3.5">
            <div className="flex min-w-0 flex-wrap items-center gap-3.5">
              <div className="hidden md:block">
                <IrissBrandLogoSlot
                  brandModel={rec.brandModel}
                  fallbackClassName="text-[#111827] font-extrabold"
                  imgLoading="eager"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[16px] font-bold leading-tight text-[#111827] md:text-[22px] md:font-semibold">{title}</h1>
                  <label className="hidden items-center md:inline-flex">
                    <span className="sr-only">Statuss</span>
                    <select
                      className="iriss-status-pill h-8 rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] outline-none"
                      value={canonicalIrissPasutijumsListStatus(rec.listStatus)}
                      aria-label="Pasūtījuma statuss"
                      onChange={(e) => onSetStatus(e.target.value as IrissPasutijumsListStatus)}
                    >
                      {IRISS_PASUTIJUMS_PICKER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {IRISS_PASUTIJUMS_PICKER_STATUS_LV[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {financingChip ? (
                    <span className="iriss-deal-pill hidden h-8 items-center rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] md:inline-flex">
                      {financingChip}
                    </span>
                  ) : dealPill ? (
                    <span className="iriss-deal-pill hidden h-8 items-center rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] md:inline-flex">
                      {dealPill}
                    </span>
                  ) : null}
                  {IRISS_ORDER_ROOM_SHOW_CHANGE_HISTORY ? (
                    <AdminChangeHistoryButton
                      kind="iriss-order"
                      recordId={rec.id}
                      endpoint="/api/admin/change-history"
                      className="ml-auto"
                      onRestored={(body) => {
                        const record = body.record;
                        if (record && typeof record.id === "string") onOrderRestored(record as IrissPasutijumsRecord);
                      }}
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-[#6b7280] md:text-[13px]">
                  <span className="md:hidden">
                    {[clientName, budgetLabel].filter(Boolean).join(" · ")}
                    {dealPill ? (
                      <>
                        {clientName || budgetLabel ? " · " : null}
                        <span className="font-semibold text-[#15803d]">{dealPill} ✓</span>
                      </>
                    ) : null}
                  </span>
                  <span className="hidden md:inline">
                    {[clientName, rec.phone.trim(), rec.email.trim()].filter(Boolean).join(" · ")}
                    {budgetLabel ? (
                      <>
                        {(clientName || rec.phone.trim() || rec.email.trim()) ? " · " : null}
                        budžets <b className="font-bold text-[var(--ink)]">{budgetLabel}</b>
                      </>
                    ) : null}
                  </span>
                </p>
              </div>
              <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
                <span className="inline-flex h-8 items-center rounded-full bg-[var(--fill)] px-2.5 text-[12px] font-semibold text-[var(--ink)]">
                  {savedCapsule}
                </span>
                <button type="button" className={roomBtnWa} disabled={!canCall} onClick={() => onWhatsappText("")}>
                  <WhatsAppGlyph className="h-4 w-4 fill-current" />
                  WhatsApp
                </button>
                {canEmail ? (
                  <button type="button" className={roomBtn} onClick={() => openMail("")}>
                    <Mail className="h-4 w-4" aria-hidden />
                    E-pasts
                  </button>
                ) : null}
                <button type="button" className={roomBtn} disabled={orderPdfBusy} onClick={onPdf}>
                  <FileDown className="h-4 w-4" aria-hidden />
                  {orderPdfBusy ? "PDF…" : "Līgums PDF"}
                </button>
                <IrissOverflowMenu label="Vairāk">
                  <IrissOverflowItem onClick={onDeleteOrder}>Dzēst pasūtījumu</IrissOverflowItem>
                </IrissOverflowMenu>
              </div>
            </div>
          </div>
        </div>
      </AdminDashboardHeaderWithMenu>
      {tabs}

      {saveMsg ? (
        <p className="mt-2 text-[12px] font-medium text-[var(--color-provin-muted)]" role="status">
          {saveMsg}
        </p>
      ) : null}
      {roomMsg ? (
        <p className="mt-2 text-[12px] font-medium text-amber-800" role="status">
          {roomMsg}
        </p>
      ) : null}
      {orderPdfRetryOpen ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950" role="status">
          <p className="font-semibold">Saglabāšana ir veiksmīga. PDF ģenerēšana vai lejupielāde neizdevās.</p>
          <button type="button" onClick={onRetryPdf} className="mt-1.5 inline-flex min-h-9 items-center rounded-full border border-amber-300/90 bg-white px-3 text-[12px] font-semibold text-[var(--color-provin-accent)]">
            Lejupielādēt PDF vēlreiz
          </button>
          <button type="button" onClick={onDismissPdfRetry} className="ml-2 text-[11px] font-medium text-slate-600 underline">
            Aizvērt
          </button>
        </div>
      ) : null}
      {conflict ? <div className="mt-3">{conflict}</div> : null}
      {deleted ? (
        <div className="mt-3 rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-2.5 text-amber-950" role="status">
          <p className="text-[12px] font-semibold">Šis pasūtījums ir miskastē.</p>
          <button
            type="button"
            disabled={busy}
            onClick={onRestore}
            className="mt-2 inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-amber-400/80 bg-white px-3 text-[12px] font-semibold text-amber-950 disabled:opacity-50"
          >
            Atjaunot
          </button>
        </div>
      ) : null}

      <div
        style={{ touchAction: "manipulation" }}
        onTouchStart={(e: TouchEvent<HTMLDivElement>) => {
          const target = e.target;
          if (target instanceof Element && target.closest("a,button,input,textarea,select,label,[data-iriss-no-swipe]")) {
            tabSwipeStartRef.current = null;
            return;
          }
          const touch = e.touches[0];
          tabSwipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(e: TouchEvent<HTMLDivElement>) => {
          const start = tabSwipeStartRef.current;
          tabSwipeStartRef.current = null;
          if (!start) return;
          const touch = e.changedTouches[0];
          if (!touch) return;
          const direction = irissHorizontalSwipeDirection(touch.clientX - start.x, touch.clientY - start.y);
          if (!direction) return;
          setTab((current) => irissTabAfterSwipe(IRISS_ORDER_ROOM_TABS, current, direction));
        }}
      >
      {tab === "overview" ? (
        <div className="mt-3 space-y-3">
          <section className={`${cardClass} py-3`}>
            <IrissOrderRoomNextSteps
              variant="banner"
              steps={steps}
              onSelect={(step) => {
                setTab(step.tab);
              }}
              onOpenSearch={() => setTab("search")}
            />
          </section>
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-3">
            <section className={cardClass}>
              <CardTitle>Kritēriji</CardTitle>
              <div className="iriss-mobile-kv iriss-spec-fields">
                <div className="iriss-spec-top">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Statuss</span>
                    <select
                      className={fieldClass}
                      value={canonicalIrissPasutijumsListStatus(rec.listStatus)}
                      aria-label="Statuss specifikācijā"
                      onChange={(e) => onSetStatus(e.target.value as IrissPasutijumsListStatus)}
                    >
                      {IRISS_PASUTIJUMS_PICKER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {IRISS_PASUTIJUMS_PICKER_STATUS_LV[status]}
                        </option>
                      ))}
                    </select>
                    {rec.listStatus === "inactive" ? (
                      <input
                        className={`${fieldClass} mt-1.5`}
                        value={rec.inactiveReason ?? ""}
                        placeholder="Iemesls (neobligāti)"
                        aria-label="Neaktīvs iemesls"
                        onChange={(e) => onInactiveReason(e.target.value)}
                      />
                    ) : null}
                  </label>
                  <Field label="Marka / modelis" value={rec.brandModel} onChange={(value) => onPatch("brandModel", value)} />
                  <Field
                    label="Modeļa paplašinājums"
                    value={rec.modelExtension}
                    placeholder="piem., S-line"
                    onChange={(value) => onPatch("modelExtension", value)}
                  />
                </div>
                <IrissSpecDiapazoniBlock
                  ranges={irissOrderRangeView(rec)}
                  onPatchRange={onPatchRange}
                  rangeError={(pair) => irissOrderRangeErrorFor(rec, pair)}
                  inputClassName={fieldClass}
                />
                <div className="iriss-spec-rest">
                  <IrissSpecChoiceSelect
                    label="Degviela"
                    value={fuelSelectValue(rec.engineType)}
                    options={IRISS_FUEL_SELECT_OPTIONS}
                    selectClassName={fieldClass}
                    onChange={(value) => onPatch("engineType", persistFuelSelect(value, rec.engineType))}
                  />
                  <IrissSpecChoiceSelect
                    label="Ātrumkārba"
                    value={gearboxSelectValue(rec.transmission)}
                    options={IRISS_GEARBOX_SELECT_OPTIONS}
                    selectClassName={fieldClass}
                    onChange={(value) => onPatch("transmission", persistGearboxSelect(value, rec.transmission))}
                  />
                  <IrissSpecChoiceSelect
                    label="Virsbūves tips"
                    value={bodySelectValue(rec.bodyType)}
                    options={IRISS_BODY_SELECT_OPTIONS}
                    selectClassName={fieldClass}
                    onChange={(value) => onPatch("bodyType", persistBodySelect(value, rec.bodyType))}
                  />
                  <Field label="Piedziņas tips" value={rec.driveType} placeholder="piem., priekšējā, 4x4" onChange={(value) => onPatch("driveType", value)} />
                  <Field label="Sēdvietu skaits" value={rec.seatCount} placeholder="piem., 5" onChange={(value) => onPatch("seatCount", value)} />
                  <Field label="Vēlamās krāsas" value={rec.preferredColors} onChange={(value) => onPatch("preferredColors", value)} />
                  <Field label="Nevēlamās krāsas" value={rec.nonPreferredColors} onChange={(value) => onPatch("nonPreferredColors", value)} />
                  <Field label="Bojājumu tolerance" value={rec.damageTolerance} placeholder="piem., tikai kosmētika" onChange={(value) => onPatch("damageTolerance", value)} />
                  <Field label="Valstis" value={rec.preferredCountries} placeholder="piem., DE, NL, BE" onChange={(value) => onPatch("preferredCountries", value)} />
                  <Field className="iriss-spec-full" label="Salona apdare" value={rec.interiorFinish} onChange={(value) => onPatch("interiorFinish", value)} />
                </div>
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Aprīkojums</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Obligātās prasības</span>
                  <textarea className={areaClass} value={rec.equipmentRequired} onChange={(e) => onPatch("equipmentRequired", e.target.value)} />
                </label>
                <IrissInternalNoteField
                  label="Piezīmes aģentam"
                  value={rec.agentNotes}
                  onChange={(value) => onPatch("agentNotes", value)}
                  className={areaClass}
                />
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Vēlamās prasības</span>
                  <textarea className={areaClass} value={rec.equipmentDesired} onChange={(e) => onPatch("equipmentDesired", e.target.value)} />
                </label>
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Piezīmes</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Piezīmes</span>
                  <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
                </label>
                <IrissInternalNoteField
                  label="Piezīmes (iekšējās)"
                  value={rec.internalNotes}
                  onChange={(value) => onPatch("internalNotes", value)}
                  className={areaClass}
                />
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <div id="iriss-room-tame">
              <DzintarzemeTameSection
                orderId={rec.id}
                shellCard={cardClass}
                draft={rec.dzintarzemeTameDraft ?? defaultIrissDzintarzemeTameDraft()}
                orderBrandModel={rec.brandModel}
                onDraftChange={(next) => onPatchRecord({ dzintarzemeTameDraft: next })}
                onGeneratedDocument={onGeneratedDocument}
                sectionSave={<IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />}
              />
            </div>

            <section className={`${cardClass} border-red-100/80 bg-red-50/20`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={onCreateOffer} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)]">
                  <Plus className="h-4 w-4" aria-hidden />
                  Izveidot piedāvājumu
                </button>
                <AdminSaveButton onSave={() => void onSave()} state={roomSaveState} className="min-h-[44px]" />
                <button type="button" disabled={busy} onClick={onDeleteOrder} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Dzēst pasūtījumu
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <section className={cardClass}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">Avanss un darījums</p>
              <div className="divide-y divide-[var(--hair)]">
                <div className="flex min-h-[48px] items-center justify-between gap-3">
                  <span className="text-[14px] text-[var(--ink)]">Avanss</span>
                  <span className="text-[14px] text-[var(--ink2)]">
                    {irissOverviewAdvanceReceived(rec.advance?.paidAt) ? IRISS_ADVANCE_RECEIVED : IRISS_ADVANCE_NOT_RECEIVED}
                  </span>
                </div>
                <div className="flex min-h-[48px] items-center justify-between gap-3">
                  <span className="text-[14px] text-[var(--ink)]">Avansa summa</span>
                  <span className="text-[14px] text-[var(--ink2)]">{rec.advance?.amount.trim() ? `${rec.advance.amount} €` : "-"}</span>
                </div>
                <label className="flex min-h-[48px] items-center justify-between gap-3">
                  <span className="text-[14px] text-[var(--ink)]">Darījuma statuss</span>
                  <select
                    className="h-8 rounded-full bg-[var(--fill)] px-2.5 text-[13px] text-[var(--ink)] outline-none"
                    value={irissDealWorkflowStatusOf(rec.dealWorkflowStatus)}
                    onChange={(e) => {
                      onPatchRecord({ dealWorkflowStatus: e.target.value });
                      void onSave();
                    }}
                  >
                    {IRISS_DEAL_WORKFLOW_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3">
                <IrissClientFinancingSection rec={rec} onPatchRecord={onPatchRecord} />
              </div>
              <button
                type="button"
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full bg-[var(--fill)] text-[13px] font-semibold text-[var(--ink)]"
                onClick={() => {
                  onPatchRecord({ advance: irissAdvancePaidToday(rec.advance) });
                  void onSave();
                }}
              >
                Atzīmēt avansu saņemtu
              </button>
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-semibold text-[var(--ink2)]">Avansa detaļas</summary>
                <IrissAdvanceSection
                  value={rec.advance}
                  onChange={(next) => onPatchRecord({ advance: next })}
                  onInvoicePdf={onPdf}
                  invoiceBusy={orderPdfBusy}
                />
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {IRISS_DEAL_DETAIL_OPTIONS.filter(
                    (opt) => opt.key !== "dealClientFinancing100" && opt.key !== "dealClientFinancing20",
                  ).map((opt) => (
                    <label key={opt.key} className="inline-flex items-center gap-2 text-[13px] text-[var(--ink)]">
                      <input type="checkbox" checked={Boolean(rec[opt.key])} onChange={(e) => onPatch(opt.key, e.target.checked)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </details>
            </section>
            <IrissOrderClientDataCard
              rec={rec}
              fieldClass={fieldClass}
              phoneWarning={phoneWarning}
              canCall={canCall}
              canEmail={canEmail}
              busy={busy || orderPdfBusy}
              onPatch={onPatch}
              onPatchRecord={onPatchRecord}
              onSave={onSave}
              onCall={onCall}
              onWhatsapp={() => onWhatsappText("")}
              onEmail={() => openMail("")}
              googleContactsConfigured={googleContactsConfigured}
              googleContactBusy={googleContactBusy}
              onRetryGoogleContact={onRetryGoogleContact}
              buttonClass={roomBtn}
              whatsappClass={roomBtnWa}
            />
            <section className={cardClass}>
              <CardTitle>Statusa vēsture</CardTitle>
              {history.length === 0 ? (
                <p className="text-[13px] text-[var(--ink2)]">Statusa maiņas vēl nav.</p>
              ) : (
                <ol>
                  {history.slice(0, 8).map((entry) => (
                    <li key={`${entry.at}-${entry.from}-${entry.to}`} className="flex items-start justify-between gap-3 border-b border-dashed border-[var(--hair)] py-1.5 text-[13px] text-[var(--ink)] last:border-0">
                      <span className="min-w-0 rounded-full bg-[var(--fill)] px-2.5 py-1 text-[12px] font-semibold">
                        {irissOrderRoomStatusLabel(entry.to)}
                        {entry.reason ? ` (${entry.reason})` : ""}
                      </span>
                      <span className="shrink-0 text-[12px] text-[var(--ink2)]">
                        {irissOrderRoomStamp(entry.at)}
                        {entry.by && entry.by !== "operators" ? ` · ${entry.by}` : ""}
                        {entry.from ? ` · no ${irissOrderRoomStatusLabel(entry.from)}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className={cardClass}>
              <CardTitle>Platformas</CardTitle>
              <p className="text-[14px] text-[var(--ink)]">{formatIrissOverviewPlatformsLine(platforms)}</p>
              <p className="mt-1 text-[12px] text-[var(--ink2)]">
                {linkCount > 0 ? `${linkCount} saglabātas meklēšanas saites` : "Nav saglabātu meklēšanas saišu"}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] font-semibold text-[var(--ink2)]">Platformu čipi</summary>
                <IrissListingPlatformChipsRow rec={rec} />
              </details>
              <button type="button" className="mt-2 text-[13px] font-semibold text-[var(--color-provin-accent)]" onClick={() => setLinksOpen((v) => !v)}>
                {linksOpen ? "Aizvērt saites" : "Saites"}
              </button>
              {linksOpen ? (
                <div className="mt-3">
                  <IrissListingPlatformsFields
                    rec={rec}
                    onPatch={onPatchRecord}
                    onReadLink={onReadLink}
                    readingUrl={readingUrl}
                    readCountByUrl={readCountByUrl}
                  />
                </div>
              ) : null}
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>
          </aside>
        </div>
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="iriss-mekletajs-view mt-3 min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[22px] bg-[var(--s1)] px-3 py-2.5 shadow-[var(--sh)]">
            <b className="text-[12px] text-[var(--ink)]">KRITĒRIJI</b>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={openCriteria}
                className={`inline-flex h-[26px] max-w-full items-center truncate whitespace-nowrap rounded-full px-3 text-[12px] font-semibold ${
                  chip.tone === "required"
                    ? "bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] text-[var(--bad)]"
                    : "bg-[var(--fill)] text-[var(--ink2)]"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <button type="button" onClick={openCriteria} className={`${roomBtn} ml-auto h-9 min-h-9`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Visi kritēriji
            </button>
            {criteriaOn ? (
              <button type="button" className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[var(--chip-active-bg)] px-3 text-[12px] font-semibold text-[var(--chip-active-fg)]" onClick={() => setCriteriaOn(false)}>
                Filtrs ieslēgts
              </button>
            ) : null}
            <Link href={searchHref} className="iriss-ink-link text-[13px] font-semibold text-[var(--ink)]">
              Atvērt meklētājā
            </Link>
          </div>
          <p className="text-[12px] leading-snug text-[var(--ink2)]">
            Tie paši jau nolasītie auto, kas Klientu filtros ir piesaistīti šim pasūtījumam. Izsoles nāk no saišu nolasīšanas. mobile.de un AutoScout24 nāk no ielādes zemāk.
          </p>
          <IrissMarketplaceLoadPanel orderId={rec.id} onLoaded={onMarketplaceLoaded} onFixCriteria={openCriteria} />
          {listingsCache === "off" ? (
            <p className="rounded-[18px] bg-[var(--s1)] px-3 py-2 text-[13px] text-[var(--ink)] shadow-[var(--sh)]">
              Sludinājumu kešs nav ieslēgts. Maksas avoti netiek prasīti.
            </p>
          ) : null}
          <div className="flex max-w-full flex-wrap gap-1.5" role="tablist" aria-label="Sludinājumu statuss">
            {IRISS_SEARCH_BUCKETS.map((item) => {
              const active = bucket === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBucket(item.id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    active
                      ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                      : "bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
                  }`}
                >
                  {item.label}
                  <em className="ml-1.5 rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1.5 py-px text-[11px] font-semibold not-italic">{bucketCounts[item.id]}</em>
                </button>
              );
            })}
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5" role="tablist" aria-label="Cenas filtrs">
            {(["all", "down", "up"] as const).map((id) => {
              const active = priceFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPriceFilter(id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    active
                      ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                      : "bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
                  }`}
                >
                  {id === "all" ? "Cenas visām" : irissPriceChipFilterLabel(id)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPriceFilterOpen(true)}
              className="rounded-full bg-[var(--s1)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)] shadow-[var(--sh)]"
            >
              Cenas filtrs
            </button>
          </div>
          {shownHits.length === 0 ? (
            <p className="rounded-[22px] bg-[var(--s1)] px-4 py-6 text-[14px] text-[var(--ink2)] shadow-[var(--sh)]">
              {listingsCache === "off" ? "Kešā nav ko rādīt." : "Šajā statusā nav sludinājumu."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shownHits.map((hit) => {
                const auctionUrl = irissHitAuctionUrl(hit);
                const extraLinks = (hit.sourceLinks ?? []).filter((link) => link.url && link.url !== auctionUrl);
                return (
                <li key={hit.id} className="min-w-0">
                  <IrissOrderRoomHitCard
                    hit={hit}
                    budget={budget}
                    isFav={favIds.has(hit.id)}
                    dismissed={dismissed.has(hit.id)}
                    auctionUrl={auctionUrl}
                    onToggleFav={() => toggleFav(hit.id)}
                    onDismiss={() => void setHitHidden(hit, true)}
                    onRestore={() => void setHitHidden(hit, false)}
                    matchSection={
                      <IrissOrderMatchBoundary>
                        <IrissOrderHitMatchChrome
                          hit={hit}
                          rec={rec}
                          hitStatus={hitStatus}
                          duplicateLinks={duplicates[hit.id] ?? []}
                          onStatus={(status) => void setListingStatus(hit, status)}
                          onStatusRestored={(status) => setHitStatus((prev) => ({ ...prev, [hit.id]: status }))}
                        />
                      </IrissOrderMatchBoundary>
                    }
                    actions={
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <p className="w-full text-[12px] font-semibold text-[var(--ink2)]">{formatIrissHitSourceLine(hit.platform, hit.countryCode)}</p>
                        <button type="button" onClick={() => onPrepareOffer(hit)} className={roomBtn}>
                          Sagatavot piedāvājumu
                        </button>
                        {auctionUrl ? (
                          <a href={auctionUrl} target="_blank" rel="noopener" className={roomBtnDark}>
                            Atvērt izsolē
                          </a>
                        ) : null}
                        <IrissOverflowMenu label="Vairāk">
                          <IrissOverflowItem disabled={!canCall} onClick={() => onWhatsappText(irissOrderRoomHitShareText(hit))}>
                            Nosūtīt klientam
                          </IrissOverflowItem>
                          <IrissOverflowItem href={searchHref}>Atvērt meklētājā</IrissOverflowItem>
                          {extraLinks.map((link) => (
                            <IrissOverflowItem key={link.url} href={link.url}>
                              Atvērt {link.platform === "mobilede" ? "mobile.de" : link.platform === "autoscout24" ? "AutoScout24" : "portālā"}
                            </IrissOverflowItem>
                          ))}
                          {dismissed.has(hit.id) ? (
                            <IrissOverflowItem onClick={() => void setHitHidden(hit, false)}>Rādīt atkal</IrissOverflowItem>
                          ) : (
                            <IrissOverflowItem onClick={() => void setHitHidden(hit, true)}>Nav interesanti</IrissOverflowItem>
                          )}
                        </IrissOverflowMenu>
                      </div>
                    }
                  />
                </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="iriss-mekletajs-view mt-3 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-[var(--ink)]">Piedāvājumi · {rec.offers.length}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onCreateOffer} className={roomBtnDark}>
                <Plus className="h-4 w-4" aria-hidden />
                Izveidot piedāvājumu
              </button>
              <IrissOverflowMenu label="Vairāk">
                <IrissOverflowItem href="/admin/iriss/pasutijumi/new?newOffer=1&noClientPdf=1">
                  Jauns piedāvājums bez klienta datiem
                </IrissOverflowItem>
              </IrissOverflowMenu>
            </div>
          </div>
          {rec.offers.length === 0 ? (
            <p className="rounded-[22px] bg-[var(--s1)] px-4 py-6 text-[14px] text-[var(--ink2)] shadow-[var(--sh)]">Šim klientam vēl nav piedāvājumu.</p>
          ) : (
            <ul className="grid min-w-0 gap-3">
              {rec.offers.map((offer, index) => {
                const total = irissOrderRoomOfferTotal(offer);
                const thumb = irissOrderRoomOfferThumb(offer);
                const link = offerLinks.find((item) => item.offerId === offer.id) ?? null;
                const badge = offerPortfolioBadge(offer, link);
                const sent = link ? formatIrissOfferLinkStamp(link.createdAt) : "";
                const opened = link && link.viewCount > 0 ? formatIrissOfferLinkStamp(link.statusAt) : "";
                const primary = irissOfferCardPrimary(offer, link);
                const source = [offerSourceLabel(offer.sourceRef), offer.auctionPlatform.trim()].filter(Boolean).join(" · ");
                return (
                  <li key={offer.id} className="min-w-0 overflow-hidden rounded-[22px] bg-[var(--s1)] shadow-[var(--sh)]">
                    <div className="flex items-center gap-3 p-3">
                      <div className="relative h-14 w-[70px] shrink-0 overflow-hidden rounded-lg bg-[var(--fill)]">
                        {thumb ? (
                          <IrissLazyImage
                            src={listingDisplayImageUrl({ url: thumb, maxWidth: 480 })}
                            alt=""
                            sizes="70px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] font-bold leading-snug text-[var(--ink)]">{offer.title || `Piedāvājums ${index + 1}`}</p>
                          <span className="shrink-0 rounded-full bg-[var(--fill)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink2)]">{badge.label}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--ink)]">{offer.brandModel.trim() || "Marka nav norādīta"}</p>
                        <p className="mt-1 text-[18px] font-extrabold text-[var(--ink)]">{total != null ? listingFmtEur(total) : "Cena nav"}</p>
                        {source ? <p className="mt-1 text-[12px] font-semibold text-[var(--ink2)]">{source}</p> : null}
                        <p className="mt-1 text-[12px] text-[var(--ink2)]">
                          {sent ? `Nosūtīts ${sent}` : "Nav nosūtīts"}
                          {opened ? ` · pēd. atvēra ${opened}` : ""}
                          {link?.viewCount ? ` · Atvērts ${link.viewCount}×` : ""}
                          {link?.question ? ` · ${link.question}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 px-3 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => onEditOffer(offer)} className={roomBtnDark}>
                          {primary.label === IRISS_OFFERS_CONTINUE
                            ? "Turpināt rediģēt"
                            : primary.label === IRISS_OFFERS_SEND
                              ? "Nosūtīt"
                              : "Atvērt piedāvājumu"}
                        </button>
                        <IrissOverflowMenu label="Vairāk">
                          <IrissOverflowItem onClick={() => onEditOffer(offer)}>Labot</IrissOverflowItem>
                          <IrissOverflowItem onClick={() => onOpenOfferPdf(offer.id)}>PDF</IrissOverflowItem>
                          <IrissOverflowItem onClick={() => onOpenOfferPdf(offer.id, true)}>PDF bez attēliem</IrissOverflowItem>
                          <IrissOverflowItem disabled={!canCall} onClick={() => onWhatsappText(offerShareText(offer))}>
                            WhatsApp
                          </IrissOverflowItem>
                          <IrissOverflowItem disabled={!canCall} onClick={() => onWhatsappText(offerShareText(offer))}>
                            Nosūtīt
                          </IrissOverflowItem>
                        </IrissOverflowMenu>
                      </div>
                      <IrissOfferClientLinkBar
                        offerId={offer.id}
                        link={link}
                        phone={rec.phone}
                        email={rec.email}
                        vehicle={offer.brandModel.trim() || offer.title}
                        busy={linkBusyId === offer.id}
                        deadlineAt={offer.validUntilAt ?? ""}
                        onCreate={(expiresInDays) => void mutateOfferLink(offer.id, { action: "create", expiresInDays })}
                        onRevoke={() => void mutateOfferLink(offer.id, { action: "revoke" })}
                        onExtend={(validUntilAt) => void mutateOfferLink(offer.id, { action: "extend", validUntilAt })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <details className="rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)]">
            <summary className="cursor-pointer text-[14px] font-semibold text-[var(--ink)]">
              Sludinājumu saites · {irissOrderRoomListingLinkCount(rec)}
            </summary>
            <p className="mt-2 text-[12px] text-[var(--ink2)]">
              {formatIrissOffersLinksSummary(rec)}. Klikšķis atver Nolasīt, filtru, Pievienot saiti, Atjaunot eCarsTrade.
            </p>
            <IrissListingPlatformsFields
              rec={rec}
              onPatch={onPatchRecord}
              onReadLink={onReadLink}
              readingUrl={readingUrl}
              readCountByUrl={readCountByUrl}
            />
            <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
          </details>
          {rec.offers.length > 0 ? (
            <section className={cardClass}>
              <CardTitle>Atbilžu vēsture</CardTitle>
              {replies.length === 0 ? (
                <p className="text-[13px] text-[var(--ink2)]">Klientu atbilžu vēl nav.</p>
              ) : (
                <ul>
                  {replies.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 border-b border-dashed border-[var(--hair)] py-1.5 text-[13px] last:border-0">
                      <span className="min-w-0">{row.text}</span>
                      <span className="shrink-0 text-[12px] text-[var(--ink2)]">{row.side}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "communication" ? (
        <div className="iriss-komunikacija-view mt-3 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
          <section className={`${cardClass} flex min-h-[420px] flex-col space-y-2`}>
            <IrissCommunicationTimeline
              items={commTimeline}
              filter={commFilter}
              onFilter={setCommFilter}
              typeFilter={commTypeFilter}
              onTypeFilter={setCommTypeFilter}
            />
            <div className="mt-auto border-t border-[var(--hair)] pt-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={actionBtn}
                  onClick={() =>
                    onPatchRecord({
                      communicationEvents: [
                        ...(rec.communicationEvents ?? []),
                        newIrissCommunicationEvent("whatsapp", "Nosūtīts WhatsApp", { status: "sent", body: composer }),
                      ],
                    })
                  }
                >
                  Nosūtīts
                </button>
                <button
                  type="button"
                  className={actionBtn}
                  onClick={() =>
                    onPatchRecord({
                      communicationEvents: [
                        ...(rec.communicationEvents ?? []),
                        newIrissCommunicationEvent("call", "Klienta atbilde", { status: "answered", body: composer }),
                      ],
                    })
                  }
                >
                  Klienta atbilde
                </button>
                <button
                  type="button"
                  className={actionBtn}
                  onClick={() =>
                    onPatchRecord({
                      communicationEvents: [
                        ...(rec.communicationEvents ?? []),
                        newIrissCommunicationEvent("call", "Neatzīmēts zvans", { status: "missed" }),
                      ],
                    })
                  }
                >
                  Neatzīmēt
                </button>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span className="sr-only">Ziņa</span>
                  <textarea className={areaClass} value={composer} placeholder="Rakstīt piezīmi vai WhatsApp melnrakstu…" aria-label="Ziņas teksts" onChange={(e) => setComposer(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={actionBtn}
                    onClick={() => {
                      const next = appendIrissOrderRoomNote(rec.notes, composer, new Date().toISOString());
                      if (next === rec.notes) return;
                      onAppendNote(composer);
                      setComposer("");
                    }}
                  >
                    Piezīme
                  </button>
                  <button type="button" className={roomBtnWa} disabled={!canCall} onClick={() => onWhatsappText(composer)}>
                    Atvērt WhatsApp
                  </button>
                  {canEmail ? (
                    <button type="button" className={actionBtn} onClick={() => openMail(composer)}>
                      E-pasts
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
          <aside className="space-y-3">
            <section className={cardClass}>
              <CardTitle>Ātrā saziņa</CardTitle>
              <div className="grid gap-2">
                <p className="text-[14px] font-semibold text-[var(--ink)]">{rec.phone.trim() || "Tālrunis nav"}</p>
                <button type="button" className={`${roomBtn} md:hidden`} disabled={!canCall} onClick={onCall}>
                  <Phone className="h-4 w-4" aria-hidden />
                  Zvanīt
                </button>
                <button type="button" className={`${roomBtnWa} w-full`} disabled={!canCall} onClick={() => onWhatsappText(composer)}>
                  WhatsApp
                </button>
                {canEmail ? (
                  <button type="button" className={roomBtn} onClick={() => openMail(composer)}>
                    <Mail className="h-4 w-4" aria-hidden />
                    {rec.email.trim()}
                  </button>
                ) : null}
              </div>
            </section>
            <section className={`${cardClass} max-lg:hidden`}>
              <CardTitle>Piezīmes</CardTitle>
              <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
            </section>
            <section className={cardClass}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <CardTitle>Šabloni</CardTitle>
                <span className="lg:hidden">
                  <IrissOverflowMenu label="Piezīmes">
                    <IrissOverflowItem>
                      <label className="block w-full">
                        <span className="mb-1 block text-[11px] font-semibold text-[var(--ink2)]">Piezīmes</span>
                        <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
                      </label>
                    </IrissOverflowItem>
                  </IrissOverflowMenu>
                </span>
              </div>
              <ul>
                {IRISS_ORDER_ROOM_TEMPLATES.map((template) => (
                  <li key={template.id} className="border-b border-dashed border-[var(--hair)] last:border-0">
                    <button type="button" className="flex w-full items-center justify-between py-2 text-left text-[13px] text-[var(--ink)]" onClick={() => setComposer(template.text)}>
                      <span>{template.label}</span>
                      <ChevronRight className="h-4 w-4 text-[var(--ink3)]" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="iriss-dokumenti-view mt-3 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-[var(--ink)]">Saglabātie dokumenti</p>
            <IrissOverflowMenu label="Ģenerēt" triggerClassName="inline-flex h-10 items-center rounded-full bg-[var(--chip-active-bg)] px-3.5 text-[13px] font-semibold text-[var(--chip-active-fg)]">
              <IrissOverflowItem disabled={orderPdfBusy} onClick={onPdf}>
                {orderPdfBusy ? "PDF..." : "Līgums"}
              </IrissOverflowItem>
              <IrissOverflowItem
                onClick={() => {
                  setTab("overview");
                  window.setTimeout(() => document.getElementById("iriss-room-tame")?.scrollIntoView({ block: "start" }), 0);
                }}
              >
                Tāme
              </IrissOverflowItem>
              <IrissOverflowItem onClick={onCreateOffer}>Piedāvājums</IrissOverflowItem>
            </IrissOverflowMenu>
          </div>
          <ul className="space-y-2">
            {generatedDocs.map((doc) => (
              <li key={doc.id} className={`${cardClass} flex flex-wrap items-center gap-2`}>
                <FileText className="h-5 w-5 text-[var(--ink3)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{doc.name}</p>
                  <p className="text-[11.5px] text-[var(--ink2)]">
                    {generatedDocumentKindLabel(doc.kind)}
                    {formatGeneratedDocumentWhen(doc.createdAt) ? ` · ${formatGeneratedDocumentWhen(doc.createdAt)}` : ""}
                    {doc.size ? ` · ${formatGeneratedDocumentSize(doc.size)}` : ""}
                  </p>
                </div>
                <a
                  className={roomBtn}
                  href={`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/generated-document/${encodeURIComponent(doc.id)}`}
                >
                  Atvērt
                </a>
                <a
                  className={roomBtn}
                  href={`/api/admin/iriss-pasutijumi/${encodeURIComponent(rec.id)}/generated-document/${encodeURIComponent(doc.id)}`}
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  Lejupielādēt
                </a>
              </li>
            ))}
            <li className={`${cardClass} flex flex-wrap items-center gap-2`}>
              <FileText className="h-5 w-5 text-[var(--ink3)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--ink)]">Pasūtījuma līgums</p>
                <p className="text-[11.5px] text-[var(--ink2)]">Esošais pasūtījuma izdruka</p>
              </div>
              <button type="button" className={roomBtn} onClick={onPdf} disabled={orderPdfBusy}>
                Atvērt
              </button>
              <button type="button" className={roomBtn} onClick={onPdf} disabled={orderPdfBusy} aria-label="Lejupielādēt līgumu">
                <FileDown className="h-4 w-4" aria-hidden />
                Lejupielādēt
              </button>
            </li>
            <li className={`${cardClass} flex flex-wrap items-center gap-2`}>
              <FileText className="h-5 w-5 text-[var(--ink3)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--ink)]">Izmaksu tāme</p>
                <p className="text-[11.5px] text-[var(--ink2)]">Dzintarzeme Auto</p>
              </div>
              <button
                type="button"
                className={roomBtn}
                onClick={() => {
                  setTab("overview");
                  window.setTimeout(() => document.getElementById("iriss-room-tame")?.scrollIntoView({ block: "start" }), 0);
                }}
              >
                Atvērt
              </button>
            </li>
            {rec.offers.map((offer, index) => (
              <li key={offer.id} className={`${cardClass} flex flex-wrap items-center gap-2`}>
                <FileText className="h-5 w-5 text-[var(--ink3)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{offer.title || `Piedāvājums ${index + 1}`} PDF</p>
                  <p className="text-[11.5px] text-[var(--ink2)]">{offer.brandModel.trim() || "PDF no saglabātā piedāvājuma"}</p>
                </div>
                <button type="button" className={roomBtn} onClick={() => onOpenOfferPdf(offer.id)}>
                  Atvērt
                </button>
                <button type="button" className={roomBtn} onClick={() => onOpenOfferPdf(offer.id)} aria-label="Lejupielādēt piedāvājumu">
                  <FileDown className="h-4 w-4" aria-hidden />
                  Lejupielādēt
                </button>
              </li>
            ))}
          </ul>
          <p className="sr-only">Ģenerēt</p>
          <IrissOrderPhotoAlbumSection
            albumId="inspection"
            album={rec.inspectionPhotos}
            onChange={(next) => onPatchRecord({ inspectionPhotos: next })}
            onFiles={(files) => onAlbumFiles?.("inspection", files)}
            busy={albumBusy}
            onCopyToOffer={() => {
              const last = rec.offers[rec.offers.length - 1];
              if (!last || !rec.inspectionPhotos?.attachments.length) return;
              onPatchRecord({
                offers: rec.offers.map((offer) =>
                  offer.id === last.id
                    ? { ...offer, attachments: [...offer.attachments, ...rec.inspectionPhotos!.attachments].slice(0, 60) }
                    : offer,
                ),
              });
            }}
          />
          <IrissOrderPhotoAlbumSection
            albumId="documents"
            album={rec.documentPhotos}
            onChange={(next) => onPatchRecord({ documentPhotos: next })}
            onFiles={(files) => onAlbumFiles?.("documents", files)}
            busy={albumBusy}
            onCopyToOffer={() => {
              const last = rec.offers[rec.offers.length - 1];
              if (!last || !rec.documentPhotos?.attachments.length) return;
              onPatchRecord({
                offers: rec.offers.map((offer) =>
                  offer.id === last.id
                    ? { ...offer, attachments: [...offer.attachments, ...rec.documentPhotos!.attachments].slice(0, 60) }
                    : offer,
                ),
              });
            }}
          />
        </div>
      ) : null}
      </div>

      <div className="iriss-action-dock md:hidden">
        <button type="button" disabled={orderPdfBusy} onClick={onPdf} className="iriss-ink-link flex h-[50px] min-w-0 flex-1 items-center justify-center rounded-full bg-[var(--s1,#fff)] text-[15px] font-semibold text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--hair,#e5e7eb)]">
          {orderPdfBusy ? "PDF…" : "Līgums"}
        </button>
        <button type="button" onClick={onCreateOffer} className="flex h-[50px] min-w-0 flex-1 items-center justify-center rounded-full bg-[#111827] text-[15px] font-semibold text-white">
          Piedāvājums
        </button>
        <AdminSaveButton onSave={() => void onSave()} state={roomSaveState} className="!h-[50px] min-w-0 flex-1 text-[15px]" />
      </div>
      <AdminMobileSheet open={moreOpen} title="Darbības" onClose={() => setMoreOpen(false)}>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={orderPdfBusy}
            onClick={() => {
              setMoreOpen(false);
              onPdf();
            }}
            className="flex h-11 items-center justify-center rounded-full bg-[var(--fill-secondary)] text-[15px] font-semibold text-[var(--label)]"
          >
            {orderPdfBusy ? "PDF…" : "Līgums PDF"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false);
              onDeleteOrder();
            }}
            className="flex h-11 items-center justify-center rounded-full bg-[var(--fill-secondary)] text-[15px] font-semibold text-red-700"
          >
            Dzēst pasūtījumu
          </button>
        </div>
      </AdminMobileSheet>

      {criteriaOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-[#0f172a66] md:items-stretch" role="presentation" onClick={() => setCriteriaOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-room-criteria-title"
            className="flex max-h-[88dvh] w-full max-w-[440px] flex-col rounded-t-[22px] bg-white shadow-xl md:h-full md:max-h-none md:rounded-l-[22px] md:rounded-tr-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#e5e5ea] px-4 py-3">
              <div>
                <h2 id="iriss-room-criteria-title" className="text-[16px] font-semibold">
                  Klienta kritēriji
                </h2>
                <p className="text-[12px] text-[var(--color-provin-muted)]">Izmaiņas saglabājas pasūtījumā un sašaurina jau nolasītos auto.</p>
              </div>
              <button type="button" aria-label="Aizvērt" onClick={() => setCriteriaOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2">
              {(
                [
                  ["totalBudget", "Budžets līdz"],
                  ["productionYears", "Gadi"],
                  ["preferredColors", "Krāsa"],
                  ["driveType", "Piedziņa"],
                  ["maxMileage", "Max km"],
                  ["interiorFinish", "Salons"],
                  ["modelExtension", "Modeļa paplašinājums"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={criteriaDraft[key]}
                  onChange={(value) => setCriteriaDraft((prev) => ({ ...prev, [key]: value }))}
                />
              ))}
              <IrissSpecChoiceSelect
                label="Degviela"
                value={fuelSelectValue(criteriaDraft.engineType)}
                options={IRISS_FUEL_SELECT_OPTIONS}
                selectClassName={fieldClass}
                onChange={(value) =>
                  setCriteriaDraft((prev) => ({ ...prev, engineType: persistFuelSelect(value, prev.engineType) }))
                }
              />
              <IrissSpecChoiceSelect
                label="Ātrumkārba"
                value={gearboxSelectValue(criteriaDraft.transmission)}
                options={IRISS_GEARBOX_SELECT_OPTIONS}
                selectClassName={fieldClass}
                onChange={(value) =>
                  setCriteriaDraft((prev) => ({
                    ...prev,
                    transmission: persistGearboxSelect(value, prev.transmission),
                  }))
                }
              />
              <IrissSpecChoiceSelect
                label="Virsbūves tips"
                value={bodySelectValue(criteriaDraft.bodyType)}
                options={IRISS_BODY_SELECT_OPTIONS}
                selectClassName={fieldClass}
                onChange={(value) =>
                  setCriteriaDraft((prev) => ({ ...prev, bodyType: persistBodySelect(value, prev.bodyType) }))
                }
              />
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Obligātās prasības</span>
                <textarea className={areaClass} value={criteriaDraft.equipmentRequired} onChange={(e) => setCriteriaDraft((prev) => ({ ...prev, equipmentRequired: e.target.value }))} />
              </label>
              <div className="sm:col-span-2">
                <IrissInternalNoteField
                  label="Piezīmes aģentam"
                  value={criteriaDraft.agentNotes}
                  onChange={(value) => setCriteriaDraft((prev) => ({ ...prev, agentNotes: value }))}
                  className={areaClass}
                />
              </div>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Vēlamās prasības</span>
                <textarea className={areaClass} value={criteriaDraft.equipmentDesired} onChange={(e) => setCriteriaDraft((prev) => ({ ...prev, equipmentDesired: e.target.value }))} />
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-[11.5px] font-semibold text-[#374151]">Izslēgt</p>
                <div className="flex flex-wrap gap-1.5">
                  {irissOrderRoomExcludeTokens(criteriaDraft.nonPreferredColors).map((token) => (
                    <button
                      key={token}
                      type="button"
                      className="rounded-full bg-rose-50 px-2 py-1 text-[12px] font-medium text-rose-800"
                      onClick={() =>
                        setCriteriaDraft((prev) => ({
                          ...prev,
                          nonPreferredColors: irissOrderRoomExcludeTokens(prev.nonPreferredColors)
                            .filter((item) => item !== token)
                            .join(", "),
                        }))
                      }
                    >
                      {token} ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className={fieldClass} value={excludeDraft} aria-label="Pievienot izņēmumu" onChange={(e) => setExcludeDraft(e.target.value)} />
                  <button
                    type="button"
                    className={actionBtn}
                    onClick={() => {
                      const token = excludeDraft.trim();
                      if (!token) return;
                      const next = [...irissOrderRoomExcludeTokens(criteriaDraft.nonPreferredColors), token];
                      setCriteriaDraft((prev) => ({ ...prev, nonPreferredColors: next.join(", ") }));
                      setExcludeDraft("");
                    }}
                  >
                    Pievienot
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e5e5ea] px-4 py-3">
              <button type="button" className={actionBtn} onClick={() => setCriteriaOpen(false)}>
                Atcelt
              </button>
              <button type="button" disabled={criteriaBusy} onClick={() => void saveCriteria()} className={roomBtnPrimary}>
                {criteriaBusy ? "Saglabā…" : "Saglabāt un filtrēt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {priceFilterOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(20,24,35,0.2)] p-3 md:items-center" role="presentation">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--gsh)]">
            <p className="text-[15px] font-semibold text-[var(--ink)]">Cenas filtrs</p>
            <div className="mt-3 flex flex-col gap-2">
              {(["all", "down", "up"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPriceFilter(id);
                    setPriceFilterOpen(false);
                  }}
                  className={`rounded-[14px] px-3 py-2.5 text-left text-[13px] font-semibold ${
                    priceFilter === id
                      ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                      : "bg-[var(--fill)] text-[var(--ink)]"
                  }`}
                >
                  {id === "all" ? "Cenas visām" : irissPriceChipFilterLabel(id)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-[var(--fill)] text-[13px] font-semibold"
              onClick={() => setPriceFilterOpen(false)}
            >
              Atcelt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function IrissOrderHitMatchChrome({
  hit,
  rec,
  hitStatus,
  duplicateLinks,
  onStatus,
  onStatusRestored,
}: {
  hit: IrissOrderRoomHit;
  rec: IrissPasutijumsRecord;
  hitStatus: Record<string, IrissListingHitStatus>;
  duplicateLinks: IrissVinDuplicateLink[];
  onStatus: (status: IrissListingHitStatus) => void;
  onStatusRestored: (status: IrissListingHitStatus) => void;
}) {
  let match: ReturnType<typeof irissOrderRoomMatch> | null = null;
  try {
    match = irissOrderRoomMatch(rec, hit);
  } catch {
    return <IrissOrderMatchFallback />;
  }
  const status = irissHitStatusOf(hitStatus, hit.id);
  const showNew = status === "jauns" || (irissHitStatusIsUnset(hitStatus, hit.id) && hit.change === "new");
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showNew ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">Jauns</span> : null}
        <IrissVinDuplicateMark links={duplicateLinks} />
        {hit.change === "price_changed" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Cena</span> : null}
        {match.badges.map((badge) => (
          <span key={badge.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.pass ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
            {badge.pass ? "✓ " : ""}
            {badge.label}
          </span>
        ))}
        {match.percent != null ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">atbilst {match.percent}%</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Sludinājuma statuss">
        {IRISS_LISTING_HIT_STATUSES.map((item) => {
          const on = status === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => onStatus(item)}
              className={`min-h-11 rounded-full px-3 py-2 text-[13px] font-semibold ${
                on ? "bg-[#111827] text-white" : "bg-white text-[#111827] ring-1 ring-[#e5e7eb]"
              }`}
            >
              {IRISS_LISTING_HIT_STATUS_LV[item]}
            </button>
          );
        })}
      </div>
      <AdminChangeHistoryButton
        kind="iriss-listing"
        recordId={listingHistoryRecordId(rec.id, hit.id)}
        endpoint="/api/admin/change-history"
        className="mt-2"
        onRestored={(body) => {
          const status = body.record?.status;
          if (typeof status === "string" && isIrissListingHitStatus(status)) onStatusRestored(status);
        }}
      />
    </>
  );
}

