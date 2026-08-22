"use client";

import {
  LISTING_PEEK_TOPICS,
  type ListingPeekTone,
  type ListingPeekTopicId,
} from "@/lib/listing-peek-comment-presets";

export const LISTING_PEEK_TONE_BTN_CLASS: Record<ListingPeekTone, string> = {
  positive:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 data-[on=true]:border-emerald-500 data-[on=true]:bg-emerald-600 data-[on=true]:text-white disabled:opacity-40",
  caution:
    "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500 data-[on=true]:text-white disabled:opacity-40",
  concern:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 data-[on=true]:border-red-500 data-[on=true]:bg-red-600 data-[on=true]:text-white disabled:opacity-40",
  critical:
    "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100 data-[on=true]:border-rose-800 data-[on=true]:bg-rose-800 data-[on=true]:text-white disabled:opacity-40",
  info:
    "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 data-[on=true]:border-slate-700 data-[on=true]:bg-slate-700 data-[on=true]:text-white disabled:opacity-40",
};

/** Zaļā / dzeltenā / sarkanā sagatave — tā pati rinda kā ātajos vērtējumos. */
export function AdminListingPeekTopicChips({
  topicId,
  selectedTone,
  disabled,
  onSelect,
}: {
  topicId: ListingPeekTopicId;
  selectedTone?: ListingPeekTone | null;
  disabled?: boolean;
  onSelect: (tone: ListingPeekTone, text: string) => void;
}) {
  const topic = LISTING_PEEK_TOPICS.find((t) => t.id === topicId);
  if (!topic) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {topic.phrases.map((phrase) => (
        <button
          key={phrase.id}
          type="button"
          data-on={selectedTone === phrase.tone}
          title={phrase.text}
          disabled={disabled}
          onClick={() => onSelect(phrase.tone, phrase.text)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${LISTING_PEEK_TONE_BTN_CLASS[phrase.tone]}`}
        >
          {phrase.label}
        </button>
      ))}
    </div>
  );
}
