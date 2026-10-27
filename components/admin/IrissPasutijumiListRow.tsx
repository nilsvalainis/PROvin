"use client";

import type { IrissOfferListBadge } from "@/lib/iriss-offer-deadline-ui";
import { ChevronDown, GripVertical, MessageCircle, Phone, Pin, Trash2 } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { IrissAnchoredPopover } from "@/components/admin/IrissAnchoredPopover";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IrissPasutijumiStatusMenuItems } from "@/components/admin/IrissPasutijumiStatusMenu";
import { buildListingPlatformChips } from "@/lib/iriss-listing-links";
import {
  formatIrissExpiredOfferLabel,
  irissListBudgetText,
  formatIrissListClientLine,
  formatIrissListLinksLabel,
  formatIrissListNextStep,
  formatIrissListSpecBrief,
  irissListMailtoHref,
  irissListShowCallAction,
  irissListShowEmailAction,
  irissListCriteriaRows,
  irissPhoneWhatsAppDigits,
} from "@/lib/iriss-pasutijumi-list-view";
import { whatsAppChatUrl } from "@/lib/admin-whatsapp-phone";
import { irissPhoneTelHref } from "@/lib/iriss-pasutijumi-list-row";
import {
  displayIrissPasutijumsListStatusLabel,
  type IrissPasutijumsListRow,
  type IrissPasutijumsListStatus,
} from "@/lib/iriss-pasutijumi-types";
import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";

const SWIPE_ACTION_BLOCK_WIDTH = 72;
const SWIPE_ACTION_WIDTH = SWIPE_ACTION_BLOCK_WIDTH * 2;
const SWIPE_CLOSE_THRESHOLD = SWIPE_ACTION_WIDTH * 0.4;
const SWIPE_OPEN_THRESHOLD = SWIPE_ACTION_WIDTH * 0.5;
const SWIPE_VELOCITY_OPEN = -620;
const SWIPE_VELOCITY_CLOSE = 620;
const SWIPE_SPRING = { type: "spring" as const, stiffness: 1000, damping: 60, mass: 0.45 };
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_LONG_PRESS_PX = 10;
const SWIPE_AXIS_MIN = 14;
const SWIPE_AXIS_BIAS = 8;

/** Nils 28.10: neitrāli (bez zaļā/sarkanā/zilā), atšķiras tikai teksts; apstiprināts - treknāks. */
const OFFER_BADGE_CLASS: Record<IrissOfferListBadge["tone"], string> = {
  approved: "border border-[var(--ink)] text-[var(--ink)]",
  declined: "border border-[var(--hair)] text-[var(--ink2)]",
  expired: "border border-[var(--hair)] text-[var(--ink2)]",
  time: "border border-[var(--hair)] text-[var(--ink2)]",
};

