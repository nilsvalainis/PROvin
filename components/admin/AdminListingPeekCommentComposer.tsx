"use client";

import { useMemo, useState } from "react";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { LISTING_PEEK_TOPIC_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  type ListingPeekTone,
  type ListingPeekTopicId,
} from "@/lib/listing-peek-comment-presets";

const TONE_BTN: Record<ListingPeekTone, string> = {
  positive:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 data-[on=true]:border-emerald-500 data-[on=true]:bg-emerald-600 data-[on=true]:text-white",
  caution:
    "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500 data-[on=true]:text-white",
  concern:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 data-[on=true]:border-red-500 data-[on=true]:bg-red-600 data-[on=true]:text-white",
};

const emptyLines = (): Record<ListingPeekTopicId, string> => ({
  odometer: "",
  incidents: "",
  technical: "",
  seller: "",
  photos: "",
});

export function AdminListingPeekCommentComposer({
  fieldId,
  smtpOk,
}: {
  fieldId: string;
  smtpOk: boolean;
}) {
  const [openId, setOpenId] = useState<ListingPeekTopicId | null>("odometer");
  const [lines, setLines] = useState(emptyLines);
  const [tones, setTones] = useState<Partial<Record<ListingPeekTopicId, ListingPeekTone>>>({});
  const [closer, setCloser] = useState(false);

  const comment = useMemo(
    () => assembleListingPeekCustomerComment({ closer, lines }),
    [closer, lines],
  );

  function applyPhrase(topicId: ListingPeekTopicId, tone: ListingPeekTone, text: string) {
    setTones((prev) => ({ ...prev, [topicId]: tone }));
    setLines((prev) => ({ ...prev, [topicId]: text }));
    setOpenId(topicId);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
        Komentārs klientam — ikona atver sagataves
      </p>

      <div className="space-y-2">
        {LISTING_PEEK_TOPICS.map((topic) => {
          const Icon = LISTING_PEEK_TOPIC_LUCIDE[topic.id];
          const open = openId === topic.id;
          const filled = Boolean(lines[topic.id].trim());
          return (
            <div
              key={topic.id}
              className="rounded-xl border border-slate-200/90 bg-white px-2.5 py-2"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`${fieldId}-${topic.id}-panel`}
                  title={`${topic.title} — sagataves`}
                  onClick={() => setOpenId(open ? null : topic.id)}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${
                    filled
                      ? "border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent)]/8"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <AdminProvinLucide icon={Icon} size={16} />
                  <span className="sr-only">{topic.title}</span>
                </button>
                <label
                  htmlFor={`${fieldId}-${topic.id}`}
                  className="min-w-[5.5rem] text-[12px] font-semibold text-[var(--color-apple-text)]"
                >
                  {topic.title}
                </label>
                <input
                  id={`${fieldId}-${topic.id}`}
                  value={lines[topic.id]}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLines((prev) => ({ ...prev, [topic.id]: next }));
                    setTones((prev) => {
                      const copy = { ...prev };
                      delete copy[topic.id];
                      return copy;
                    });
                  }}
                  placeholder="Īsa frāze vai izvēlies no ikonas…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
                />
              </div>
              {open ? (
                <div
                  id={`${fieldId}-${topic.id}-panel`}
                  className="mt-2 flex flex-wrap gap-1.5 pl-10"
                >
                  {topic.phrases.map((phrase) => (
                    <button
                      key={phrase.tone}
                      type="button"
                      data-on={tones[topic.id] === phrase.tone}
                      title={phrase.text}
                      onClick={() => applyPhrase(topic.id, phrase.tone, phrase.text)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${TONE_BTN[phrase.tone]}`}
                    >
                      {phrase.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-provin-muted)]">
        <input
          type="checkbox"
          checked={closer}
          onChange={(e) => setCloser(e.target.checked)}
          className="mt-0.5"
        />
        Pievienot teikumu par sludinājuma robežu un AUDITS (pirms pogas e-pastā).
      </label>

      <input type="hidden" name="comment" value={comment} />

      {comment.trim() ? (
        <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[12px] leading-relaxed text-[var(--color-apple-text)]">
          {comment}
        </pre>
      ) : (
        <p className="text-[12px] text-[var(--color-provin-muted)]">
          Izvēlies vismaz vienu sagatavi vai ieraksti savu teikumu.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <button
          type="submit"
          disabled={!smtpOk || comment.trim().length < 8}
          className="rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Nosūtīt e-pastu
        </button>
        {!smtpOk ? (
          <p className="text-[12px] text-amber-700">SMTP nav konfigurēts.</p>
        ) : null}
      </div>
    </div>
  );
}
