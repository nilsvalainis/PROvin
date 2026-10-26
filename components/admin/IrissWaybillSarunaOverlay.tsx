"use client";

import { FileText, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import {
  formatSarunaClock,
  formatSarunaUnreadBadge,
  isSarunaEscapeKey,
  type SarunaFeedItem,
} from "@/lib/iriss-waybill-saruna";

const STROKE = 1.8;

export function IrissWaybillSarunaButton({
  open,
  unreadCount,
  onClick,
  className = "",
}: {
  open: boolean;
  unreadCount: number;
  onClick: () => void;
  className?: string;
}) {
  const badge = formatSarunaUnreadBadge(unreadCount);
  return (
    <button
      type="button"
      aria-label="Saruna"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onClick}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[var(--iriss-ink)] ${
        open ? "border-[var(--iriss-ink)] bg-[var(--iriss-graphite)] text-white" : "border-[#e0e0e5] bg-white"
      } ${className}`}
    >
      <MessageSquare className="h-[18px] w-[18px]" strokeWidth={STROKE} aria-hidden />
      {badge ? (
        <span
          data-saruna-badge={badge}
          className="absolute -top-1.5 -right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#f5f5f7] bg-[#FF3B30] px-1 text-[11px] font-bold leading-none text-white"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function AttachmentCard({ name, href, sizeLabel }: { name: string; href?: string; sizeLabel?: string }) {
  const inner = (
    <>
      <FileText className="h-4 w-4 shrink-0 text-[#FF3B30]" strokeWidth={STROKE} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {sizeLabel ? <span className="shrink-0 text-[var(--iriss-ink-3)]">{sizeLabel}</span> : null}
    </>
  );
  const cls =
    "mt-1.5 flex items-center gap-2 rounded-[10px] border border-[var(--iriss-line)] bg-white px-2.5 py-2 text-[12.5px] text-[var(--iriss-ink)]";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function IrissWaybillSarunaFeed({ items }: { items: readonly SarunaFeedItem[] }) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-[13px] text-[var(--iriss-ink-3)]">Šai pavadzīmei vēl nav sarunas ierakstu.</p>;
  }
  return (
    <div className="flex flex-col gap-3" data-saruna-feed>
      {items.map((item) => {
        if (item.kind === "day") {
          return (
            <p key={item.id} className="self-center rounded-[10px] bg-[#f5f5f7] px-2.5 py-1 text-[11.5px] text-[var(--iriss-ink-3)]">
              {item.label}
            </p>
          );
        }
        if (item.kind === "system") {
          return (
            <p key={item.id} className="self-center rounded-[10px] bg-[#f5f5f7] px-2.5 py-1 text-[11.5px] text-[var(--iriss-ink-3)]">
              {item.text}
            </p>
          );
        }
        const clock = formatSarunaClock(item.at);
        return (
          <div key={item.id} className={`max-w-[88%] ${item.mine ? "self-end" : "self-start"}`}>
            <p className={`mb-0.5 text-[11.5px] text-[var(--iriss-ink-3)] ${item.mine ? "text-right" : ""}`}>
              {item.from}
              {clock ? ` · ${clock}` : ""}
            </p>
            <div
              className={`rounded-xl px-3 py-2 text-[13px] leading-snug ${
                item.mine ? "bg-[var(--iriss-graphite)] text-white" : "bg-[#f2f2f5] text-[var(--iriss-ink)]"
              }`}
            >
              {item.text ? <p>{item.text}</p> : null}
              {item.attachments.map((att) => (
                <AttachmentCard key={`${item.id}-${att.name}`} name={att.name} href={att.href} sizeLabel={att.sizeLabel} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function IrissWaybillSarunaOverlay({
  open,
  onClose,
  title,
  subtitle,
  items,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: readonly SarunaFeedItem[];
  onSend?: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  useAdminScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isSarunaEscapeKey(e.key)) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const backdropClose = useModalBackdropClose(onClose);
  const feed = useMemo(() => items, [items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" data-saruna-overlay="open">
      <button type="button" aria-label="Aizvērt sarunu" className="absolute inset-0 bg-black/20" {...backdropClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute top-16 right-4 flex h-[min(600px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[var(--iriss-line)] bg-white shadow-[0_20px_60px_rgba(0,0,0,.18)] max-md:top-12 max-md:right-3 max-md:left-3 max-md:w-auto"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#ececf0] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--iriss-ink)]">{title}</p>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--iriss-ink-3)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Aizvērt"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--iriss-ink-3)]"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={STROKE} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <IrissWaybillSarunaFeed items={feed} />
        </div>
        <form
          className="m-3 flex items-center gap-2 rounded-xl border border-[#e0e0e5] px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            onSend?.(text);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Raksti ziņu…"
            aria-label="Raksti ziņu"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[var(--iriss-ink)] outline-none placeholder:text-[var(--iriss-ink-3)]"
          />
          <button
            type="submit"
            aria-label="Sūtīt"
            disabled={!draft.trim()}
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[var(--iriss-graphite)] text-white disabled:opacity-40"
          >
            <Send className="h-[15px] w-[15px]" strokeWidth={STROKE} />
          </button>
        </form>
      </div>
    </div>
  );
}
