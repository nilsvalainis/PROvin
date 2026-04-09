"use client";

import { useMemo, useState } from "react";
import { BookText, X } from "lucide-react";
import commonPhrases from "@/data/CommonPhrases.json";
import { insertTextAtFocusedField } from "@/lib/insert-text-at-cursor";

type Category = {
  id: string;
  label: string;
  phrases: string[];
};

function loadCategories(): Category[] {
  const raw = commonPhrases as { categories?: Category[] };
  return Array.isArray(raw.categories) ? raw.categories : [];
}

export function AdminCommonPhrasesDrawerTrigger({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white px-2 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      title="Frāžu bibliotēka"
      aria-label="Atvērt frāžu bibliotēku"
      aria-expanded={open}
      onClick={onOpen}
    >
      <BookText className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function AdminCommonPhrasesDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const categories = useMemo(() => loadCategories(), []);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.flatMap((c) => {
      if (categoryId !== "all" && c.id !== categoryId) return [];
      return c.phrases
        .filter((p) => !q || p.toLowerCase().includes(q))
        .map((phrase) => ({ phrase, categoryLabel: c.label }));
    });
  }, [categories, query, categoryId]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/30"
        aria-label="Aizvērt frāzes"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-sm flex-col border-l border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] shadow-2xl"
        aria-label="Frāžu bibliotēka"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border-subtle)] px-3 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Frāzes</h2>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--color-provin-muted)] hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Aizvērt"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-[var(--admin-border-subtle)] p-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Meklēt…"
            className="w-full rounded-lg border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/30"
          />
          <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                categoryId === "all"
                  ? "bg-[var(--color-provin-accent)] text-white"
                  : "bg-black/5 text-[var(--color-provin-muted)] dark:bg-white/10"
              }`}
            >
              Visi
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  categoryId === c.id
                    ? "bg-[var(--color-provin-accent)] text-white"
                    : "bg-black/5 text-[var(--color-provin-muted)] dark:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 list-none overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-1 py-4 text-center text-[11px] text-[var(--color-provin-muted)]">Nav rezultātu.</li>
          ) : (
            filtered.map(({ phrase, categoryLabel }, i) => (
              <li key={`${phrase}-${i}`} className="mb-1">
                <button
                  type="button"
                  className="w-full rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] px-2 py-2 text-left text-[11px] leading-snug text-[var(--color-apple-text)] transition hover:border-[var(--color-provin-accent)]/40 hover:bg-[var(--color-provin-accent-soft)]/30 dark:bg-white/[0.03]"
                  onClick={() => {
                    insertTextAtFocusedField(phrase);
                    onClose();
                  }}
                >
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                    {categoryLabel}
                  </span>
                  {phrase}
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}
