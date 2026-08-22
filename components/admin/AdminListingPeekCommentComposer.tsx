"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAiFieldError } from "@/components/admin/AdminAiFieldError";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminListingPeekTopicChips } from "@/components/admin/AdminListingPeekTopicChips";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { LISTING_PEEK_TOPIC_LUCIDE } from "@/lib/admin-lucide-registry";
import {
  parseAdminAiResponse,
  readGeneratedAdminAiText,
} from "@/lib/admin-ai-client-errors";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  LISTING_PEEK_COMMENT_CLOSER,
  LISTING_PEEK_TOPICS,
  applyListingPeekLetterCloser,
  assembleListingPeekCustomerComment,
  insertListingPeekLetterSentence,
  parseListingPeekAiPayload,
  type ListingPeekTone,
  type ListingPeekTopicId,
} from "@/lib/listing-peek-comment-presets";

function inferTones(
  lines: Record<ListingPeekTopicId, string>,
): Partial<Record<ListingPeekTopicId, ListingPeekTone>> {
  const tones: Partial<Record<ListingPeekTopicId, ListingPeekTone>> = {};
  for (const topic of LISTING_PEEK_TOPICS) {
    const text = lines[topic.id]?.trim();
    if (!text) continue;
    const hit = topic.phrases.find((p) => p.text === text);
    if (hit) tones[topic.id] = hit.tone;
  }
  return tones;
}

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
  listingUrl,
  initialLines,
  initialCloser = true,
  initialLetter,
  submitLabel = "Nosūtīt e-pastu",
}: {
  fieldId: string;
  smtpOk: boolean;
  listingUrl: string;
  initialLines?: Partial<Record<ListingPeekTopicId, string>>;
  initialCloser?: boolean;
  initialLetter?: string;
  submitLabel?: string;
}) {
  const [lines, setLines] = useState(() => ({ ...emptyLines(), ...initialLines }));
  const [tones, setTones] = useState(() => inferTones({ ...emptyLines(), ...initialLines }));
  const [closer, setCloser] = useState(initialCloser);
  const [letterTouched, setLetterTouched] = useState(() => Boolean(initialLetter?.trim()));
  const [letter, setLetter] = useState(
    () =>
      initialLetter?.trim() ||
      assembleListingPeekCustomerComment({ closer: initialCloser, lines: { ...emptyLines(), ...initialLines } }),
  );
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<ListingPeekTopicId | null>(() => {
    const filled = LISTING_PEEK_TOPICS.find((t) => (initialLines?.[t.id] ?? "").trim());
    return filled?.id ?? "odometer";
  });

  const assembled = useMemo(
    () => assembleListingPeekCustomerComment({ closer, lines }),
    [closer, lines],
  );

  useEffect(() => {
    if (!letterTouched) setLetter(assembled);
  }, [assembled, letterTouched]);

  function applyPhrase(topicId: ListingPeekTopicId, tone: ListingPeekTone, text: string) {
    setTones((prev) => ({ ...prev, [topicId]: tone }));
    setLines((prev) => ({ ...prev, [topicId]: text }));
    setOpenId(topicId);
    if (letterTouched) {
      setLetter((prev) => insertListingPeekLetterSentence(prev, text));
    }
  }

  function applyGenerated(
    nextLines: Record<ListingPeekTopicId, string>,
    nextCloser: boolean,
    nextLetter: string,
  ) {
    setLines(nextLines);
    setTones(inferTones(nextLines));
    setCloser(nextCloser);
    setLetter(nextLetter);
    setLetterTouched(true);
    const filled = LISTING_PEEK_TOPICS.find((t) => nextLines[t.id].trim());
    setOpenId(filled?.id ?? "odometer");
  }

  async function runAi(operatorNotes: string, modelTier: AiAdminModelTier) {
    if (!listingUrl.trim() || busy) return;
    setBusy(true);
    setAiError(null);
    try {
      const res = await fetch("/api/admin/ai/listing-peek-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingUrl,
          operatorNotes,
          existingDraftPlain: letter.trim() || undefined,
          modelTier,
        }),
      });
      const { data, parseFailed } = await parseAdminAiResponse(res);
      const generated = readGeneratedAdminAiText(
        res,
        data,
        parseFailed,
        "AI: neizdevās sagatavot komentāru",
      );
      const parsed =
        parseListingPeekAiPayload(data) ??
        (typeof generated.text === "string" ? parseListingPeekAiPayload(generated.text) : null);
      const nextLetter =
        generated.text || parsed?.letter?.trim() || "";
      if (!nextLetter && !Object.values(parsed?.lines ?? {}).some((v) => v.trim())) {
        setAiError(
          generated.ok
            ? parseFailed
              ? `AI: servera atbilde nav lasāma (HTTP ${res.status})`
              : "AI atgrieza tukšu atbildi."
            : generated.error,
        );
        return;
      }
      const nextLines = parsed?.lines ?? emptyLines();
      const nextCloser = parsed?.closer ?? closer;
      applyGenerated(
        nextLines,
        nextCloser,
        nextLetter || assembleListingPeekCustomerComment({ closer: nextCloser, lines: nextLines }),
      );
      if (!generated.ok) {
        setAiError(generated.error);
        return;
      }
    } catch {
      setAiError("AI: tīkla kļūda — mēģini vēlreiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
          Komentārs klientam — ikona atver sagataves
        </p>
        <AdminAiGenerateWithPrefill
          label="✨ Flash"
          recommendedTier={AI_ADMIN_FIELD_DEFAULT_TIER.listing_peek}
          tiers={["gemini-flash", "gemini"]}
          disabled={!listingUrl.trim()}
          busy={busy}
          dialogTitle="Piezīmes ātrajam vērtējumam"
          dialogHint="Apstrādā visu vēstules tekstu zemāk — sagataves + tavus specifiskos teikumus. Flash nolasīs ss.lv un pārkārtos PROVIN stilā, neizmetot tavas detaļas."
          onGenerate={(notes, tier) => void runAi(notes, tier)}
        />
      </div>
      <AdminAiFieldError message={aiError} />

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
                <div id={`${fieldId}-${topic.id}-panel`} className="mt-2 pl-10">
                  <AdminListingPeekTopicChips
                    topicId={topic.id}
                    selectedTone={tones[topic.id]}
                    onSelect={(tone, text) => applyPhrase(topic.id, tone, text)}
                  />
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
          onChange={(e) => {
            const next = e.target.checked;
            setCloser(next);
            if (letterTouched) setLetter((prev) => applyListingPeekLetterCloser(prev, next));
          }}
          className="mt-0.5"
        />
        <span>{LISTING_PEEK_COMMENT_CLOSER}</span>
      </label>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor={`${fieldId}-letter`}
            className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]"
          >
            Vēstule klientam — papildini ar specifiskiem teikumiem
          </label>
          {letterTouched ? (
            <button
              type="button"
              onClick={() => {
                setLetter(assembled);
                setLetterTouched(false);
              }}
              className="text-[11px] font-semibold text-[var(--color-provin-accent)] hover:underline"
            >
              Atjaunot no sagatavēm
            </button>
          ) : null}
        </div>
        <textarea
          id={`${fieldId}-letter`}
          name="comment"
          value={letter}
          onChange={(e) => {
            setLetter(e.target.value);
            setLetterTouched(true);
          }}
          rows={10}
          placeholder="Izvēlies sagataves augšā — šeit parādīsies pilnā vēstule, ko vari papildināt."
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-0.5">
        <button
          type="submit"
          disabled={!smtpOk || letter.trim().length < 8}
          className="rounded-full bg-[var(--color-provin-accent)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitLabel}
        </button>
        {!smtpOk ? (
          <p className="text-[12px] text-amber-700">SMTP nav konfigurēts.</p>
        ) : null}
      </div>
    </div>
  );
}
