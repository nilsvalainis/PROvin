"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import type { BlogCommentPublic } from "@/lib/blog/types";

type Props = {
  slug: string;
  labels: {
    title: string;
    name: string;
    comment: string;
    submit: string;
    submitting: string;
    empty: string;
    success: string;
    error: string;
  };
};

export function BlogComments({ slug, labels }: Props) {
  const [comments, setComments] = useState<BlogCommentPublic[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/blog-comments?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { comments?: BlogCommentPublic[] };
        if (!cancelled && Array.isArray(data.comments)) setComments(data.comments);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/blog-comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            authorName: name,
            body,
            website: honeypot,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          comment?: BlogCommentPublic;
        };
        if (!res.ok) {
          setMessage({ kind: "err", text: data.error || labels.error });
          return;
        }
        if (data.comment) {
          setComments((prev) => [...prev, data.comment!]);
        }
        setName("");
        setBody("");
        setMessage({ kind: "ok", text: labels.success });
      } catch {
        setMessage({ kind: "err", text: labels.error });
      }
    });
  }

  return (
    <section className="mx-auto mt-14 w-full max-w-[min(42.5rem,calc(100vw-2rem))] border-t border-black/[0.08] pt-10 sm:mt-16 sm:pt-12">
      <h2 className="text-[1.05rem] font-semibold tracking-tight text-[#111827] sm:text-[1.2rem]">
        {labels.title}
      </h2>

      <ul className="mt-6 flex list-none flex-col gap-5">
        {comments.length === 0 ? (
          <li className="text-sm text-[#9ca3af]">{labels.empty}</li>
        ) : (
          comments.map((c) => (
            <li key={c.id} className="border-b border-black/[0.06] pb-5 last:border-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
                {c.authorName}
                <span className="ml-2 font-normal normal-case tracking-normal text-[#9ca3af]">
                  {formatCommentDate(c.createdAt)}
                </span>
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-[#374151]">
                {c.body}
              </p>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="sr-only" htmlFor={`blog-hp-${slug}`}>
          Website
        </label>
        <input
          id={`blog-hp-${slug}`}
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden
        />

        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
          {labels.name}
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 block w-full border border-black/15 bg-white px-3 py-2.5 text-[0.95rem] font-normal normal-case tracking-normal text-[#111827] outline-none transition focus:border-provin-accent/60"
          />
        </label>

        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
          {labels.comment}
          <textarea
            required
            maxLength={4000}
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1.5 block w-full resize-y border border-black/15 bg-white px-3 py-2.5 text-[0.95rem] font-normal normal-case tracking-normal text-[#111827] outline-none transition focus:border-provin-accent/60"
          />
        </label>

        {message ? (
          <p
            className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 inline-flex min-h-11 w-fit items-center justify-center border border-provin-accent/40 bg-provin-accent px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#0052cc] disabled:opacity-60"
        >
          {pending ? labels.submitting : labels.submit}
        </button>
      </form>
    </section>
  );
}

function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("lv-LV", { year: "numeric", month: "short", day: "numeric" });
}
