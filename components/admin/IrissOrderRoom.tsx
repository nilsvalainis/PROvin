"use client";

import { ChevronRight, FileDown, FileText, Mail, Pencil, Phone, Plus, Send, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { IrissLazyImage } from "@/components/admin/IrissLazyImage";
import { IrissOrderRoomHitCard } from "@/components/admin/IrissOrderRoomHitCard";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { DzintarzemeTameSection } from "@/components/admin/DzintarzemeTameSection";
import { IrissClientFinancingSection } from "@/components/admin/IrissClientFinancingSection";
import { IrissOrderRoomNextSteps } from "@/components/admin/IrissOrderRoomNextSteps";
import { IrissListingPlatformChipsRow, IrissListingPlatformsFields } from "@/components/admin/IrissListingPlatformsSection";
import { IrissOfferClientLinkBar } from "@/components/admin/IrissOfferClientLinkBar";
import { IrissOrderMatchBoundary, IrissOrderMatchFallback } from "@/components/admin/IrissOrderMatchBoundary";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import { IrissVinDuplicateMark } from "@/components/admin/IrissVinDuplicateMark";
import { AdminChangeHistoryButton } from "@/components/admin/AdminChangeHistoryButton";
import { IrissOrderSectionSaveButton } from "@/components/admin/IrissOrderSectionSaveButton";
import { listingHistoryRecordId } from "@/lib/admin-change-history";
import { irissBrandFallbackLabel, irissBrandLogoSrc } from "@/lib/iriss-brand-logo";
import { listingFmtEur } from "@/lib/iriss-listings-card";
import { listingDisplayImageUrl } from "@/lib/iriss-listing-image";
import { IRISS_LISTING_PLATFORM_LABEL } from "@/lib/iriss-listings-platform";
import { parseIrissOrderBudget, serializeListingOrderFilter } from "@/lib/iriss-listings-orders";
import {
  IRISS_LIST_PREFS_KEY,
  irissListBrowserStorage,
  migrateIrissListPrefs,
  parseIrissListPrefs,
  persistIrissListPrefs,
  safeStorageGet,
} from "@/lib/iriss-listings-operator-prefs";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
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
  irissOrderRoomSavedLabel,
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
  type IrissOfferRecord,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-[10px] border border-[#e5e7eb] bg-white px-2.5 py-2 text-[16px] text-[#111827] outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 sm:min-h-[38px] sm:text-[13px]";

const areaClass = `${fieldClass} min-h-[60px] resize-y py-2 leading-snug sm:min-h-[60px]`;

const cardClass = "min-w-0 rounded-2xl border border-[#e5e7eb] bg-white p-4";

/** Nils: pasūtījumu telpas augšējā „Vēsture” pagaidām izslēgta (kods paliek). */
const IRISS_ORDER_ROOM_SHOW_CHANGE_HISTORY = false;

const roomBtn =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-semibold text-[#111827] shadow-[0_1px_2px_#0000000d] transition hover:bg-[#f9fafb] disabled:opacity-40";

const roomBtnWa =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#16a34a] bg-[#16a34a] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-105 disabled:opacity-40";

const roomBtnPrimary =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#2563eb] bg-[#2563eb] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-105 disabled:opacity-40";

const roomBtnDark =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#111827] bg-[#111827] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-110 disabled:opacity-40";

const PLATFORM_INK: Record<string, string> = {
  autobid: "#c2410c",
  openline: "#0f172a",
  auto1: "#1d4ed8",
  ecarstrade: "#0f766e",
};

const BUCKETS: ReadonlyArray<{ id: IrissOrderRoomHitBucket; label: string }> = [
  { id: "new", label: "Jauni" },
  { id: "saved", label: "Saglabāti" },
  { id: "offered", label: "Piedāvāti" },
  { id: "reject", label: "Neder" },
];

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
}) {
  return (
    <label className="block min-w-0">
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
  vinWarning,
  canCall,
  canEmail,
  conflict,
  deleted,
  onPatch,
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
  onRestore,
  onOrderRestored,
  onDeleteOrder,
  initialOfferLinks = [],
  initialHitStatus = {},
  duplicatesByListing = {},
  initialTab = "overview",
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
  onOpenOfferPdf: (offerId: string) => void;
  onRestore: () => void;
  onOrderRestored: (record: IrissPasutijumsRecord) => void;
  onDeleteOrder: () => void;
  initialOfferLinks?: IrissOfferClientLinkAdminView[];
  initialHitStatus?: Record<string, IrissListingHitStatus>;
  duplicatesByListing?: Record<string, IrissVinDuplicateLink[]>;
  initialTab?: IrissOrderRoomTab;
}) {
  const [tab, setTab] = useState<IrissOrderRoomTab>(coerceIrissOrderRoomTab(initialTab));
  const tabSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [bucket, setBucket] = useState<IrissOrderRoomHitBucket>("new");
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
  const [offerLinks, setOfferLinks] = useState<IrissOfferClientLinkAdminView[]>(Array.isArray(initialOfferLinks) ? initialOfferLinks : []);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [hitStatus, setHitStatus] = useState<Record<string, IrissListingHitStatus>>(() => coerceIrissHitStatusMap(initialHitStatus));
  const duplicates = coerceIrissDuplicatesByListing(duplicatesByListing);
  const safeHits = (Array.isArray(hits) ? hits : []).filter((hit) => hit && typeof hit.id === "string");
  useAdminScrollLock(criteriaOpen);

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

  async function mutateOfferLink(offerId: string, body: { action: "create"; expiresInDays: number | null } | { action: "revoke" }) {
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; link?: IrissOfferClientLinkAdminView };
      if (!res.ok || !data.link) {
        setRoomMsg(
          data.error === "save_first"
            ? "Vispirms saglabājiet pasūtījumu un piedāvājumu."
            : body.action === "revoke"
              ? "Saiti neizdevās atsaukt."
              : "Saiti neizdevās izveidot.",
        );
        return;
      }
      setOfferLinks((prev) => [...prev.filter((item) => item.offerId !== offerId), data.link!]);
    } catch {
      setRoomMsg(body.action === "revoke" ? "Saiti neizdevās atsaukt." : "Saiti neizdevās izveidot.");
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

  const shownHits = filteredHits.filter((hit) => bucketOf(hit) === bucket);
  const chips = irissOrderRoomCriteriaChips(rec);
  const dealPill = irissOrderRoomDealPill(rec);
  const clientName = [rec.clientFirstName, rec.clientLastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const savedLabel = irissOrderRoomSavedLabel(rec.updatedAt);
  const refLabel = irissOrderRoomRef(rec.id);
  const logoSrc = irissBrandLogoSrc(rec.brandModel);
  const linkCount = irissOrderRoomListingLinkCount(rec);
  const platforms = irissOrderRoomPlatformLabels(visibleHits);
  const platformKeys = [...new Set(visibleHits.map((hit) => hit.platform))];
  const budget = parseIrissOrderBudget(rec.totalBudget);
  const newHits = visibleHits.filter((hit) => bucketOf(hit) === "new").length;
  const steps = irissOrderRoomNextSteps({
    newHits,
    offerCount: rec.offers.length,
    hasPhone: canCall,
    hasVin: Boolean(rec.vin.trim()),
  });
  const commCount = irissOrderRoomCommunicationCount((rec.statusHistory ?? []).length, Boolean(rec.notes.trim()));
  const docCount = irissOrderRoomDocumentCount(rec.offers.length);
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

  return (
    <div data-iriss-order-room="1" className="min-w-0 overflow-x-hidden pb-1">
      <AdminDashboardHeaderWithMenu>
        <div className="min-w-0">
          <Link
            href="/admin/iriss/pasutijumi"
            title={rec.id}
            className="mb-2 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-[#6b7280]"
          >
            <span aria-hidden>←</span>
            <span className="text-[17px] font-semibold text-[#111827] md:hidden">{refLabel}</span>
            <span className="hidden md:inline">IRISS · Pasūtījumi / {refLabel}</span>
          </Link>
          <div className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 sm:px-[18px] sm:py-3.5">
            <div className="flex min-w-0 flex-wrap items-center gap-3.5">
              <div className="hidden h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border border-[#e5e7eb] bg-white md:flex">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="" className="h-7 w-7 object-contain p-0.5" />
                ) : (
                  <span className="text-[11px] font-extrabold text-[#111827]">{irissBrandFallbackLabel(rec.brandModel)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[16px] font-bold leading-tight text-[#111827] md:text-[22px] md:font-semibold">{title}</h1>
                  <label className="hidden items-center md:inline-flex">
                    <span className="sr-only">Statuss</span>
                    <select
                      className="iriss-status-pill h-8 rounded-full border border-[#111827] bg-[#111827] px-2.5 text-[12px] font-semibold text-white outline-none"
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
                  {dealPill ? (
                    <span className="iriss-deal-pill hidden h-8 items-center rounded-full border border-[#86efac] bg-[#dcfce7] px-2.5 text-[12px] font-semibold text-[#166534] md:inline-flex">
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
                        budžets <b className="font-bold text-[#111827]">{budgetLabel}</b>
                      </>
                    ) : null}
                    {savedLabel ? ` · ${savedLabel} ✓` : ""}
                  </span>
                </p>
              </div>
              <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
                <button type="button" className={roomBtn} disabled={!canCall} onClick={onCall}>
                  <Phone className="h-4 w-4" aria-hidden />
                  Zvanīt
                </button>
                <button type="button" className={roomBtnWa} disabled={!canCall} onClick={() => onWhatsappText("")}>
                  <WhatsAppGlyph className="h-4 w-4 fill-white" />
                  WhatsApp
                </button>
                <button type="button" className={roomBtn} disabled={!canEmail} onClick={() => openMail("")}>
                  <Mail className="h-4 w-4" aria-hidden />
                  E-pasts
                </button>
                <button type="button" className={roomBtn} disabled={orderPdfBusy} onClick={onPdf}>
                  <FileDown className="h-4 w-4" aria-hidden />
                  {orderPdfBusy ? "PDF…" : "Līgums PDF"}
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 md:hidden">
              <button type="button" className={roomBtn} disabled={!canCall} onClick={onCall}>
                <Phone className="h-4 w-4" aria-hidden />
                Zvanīt
              </button>
              <button type="button" className={roomBtnWa} disabled={!canCall} onClick={() => onWhatsappText("")}>
                <WhatsAppGlyph className="h-4 w-4 fill-white" />
                WhatsApp
              </button>
              <button type="button" className={roomBtn} disabled={!canEmail} onClick={() => openMail("")} aria-label="E-pasts">
                <Mail className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className="-mx-1 mt-2 flex max-w-full gap-0.5 overflow-x-auto border-b border-[#e5e7eb] [scrollbar-width:none] md:mx-0 md:mt-3" role="tablist" aria-label="Pasūtījuma istaba">
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
                  className={`shrink-0 border-b-2 px-2.5 py-2.5 text-[13px] font-semibold md:px-3.5 md:text-[13.5px] ${
                    active ? "border-[#111827] text-[#111827]" : "border-transparent text-[#6b7280]"
                  }`}
                >
                  {label}
                  {count != null ? (
                    <em className="ml-1.5 rounded-full bg-[#f3f4f6] px-1.5 py-px text-[11px] font-semibold not-italic text-[#374151]">{count}</em>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </AdminDashboardHeaderWithMenu>

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
            className="mt-2 inline-flex h-8 items-center rounded-lg border border-amber-400/80 bg-white px-2 text-[11px] font-semibold text-amber-950 disabled:opacity-50"
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
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
          <div className="min-w-0 space-y-3">
            <section className={cardClass}>
              <CardTitle>Transportlīdzekļa specifikācija</CardTitle>
              <div className="iriss-mobile-kv grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
                <Field label="Kopējais budžets" value={rec.totalBudget} onChange={(value) => onPatch("totalBudget", value)} />
                <Field label="Ražošanas gadi" value={rec.productionYears} placeholder="piem., 2018-2021" onChange={(value) => onPatch("productionYears", value)} />
                <Field label="Dzinēja tips" value={rec.engineType} onChange={(value) => onPatch("engineType", value)} />
                <Field label="Ātrumkārba" value={rec.transmission} onChange={(value) => onPatch("transmission", value)} />
                <Field label="Virsbūves tips" value={rec.bodyType} placeholder="piem., hečbeks, SUV" onChange={(value) => onPatch("bodyType", value)} />
                <Field label="Piedziņas tips" value={rec.driveType} placeholder="piem., priekšējā, 4x4" onChange={(value) => onPatch("driveType", value)} />
                <Field label="Sēdvietu skaits" value={rec.seatCount} placeholder="piem., 5" onChange={(value) => onPatch("seatCount", value)} />
                <Field label="Maks. nobraukums" value={rec.maxMileage} onChange={(value) => onPatch("maxMileage", value)} />
                <Field label="Vēlamās krāsas" value={rec.preferredColors} onChange={(value) => onPatch("preferredColors", value)} />
                <Field label="Nevēlamās krāsas" value={rec.nonPreferredColors} onChange={(value) => onPatch("nonPreferredColors", value)} />
                <Field label="Jauda (kW)" value={rec.powerKw} placeholder="piem., 180-245" onChange={(value) => onPatch("powerKw", value)} />
                <Field label="Bojājumu tolerance" value={rec.damageTolerance} placeholder="piem., tikai kosmētika" onChange={(value) => onPatch("damageTolerance", value)} />
                <Field label="Valstis" value={rec.preferredCountries} placeholder="piem., DE, NL, BE" onChange={(value) => onPatch("preferredCountries", value)} />
                <Field label="Salona apdare" value={rec.interiorFinish} onChange={(value) => onPatch("interiorFinish", value)} />
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
                <label className="block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Vēlamās prasības</span>
                  <textarea className={areaClass} value={rec.equipmentDesired} onChange={(e) => onPatch("equipmentDesired", e.target.value)} />
                </label>
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Piezīmes</CardTitle>
              <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={cardClass}>
              <CardTitle>Avanss un darījums</CardTitle>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label="Pasūtījuma datums" type="date" value={rec.orderDate} onChange={(value) => onPatch("orderDate", value)} />
                <Field label="Klienta kopējais budžets" value={rec.totalBudget} onChange={(value) => onPatch("totalBudget", value)} />
              </div>
              <IrissClientFinancingSection rec={rec} onPatchRecord={onPatchRecord} />
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {IRISS_DEAL_DETAIL_OPTIONS.filter(
                  (opt) => opt.key !== "dealClientFinancing100" && opt.key !== "dealClientFinancing20",
                ).map((opt) => (
                  <label key={opt.key} className="inline-flex items-center gap-2 text-[13px] text-[var(--color-apple-text)]">
                    <input type="checkbox" checked={Boolean(rec[opt.key])} onChange={(e) => onPatch(opt.key, e.target.checked)} />
                    {opt.label}
                  </label>
                ))}
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
                sectionSave={<IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />}
              />
            </div>

            <section className={cardClass}>
              <CardTitle>Klienta dati</CardTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  label="Vārds, uzvārds"
                  autoComplete="name"
                  value={[rec.clientFirstName, rec.clientLastName].filter(Boolean).join(" ").trim()}
                  onChange={(value) => {
                    const normalized = value.replace(/\s+/g, " ").trim();
                    if (!normalized) {
                      onPatchRecord({ clientFirstName: "", clientLastName: "" });
                      return;
                    }
                    const [first, ...rest] = normalized.split(" ");
                    onPatchRecord({ clientFirstName: first ?? "", clientLastName: rest.join(" ") });
                  }}
                />
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Tālrunis</span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <input className={`${fieldClass} min-w-0 flex-1`} value={rec.phone} inputMode="tel" autoComplete="tel" onChange={(e) => onPatch("phone", e.target.value)} />
                    <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[var(--color-provin-accent)] disabled:opacity-35" title="Zvanīt" aria-label="Zvanīt" disabled={!canCall} onClick={onCall}>
                      <Phone className="h-5 w-5" aria-hidden />
                    </button>
                    <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-35" title="Atvērt WhatsApp" aria-label="Atvērt WhatsApp" disabled={!canCall} onClick={() => onWhatsappText("")}>
                      <WhatsAppGlyph className="h-5 w-5" />
                    </button>
                  </div>
                  {phoneWarning ? <p className="mt-1 text-[11px] text-amber-800">{phoneWarning}</p> : null}
                </label>
                <Field label="E-pasts" value={rec.email} inputMode="email" autoComplete="email" onChange={(value) => onPatch("email", value)} />
                <Field id="iriss-room-vin" label="VIN (ja zināms)" value={rec.vin} warning={vinWarning} onChange={(value) => onPatch("vin", value.toUpperCase())} />
              </div>
              <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
            </section>

            <section className={`${cardClass} border-red-100/80 bg-red-50/20`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={onCreateOffer} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-[var(--color-provin-accent)]">
                  <Plus className="h-4 w-4" aria-hidden />
                  Izveidot piedāvājumu
                </button>
                <button type="button" disabled={busy || orderPdfBusy} onClick={() => void onSave()} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--color-provin-accent)] px-4 text-[13px] font-semibold text-[var(--color-provin-accent)] disabled:opacity-50">
                  {busy || orderPdfBusy ? "Saglabā…" : "Saglabāt"}
                </button>
                <button type="button" disabled={busy} onClick={onDeleteOrder} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-red-300/90 bg-white px-4 text-[13px] font-semibold text-red-800 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Dzēst pasūtījumu
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <section className={cardClass}>
              <CardTitle>Statusa vēsture</CardTitle>
              {history.length === 0 ? (
                <p className="text-[13px] text-[#6b7280]">Statusa maiņas vēl nav.</p>
              ) : (
                <ol>
                  {history.slice(0, 8).map((entry) => (
                    <li key={`${entry.at}-${entry.from}-${entry.to}`} className="flex items-start justify-between gap-3 border-b border-dashed border-[#eee] py-1.5 text-[13px] text-[#111827] last:border-0">
                      <span className="min-w-0">
                        {irissOrderRoomStatusLabel(entry.to)}
                        {entry.reason ? ` (${entry.reason})` : ""}
                      </span>
                      <span className="shrink-0 text-[12px] text-[#6b7280]">
                        {irissOrderRoomStamp(entry.at)}
                        {entry.by ? ` · ${entry.by}` : ""}
                        {entry.from ? ` · no ${irissOrderRoomStatusLabel(entry.from)}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section className={cardClass}>
              <CardTitle>Nākamie soļi</CardTitle>
              <IrissOrderRoomNextSteps
                steps={steps}
                onSelect={(step) => {
                  setTab(step.tab);
                  if (step.id === "vin") document.getElementById("iriss-room-vin")?.focus();
                }}
              />
            </section>
            <section className={cardClass}>
              <CardTitle>Platformas</CardTitle>
              {platformKeys.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2.5 text-[12px] font-extrabold">
                  {platformKeys.map((platform) => (
                    <span key={platform} style={{ color: PLATFORM_INK[platform] ?? "#111827" }}>
                      {IRISS_LISTING_PLATFORM_LABEL[platform] ?? platform}
                    </span>
                  ))}
                </div>
              ) : null}
              <IrissListingPlatformChipsRow rec={rec} />
              <p className="mt-2 text-[12px] text-[#6b7280]">
                {linkCount > 0 ? `${linkCount} saglabātas meklēšanas saites` : "Nav saglabātu meklēšanas saišu"}
                {platforms.length > 0 ? ` · ${platforms.join(" ")}` : ""}
              </p>
              <button type="button" className="mt-2 text-[13px] font-semibold text-[var(--color-provin-accent)]" onClick={() => setLinksOpen((v) => !v)}>
                {linksOpen ? "Aizvērt saites" : "Rediģēt saites"}
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
      ) : null}

      {tab === "search" ? (
        <div className="mt-3 min-w-0 space-y-3">
          <div className="sticky top-0 z-10 flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-3 py-2.5">
            <b className="text-[12px] text-[#111827]">KRITĒRIJI</b>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={openCriteria}
                className={`max-w-full truncate rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
                  chip.tone === "required"
                    ? "border-[#fca5a5] bg-[#fee2e2] text-[#991b1b]"
                    : "border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]"
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
              <button type="button" className="rounded-full bg-[#111827] px-2.5 py-1 text-[12px] font-semibold text-white" onClick={() => setCriteriaOn(false)}>
                Filtrs ieslēgts
              </button>
            ) : null}
            <Link href={searchHref} className="text-[13px] font-semibold text-[#1d4ed8]">
              Atvērt meklētājā
            </Link>
          </div>
          <p className="text-[12px] leading-snug text-[#6b7280]">
            Tie paši jau nolasītie auto, kas Meklētājā ir piesaistīti šim pasūtījumam. Istaba pati nesāk jaunu nolasīšanu.
          </p>
          {listingsCache === "off" ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              Sludinājumu kešs nav ieslēgts. Maksas avoti netiek prasīti.
            </p>
          ) : null}
          <div className="flex max-w-full flex-wrap gap-1.5" role="tablist" aria-label="Sludinājumu statuss">
            {BUCKETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setBucket(item.id)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                  bucket === item.id
                    ? "border-[#111827] bg-[#111827] text-white"
                    : "border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]"
                }`}
              >
                {item.label} {bucketCounts[item.id]}
              </button>
            ))}
          </div>
          {shownHits.length === 0 ? (
            <p className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-6 text-[14px] text-[var(--color-provin-muted)]">
              {listingsCache === "off" ? "Kešā nav ko rādīt." : "Šajā statusā nav sludinājumu."}
            </p>
          ) : (
            <ul className="space-y-3">
              {shownHits.map((hit) => (
                <li key={hit.id} className="min-w-0">
                  <IrissOrderRoomHitCard
                    hit={hit}
                    budget={budget}
                    isFav={favIds.has(hit.id)}
                    dismissed={dismissed.has(hit.id)}
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onPrepareOffer(hit)} className={roomBtnPrimary}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Sagatavot piedāvājumu
                        </button>
                        <button type="button" disabled={!canCall} onClick={() => onWhatsappText(irissOrderRoomHitShareText(hit))} className={roomBtnDark}>
                          <Send className="h-3.5 w-3.5" aria-hidden />
                          Nosūtīt klientam
                        </button>
                        {typeof hit.detailUrl === "string" && hit.detailUrl ? (
                          <a href={hit.detailUrl} target="_blank" rel="noopener noreferrer" className={roomBtn}>
                            Atvērt portālā
                          </a>
                        ) : null}
                        <button type="button" aria-pressed={favIds.has(hit.id)} aria-label={favIds.has(hit.id) ? "Noņemt no saglabātajiem" : "Saglabāt"} onClick={() => toggleFav(hit.id)} className={`${roomBtn} w-10 px-0`}>
                          <Star className={`h-4 w-4 ${favIds.has(hit.id) ? "fill-amber-400 text-amber-500" : "text-slate-500"}`} aria-hidden />
                        </button>
                        {dismissed.has(hit.id) ? (
                          <button type="button" onClick={() => void setHitHidden(hit, false)} className={roomBtn}>
                            Atjaunot
                          </button>
                        ) : (
                          <button type="button" onClick={() => void setHitHidden(hit, true)} className={roomBtn}>
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Neder
                          </button>
                        )}
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-3 min-w-0 space-y-3">
          <section className={cardClass}>
            <CardTitle>Sludinājumu saites</CardTitle>
            <IrissListingPlatformsFields
              rec={rec}
              onPatch={onPatchRecord}
              onReadLink={onReadLink}
              readingUrl={readingUrl}
              readCountByUrl={readCountByUrl}
            />
            <IrissOrderSectionSaveButton disabled={busy || orderPdfBusy} onSave={onSave} />
          </section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[#6b7280]">Klienta portfelis · {rec.offers.length} piedāvājumi</p>
            <button type="button" onClick={onCreateOffer} className={roomBtnPrimary}>
              <Plus className="h-4 w-4" aria-hidden />
              Jauns piedāvājums
            </button>
          </div>
          {rec.offers.length === 0 ? (
            <p className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-6 text-[14px] text-[#6b7280]">Šim klientam vēl nav piedāvājumu.</p>
          ) : (
            <ul className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rec.offers.map((offer, index) => {
                const total = irissOrderRoomOfferTotal(offer);
                const thumb = irissOrderRoomOfferThumb(offer);
                const link = offerLinks.find((item) => item.offerId === offer.id) ?? null;
                const badge = offerPortfolioBadge(offer, link);
                const sent = link ? formatIrissOfferLinkStamp(link.createdAt) : "";
                const opened = link && link.viewCount > 0 ? formatIrissOfferLinkStamp(link.statusAt) : "";
                return (
                  <li key={offer.id} className="min-w-0 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                    <div className="flex items-center gap-3 p-3 md:block md:p-0">
                      <div className="relative h-14 w-[70px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-300 to-slate-500 md:h-[150px] md:w-full md:rounded-none">
                        {thumb ? (
                          <IrissLazyImage
                            src={listingDisplayImageUrl({ url: thumb, maxWidth: 480 })}
                            alt=""
                            sizes="(max-width: 767px) 70px, 320px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 md:p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] font-bold leading-snug text-[#111827]">{offer.title || `Piedāvājums ${index + 1}`}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
                        </div>
                        <p className="mt-1 text-[13px] text-[#111827]">{offer.brandModel.trim() || "Marka nav norādīta"}</p>
                        <p className="mt-1 text-[18px] font-extrabold text-[#111827]">{total != null ? listingFmtEur(total) : "Cena nav"}</p>
                        <p className="mt-1 text-[12px] text-[#6b7280]">
                          {sent ? `Nosūtīts ${sent}` : "Nav nosūtīts"}
                          {opened ? ` · pēd. atvēra ${opened}` : ""}
                          {link?.question ? ` · ${link.question}` : ""}
                        </p>
                      </div>
                      <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white md:hidden" aria-label="Labot" onClick={() => onEditOffer(offer)}>
                        <ChevronRight className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                    <div className="space-y-2 px-3 pb-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onEditOffer(offer)} className={roomBtn}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Labot
                        </button>
                        <button type="button" onClick={() => onOpenOfferPdf(offer.id)} className={roomBtn}>
                          PDF
                        </button>
                        <button type="button" disabled={!canCall} onClick={() => onWhatsappText(offerShareText(offer))} className={roomBtnWa}>
                          WA
                        </button>
                      </div>
                      <IrissOfferClientLinkBar
                        offerId={offer.id}
                        link={link}
                        phone={rec.phone}
                        email={rec.email}
                        vehicle={offer.brandModel.trim() || offer.title}
                        busy={linkBusyId === offer.id}
                        onCreate={(expiresInDays) => void mutateOfferLink(offer.id, { action: "create", expiresInDays })}
                        onRevoke={() => void mutateOfferLink(offer.id, { action: "revoke" })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {rec.offers.length > 0 ? (
            <section className={cardClass}>
              <CardTitle>Atbilžu vēsture</CardTitle>
              {replies.length === 0 ? (
                <p className="text-[13px] text-[#6b7280]">Klientu atbilžu vēl nav.</p>
              ) : (
                <ul>
                  {replies.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 border-b border-dashed border-[#eee] py-1.5 text-[13px] last:border-0">
                      <span className="min-w-0">{row.text}</span>
                      <span className="shrink-0 text-[12px] text-[#6b7280]">{row.side}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "communication" ? (
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
          <section className={`${cardClass} space-y-2`}>
            {history.length === 0 && noteLines.length === 0 ? (
              <p className="text-[13px] leading-snug text-[#6b7280]">
                Saglabātu ziņu arhīva vēl nav. Zvans, WhatsApp un e-pasts atveras ar pogām. Piezīmes paliek pasūtījumā.
              </p>
            ) : null}
            {noteLines.map((line, index) => (
              <div key={`note-${index}`} className="flex justify-start">
                <div className="max-w-[85%] rounded-[14px] bg-[#f3f4f6] px-3 py-2.5 text-[13px] leading-snug text-[#111827] md:max-w-[70%]">
                  <p className="text-[11px] text-[#6b7280]">Piezīme</p>
                  {line}
                </div>
              </div>
            ))}
            {history.map((entry) => (
              <div key={`${entry.at}-${entry.to}`} className="flex justify-end">
                <div className="max-w-[85%] rounded-[14px] bg-[#dbeafe] px-3 py-2.5 text-[13px] leading-snug text-[#111827] md:max-w-[70%]">
                  <p className="text-[11px] text-[#6b7280]">
                    Statuss · {irissOrderRoomStamp(entry.at)}
                    {entry.by ? ` · ${entry.by}` : ""}
                  </p>
                  {irissOrderRoomStatusLabel(entry.from)} uz {irissOrderRoomStatusLabel(entry.to)}
                  {entry.reason ? ` (${entry.reason})` : ""}
                </div>
              </div>
            ))}
            <label className="mt-2 block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.6px] text-[#6b7280]">Piezīmes</span>
              <textarea className={areaClass} aria-label="Piezīmes" value={rec.notes} onChange={(e) => onPatch("notes", e.target.value)} />
            </label>
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
                <button type="button" className={actionBtn} disabled={!canEmail} onClick={() => openMail(composer)}>
                  E-pasts
                </button>
              </div>
            </div>
          </section>
          <aside>
            <section className={cardClass}>
              <CardTitle>Ātrā saziņa</CardTitle>
              <div className="grid gap-2">
                <button type="button" className={roomBtn} disabled={!canCall} onClick={onCall}>
                  <Phone className="h-4 w-4" aria-hidden />
                  {rec.phone.trim() || "Tālrunis nav"}
                </button>
                <button type="button" className={`${roomBtnWa} w-full`} disabled={!canCall} onClick={() => onWhatsappText(composer)}>
                  WhatsApp
                </button>
                <button type="button" className={roomBtn} disabled={!canEmail} onClick={() => openMail(composer)}>
                  <Mail className="h-4 w-4" aria-hidden />
                  {rec.email.trim() || "E-pasts nav"}
                </button>
              </div>
              <div className="mt-3.5">
                <CardTitle>Šabloni</CardTitle>
                <ul>
                  {IRISS_ORDER_ROOM_TEMPLATES.map((template) => (
                    <li key={template.id} className="border-b border-dashed border-[#eee] last:border-0">
                      <button type="button" className="w-full py-1.5 text-left text-[13px] text-[#111827] hover:bg-[#f9fafb]" onClick={() => setComposer(template.text)}>
                        {template.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="mt-3 min-w-0 space-y-3">
          <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <li className={cardClass}>
              <FileText className="h-8 w-8 text-[#64748b]" aria-hidden />
              <p className="mt-1 text-[14px] font-bold text-[#111827]">Pasūtījuma līgums</p>
              <p className="mt-1 text-[12px] text-[#6b7280]">Esošais pasūtījuma izdruka</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={roomBtn} onClick={onPdf} disabled={orderPdfBusy}>
                  Atvērt
                </button>
                <button type="button" className={roomBtn} onClick={onPdf} disabled={orderPdfBusy} aria-label="Lejupielādēt līgumu">
                  <FileDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
            <li className={cardClass}>
              <FileText className="h-8 w-8 text-[#64748b]" aria-hidden />
              <p className="mt-1 text-[14px] font-bold text-[#111827]">Izmaksu tāme</p>
              <p className="mt-1 text-[12px] text-[#6b7280]">Dzintarzeme Auto</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
              </div>
            </li>
            {rec.offers.map((offer, index) => (
              <li key={offer.id} className={cardClass}>
                <FileText className="h-8 w-8 text-[#64748b]" aria-hidden />
                <p className="mt-1 text-[14px] font-bold text-[#111827]">{offer.title || `Piedāvājums ${index + 1}`} PDF</p>
                <p className="mt-1 text-[12px] text-[#6b7280]">{offer.brandModel.trim() || "PDF no saglabātā piedāvājuma"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={roomBtn} onClick={() => onOpenOfferPdf(offer.id)}>
                    Atvērt
                  </button>
                  <button type="button" className={roomBtn} onClick={() => onOpenOfferPdf(offer.id)} aria-label="Lejupielādēt piedāvājumu">
                    <FileDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <section className={cardClass}>
            <CardTitle>Ģenerēt</CardTitle>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onPdf} disabled={orderPdfBusy} className={roomBtnPrimary}>
                {orderPdfBusy ? "PDF…" : "Līgums"}
              </button>
              <button
                type="button"
                className={roomBtn}
                onClick={() => {
                  setTab("overview");
                  window.setTimeout(() => document.getElementById("iriss-room-tame")?.scrollIntoView({ block: "start" }), 0);
                }}
              >
                Tāme
              </button>
              <button type="button" className={roomBtn} onClick={onCreateOffer}>
                Piedāvājums
              </button>
            </div>
          </section>
        </div>
      ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-[var(--admin-tabbar-h,0px)] z-[40] grid grid-cols-3 gap-2 border-t border-[#e5e7eb] bg-[#fffffff2] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden">
        <button type="button" disabled={orderPdfBusy} onClick={onPdf} className="flex h-11 min-w-0 items-center justify-center rounded-xl bg-white text-[14px] font-semibold text-[#1d4ed8] shadow-[inset_0_0_0_1px_#e5e7eb]">
          {orderPdfBusy ? "PDF…" : "Līgums"}
        </button>
        <button type="button" onClick={onCreateOffer} className="flex h-11 min-w-0 items-center justify-center rounded-xl bg-[#e5e7eb] text-[14px] font-semibold text-[#111827]">
          Piedāvājums
        </button>
        <button type="button" disabled={busy || orderPdfBusy} onClick={() => void onSave()} className="flex h-11 min-w-0 items-center justify-center rounded-xl bg-[#2563eb] text-[14px] font-semibold text-white disabled:opacity-50">
          {busy || orderPdfBusy ? "…" : "Saglabāt"}
        </button>
      </div>

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
                  ["engineType", "Dzinējs"],
                  ["preferredColors", "Krāsa"],
                  ["transmission", "Ātrumkārba"],
                  ["driveType", "Piedziņa"],
                  ["bodyType", "Virsbūve"],
                  ["maxMileage", "Max km"],
                  ["interiorFinish", "Salons"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={criteriaDraft[key]}
                  onChange={(value) => setCriteriaDraft((prev) => ({ ...prev, [key]: value }))}
                />
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11.5px] font-semibold text-[#374151]">Obligātās prasības</span>
                <textarea className={areaClass} value={criteriaDraft.equipmentRequired} onChange={(e) => setCriteriaDraft((prev) => ({ ...prev, equipmentRequired: e.target.value }))} />
              </label>
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