export const IrissPasutijumiListRow = memo(function IrissPasutijumiListRow({
  row,
  newHits,
  onPin,
  onAskDelete,
  onSetStatus,
  onRestore,
  actionBusy,
  registerSwipeCloser,
  closeOtherSwipes,
  narrowSwipeViewport,
  dragReorderEnabled,
  offerBadge = null,
}: {
  row: IrissPasutijumsListRow;
  /** Jaunākā piedāvājuma saite: Apstiprināts / Noraidīts / Beidzies / atlicis (T4). */
  offerBadge?: IrissOfferListBadge | null;
  newHits: number;
  onPin: (id: string) => void;
  onAskDelete: (id: string) => void;
  onSetStatus: (id: string, status: IrissPasutijumsListStatus) => void;
  onRestore?: (id: string) => void;
  onAskStatus?: (id: string) => void;
  actionBusy: string | null;
  registerSwipeCloser: (id: string, closer: (() => void) | null) => void;
  closeOtherSwipes: (exceptId: string) => void;
  narrowSwipeViewport: boolean;
  dragReorderEnabled: boolean;
}) {
  const reorderDragControls = useDragControls();
  const swipeDragControls = useDragControls();
  const swipeAxisRef = useRef<"idle" | "vertical" | "horizontal">("idle");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const chips = buildListingPlatformChips({
    listingLinkMobile: row.listingLinkMobile,
    listingLinkAutobid: row.listingLinkAutobid,
    listingLinkOpenline: row.listingLinkOpenline,
    listingLinkAuto1: row.listingLinkAuto1,
    listingLinkEcarstrade: row.listingLinkEcarstrade,
    listingLinksOther: row.listingLinksOther,
    totalBudget: row.totalBudget,
    brandModel: row.brandModel,
  });
  const specBrief = formatIrissListSpecBrief(row);
  const isPinned = Boolean(row.pinnedAt);
  const statusBusy = actionBusy === row.id;
  const curStatus = row.listStatus ?? "active";
  const client = formatIrissListClientLine(row);
  const telHref = irissPhoneTelHref(row.phone);
  const waDigits = irissPhoneWhatsAppDigits(row.phone);
  const criteria = irissListCriteriaRows(row);
  const mailHref = irissListMailtoHref(row.email);
  const showCall = irissListShowCallAction(narrowSwipeViewport) && Boolean(telHref);
  const showEmail = irissListShowEmailAction(row.email);
  const nextStep = formatIrissListNextStep(row, newHits);
  const budget = irissListBudgetText(row.totalBudget);
  const router = useRouter();
  const href = `/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`;
  const prefetchedRef = useRef(false);
  const prefetchRow = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    void router.prefetch(href);
  }, [href, router]);

  const openAllListings = () => {
    for (const chip of chips) {
      window.open(chip.href, "_blank", "noopener,noreferrer");
    }
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onFrontPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipeAxisRef.current = "idle";
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    closeOtherSwipes(row.id);
    setStatusMenuOpen(false);

    const startEv = e;
    if (!dragReorderEnabled || !narrowSwipeViewport) return;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      reorderDragControls.start(startEv);
    }, LONG_PRESS_MS);
  };

  const onFrontPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > MOVE_CANCEL_LONG_PRESS_PX || absY > MOVE_CANCEL_LONG_PRESS_PX) {
      clearLongPressTimer();
    }

    if (narrowSwipeViewport && swipeAxisRef.current === "idle") {
      if (absY > SWIPE_AXIS_MIN && absY > absX + SWIPE_AXIS_BIAS) {
        swipeAxisRef.current = "vertical";
      } else if (absX > SWIPE_AXIS_MIN && absX > absY + SWIPE_AXIS_BIAS) {
        swipeAxisRef.current = "horizontal";
        swipeDragControls.start(e.nativeEvent);
      }
    }
  };

  const onFrontPointerEnd = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
    swipeAxisRef.current = "idle";
  };

  const closeSwipe = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    registerSwipeCloser(row.id, closeSwipe);
    return () => registerSwipeCloser(row.id, null);
  }, [closeSwipe, registerSwipeCloser, row.id]);

  const toggleStatusMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    statusBtnRef.current = e.currentTarget;
    setStatusMenuOpen((v) => !v);
  };

  const statusBtn = (
    <button
      ref={(node) => {
        if (node?.offsetParent) statusBtnRef.current = node;
      }}
      type="button"
      disabled={statusBusy}
      onClick={toggleStatusMenu}
      onPointerDown={(e) => e.stopPropagation()}
      className="iriss-pas-status inline-flex min-h-9 items-center gap-0.5 rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2.5 text-[12px] font-semibold text-[var(--ink)] max-md:min-h-11"
      aria-haspopup="menu"
      aria-expanded={statusMenuOpen}
    >
      {displayIrissPasutijumsListStatusLabel(curStatus)}
      <ChevronDown className="h-3.5 w-3.5 opacity-55" aria-hidden />
    </button>
  );

  const newHitsLabel =
    newHits > 0 ? (
      <span className="iriss-pas-hits inline-flex h-6 items-center rounded-full border border-[var(--hair)] bg-[var(--s1)] px-2 text-[11px] font-semibold tabular-nums text-[var(--ink)]">
        {newHits} {newHits === 1 ? "jauns" : "jauni"}
      </span>
    ) : (
      <span className="text-[13px] tabular-nums text-[var(--ink3)]">-</span>
    );

  const whatsAppBtn = waDigits ? (
    <a
      href={whatsAppChatUrl(waDigits)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Atvērt WhatsApp"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="relative z-10 hidden h-11 w-11 items-center justify-center rounded-full text-[var(--ink)] hover:bg-[var(--fill)] md:inline-flex"
    >
      <MessageCircle className="h-4 w-4" aria-hidden />
    </a>
  ) : (
    <span className="hidden h-11 w-11 md:inline-flex" aria-hidden />
  );

  // Nils 28.10: datorā zvana ikonas nav; telefonā - poga "Zvanīt" zem kartītes.
  const callBtn = showCall && telHref ? (
    <a
      href={telHref}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto relative z-10 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--hair)] bg-[var(--s1)] text-[13.5px] font-semibold text-[var(--ink)]"
    >
      <Phone className="h-4 w-4" aria-hidden />
      Zvanīt
    </a>
  ) : null;

  const moreMenu = (
    <IrissOverflowMenu label="Rindas izvēlne">
      <IrissOverflowItem onClick={() => onPin(row.id)}>
        {isPinned ? "Noņemt piespraušanu" : "Piespraust"}
      </IrissOverflowItem>
      {chips.length > 0 ? (
        <IrissOverflowItem onClick={openAllListings}>{`Atvērt visas saites (${formatIrissListLinksLabel(chips.length)})`}</IrissOverflowItem>
      ) : null}
      {showEmail && mailHref ? <IrissOverflowItem href={mailHref}>E-pasts</IrissOverflowItem> : null}
      {isIrissRecordDeleted(row) && onRestore ? (
        <IrissOverflowItem onClick={() => onRestore(row.id)}>Atjaunot</IrissOverflowItem>
      ) : (
        <IrissOverflowItem tone="danger" onClick={() => onAskDelete(row.id)}>
          Dzēst
        </IrissOverflowItem>
      )}
    </IrissOverflowMenu>
  );

  /** Telefonā (Nils 28.10): Zvanīt, WhatsApp un Kritēriji - lielas pogas; kritēriji atveras turpat. */
  const actBtn =
    "pointer-events-auto relative z-10 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--hair)] bg-[var(--s1)] text-[13.5px] font-semibold text-[var(--ink)]";
  const mobileActions = (
    <span className="mt-2 block md:hidden">
      <span className="grid grid-cols-3 gap-2">
        {callBtn ?? <span />}
        {waDigits ? (
          <a
            href={whatsAppChatUrl(waDigits)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={actBtn}
          >
            WhatsApp
          </a>
        ) : (
          <span />
        )}
        <button
          type="button"
          aria-expanded={criteriaOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCriteriaOpen((v) => !v);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`${actBtn} ${criteriaOpen ? "!border-[var(--ink)] !bg-[var(--ink)] !text-[var(--onink,#fff)]" : ""}`}
        >
          Kritēriji
        </button>
      </span>
      {criteriaOpen ? (
        <span className="pointer-events-auto relative z-10 mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-[var(--hair)] pt-2 text-[13.5px]">
          {criteria.length === 0 ? (
            <span className="col-span-2 text-[var(--ink2)]">Kritēriji nav aizpildīti</span>
          ) : (
            criteria.map((c) => (
              <span key={c.label} className="contents">
                <span className="text-[var(--ink2)]">{c.label}</span>
                <b className="min-w-0 break-words font-semibold text-[var(--ink)]">{c.value}</b>
              </span>
            ))
          )}
        </span>
      ) : null}
    </span>
  );

  const frontInner = (
    <div className="iriss-pas-row relative flex min-h-[72px] items-center gap-3 px-3 py-2.5 md:min-h-[64px] md:gap-4 md:px-4">
      <Link
        href={href}
        prefetch={false}
        onPointerEnter={prefetchRow}
        onPointerDown={prefetchRow}
        onFocus={prefetchRow}
        aria-label={`Atvērt pasūtījumu: ${row.brandModel}`}
        className="absolute inset-0 z-0 rounded-[18px]"
      />
      {dragReorderEnabled && !narrowSwipeViewport ? (
        <button
          type="button"
          aria-label="Vilkšanas rokturis"
          className="relative z-10 hidden h-8 w-6 shrink-0 cursor-grab items-center justify-center text-[var(--ink3)] md:inline-flex"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            reorderDragControls.start(e);
          }}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
      <div className="pointer-events-none relative z-10 min-w-0 flex-1 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_5.5rem_minmax(0,1.1fr)] md:items-center md:gap-3">
        <span className="min-w-0">
          <span className="flex min-w-0 items-start justify-between gap-2 md:block">
            <span className="block min-w-0 break-words text-[16px] font-semibold leading-snug text-[var(--ink)] max-md:line-clamp-2 md:truncate md:text-[15px]">
              {row.brandModel}
            </span>
            <span className="relative z-10 pointer-events-auto shrink-0 md:hidden">{statusBtn}</span>
          </span>
          {specBrief ? (
            <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ink2)] max-md:line-clamp-2 md:truncate">{specBrief}</span>
          ) : null}
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-snug text-[var(--ink2)] md:hidden">
            <span className="min-w-0 break-words">{client.name}</span>
            {budget !== "-" ? <span className="shrink-0">· {budget}</span> : null}
          </span>
          <span className="mt-1.5 flex min-w-0 flex-col items-start gap-1 md:hidden">
            {newHitsLabel}
            {nextStep ? <span className="min-w-0 text-[12px] leading-snug text-[var(--ink2)] max-md:line-clamp-2">{nextStep}</span> : null}
          </span>
          {mobileActions}
          {offerBadge ? (
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${OFFER_BADGE_CLASS[offerBadge.tone]}`}>
              {offerBadge.label}
            </span>
          ) : row.hasExpiredOffer ? (
            <span className="iriss-pas-expired mt-1 inline-flex rounded-full border border-[var(--hair)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink2)]">
              {formatIrissExpiredOfferLabel(row.latestOfferValidUntil)}
            </span>
          ) : null}
        </span>
        <span className="hidden min-w-0 md:block">
          <span className="block truncate text-[13px] font-medium text-[var(--ink)]">{client.name}</span>
          {client.phone ? <span className="mt-0.5 block truncate text-[12px] tabular-nums text-[var(--ink2)]">{client.phone}</span> : null}
        </span>
        <span className="hidden truncate text-[13px] font-medium tabular-nums text-[var(--ink)] md:block">{budget}</span>
        <span className="hidden md:block">{newHitsLabel}</span>
        <span className="hidden min-w-0 md:block">
          {nextStep ? <span className="block truncate text-[13px] text-[var(--ink2)]">{nextStep}</span> : <span className="text-[var(--ink3)]">-</span>}
        </span>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-0.5 max-md:self-start">
        {whatsAppBtn}
        <span className="hidden md:inline-flex">{statusBtn}</span>
        {moreMenu}
      </div>
    </div>
  );

  const statusMenu = (
    <IrissAnchoredPopover
      open={statusMenuOpen}
      onClose={() => setStatusMenuOpen(false)}
      anchorRef={statusBtnRef}
      align="end"
      minWidth={136}
      estimatedHeight={168}
    >
      <IrissPasutijumiStatusMenuItems
        currentStatus={curStatus}
        busy={statusBusy}
        onPick={(s) => {
          setStatusMenuOpen(false);
          onSetStatus(row.id, s);
        }}
      />
    </IrissAnchoredPopover>
  );

  const cardInner = (
    <div
      className={`iriss-pas-card group relative overflow-visible rounded-[18px] bg-[var(--s1)] shadow-[var(--sh)] [content-visibility:auto] [contain-intrinsic-size:1px_80px] ${
        statusMenuOpen ? "z-40" : ""
      }`}
    >
      <div className="relative overflow-x-clip rounded-[18px]">
        {narrowSwipeViewport ? (
          <div className="absolute inset-y-0 right-0 z-0 flex bg-[var(--fill2)]" style={{ width: SWIPE_ACTION_WIDTH }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onPin(row.id);
              }}
              className="flex h-full w-[72px] flex-col items-center justify-center gap-0.5 bg-[var(--ink2)] text-[var(--onink)] transition active:brightness-95"
              aria-label={isPinned ? "Noņemt piespraušanu" : "Piespraust augšā"}
            >
              <Pin className="h-5 w-5" />
              <span className="text-[11px] font-semibold leading-none">{isPinned ? "Noņemt" : "Piespraust"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (isIrissRecordDeleted(row) && onRestore) onRestore(row.id);
                else onAskDelete(row.id);
              }}
              className={`flex h-full w-[72px] flex-col items-center justify-center gap-0.5 text-white transition active:brightness-95 ${
                isIrissRecordDeleted(row) ? "bg-[#34C759]" : "bg-[var(--bad)]"
              }`}
              aria-label={isIrissRecordDeleted(row) ? "Atjaunot pasūtījumu" : "Dzēst pasūtījumu"}
            >
              <Trash2 className="h-5 w-5" />
              <span className="text-[11px] font-semibold leading-none">{isIrissRecordDeleted(row) ? "Atjaunot" : "Dzēst"}</span>
            </button>
          </div>
        ) : null}

        {narrowSwipeViewport ? (
          <motion.div
            drag="x"
            dragControls={swipeDragControls}
            dragListener={false}
            dragConstraints={{ left: -SWIPE_ACTION_WIDTH, right: 0 }}
            dragElastic={0.12}
            dragMomentum={false}
            dragDirectionLock
            onDirectionLock={(axis) => {
              if (axis === "x") closeOtherSwipes(row.id);
            }}
            animate={{ x: isOpen ? -SWIPE_ACTION_WIDTH : 0 }}
            transition={SWIPE_SPRING}
            onPointerDown={onFrontPointerDown}
            onPointerMove={onFrontPointerMove}
            onPointerUp={onFrontPointerEnd}
            onPointerCancel={onFrontPointerEnd}
            onPanStart={clearLongPressTimer}
            onDragEnd={(_, info) => {
              const dragBase = isOpen ? -SWIPE_ACTION_WIDTH : 0;
              const finalX = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, dragBase + info.offset.x));
              const velocityX = info.velocity.x;
              const revealed = Math.abs(finalX);
              let shouldOpen = false;
              if (velocityX <= SWIPE_VELOCITY_OPEN) shouldOpen = true;
              else if (velocityX >= SWIPE_VELOCITY_CLOSE) shouldOpen = false;
              else if (revealed >= SWIPE_OPEN_THRESHOLD) shouldOpen = true;
              else if (revealed < SWIPE_CLOSE_THRESHOLD) shouldOpen = false;
              else {
                const projected = finalX + velocityX * 0.18;
                shouldOpen = Math.abs(projected) >= SWIPE_OPEN_THRESHOLD;
              }
              setIsOpen(shouldOpen);
              if (shouldOpen) closeOtherSwipes(row.id);
            }}
            className="relative z-10 touch-pan-y overscroll-x-contain bg-[var(--s1)] will-change-transform"
            style={{ transform: "translateZ(0)", touchAction: "pan-y pinch-zoom" }}
          >
            {frontInner}
          </motion.div>
        ) : (
          <div
            className="relative z-10 bg-[var(--s1)]"
            onPointerDown={onFrontPointerDown}
            onPointerMove={onFrontPointerMove}
            onPointerUp={onFrontPointerEnd}
            onPointerCancel={onFrontPointerEnd}
          >
            {frontInner}
          </div>
        )}
      </div>
      {statusMenu}
    </div>
  );

  if (dragReorderEnabled) {
    return (
      <Reorder.Item
        value={row.id}
        dragListener={false}
        dragControls={reorderDragControls}
        className={`list-none ${statusMenuOpen ? "relative z-40" : ""}`}
      >
        {cardInner}
      </Reorder.Item>
    );
  }
  return <div className={`list-none ${statusMenuOpen ? "relative z-40" : ""}`}>{cardInner}</div>;
});
