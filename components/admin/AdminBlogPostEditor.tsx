"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { BlogBlock, BlogPost } from "@/lib/blog/types";
import type { BlogCommentAdmin } from "@/lib/blog/types";

type Props = {
  initialPost: BlogPost;
  initialComments: BlogCommentAdmin[];
};

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)]";
const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]";

export function AdminBlogPostEditor({ initialPost, initialComments }: Props) {
  const router = useRouter();
  const [originalSlug] = useState(initialPost.slug);
  const [post, setPost] = useState<BlogPost>(initialPost);
  const [comments, setComments] = useState(initialComments);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const tagsText = useMemo(() => post.tags.join(", "), [post.tags]);

  function updateLv<K extends keyof BlogPost["lv"]>(key: K, value: BlogPost["lv"][K]) {
    setPost((p) => ({ ...p, lv: { ...p.lv, [key]: value } }));
  }

  function setBlocks(body: BlogBlock[]) {
    updateLv("body", body);
  }

  function updateBlock(index: number, next: BlogBlock) {
    setBlocks(post.lv.body.map((b, i) => (i === index ? next : b)));
  }

  function addBlock(type: BlogBlock["type"]) {
    const blank: BlogBlock =
      type === "stats"
        ? { type: "stats", rows: [{ label: "", value: "" }] }
        : type === "image"
          ? {
              type: "image",
              src: "/blog/auto-vestures-parbaude.jpg",
              alt: "Auto vēstures pārbaude",
              width: 870,
              height: 1024,
              caption: "",
            }
          : { type, text: "" };
    setBlocks([...post.lv.body, blank]);
  }

  function removeBlock(index: number) {
    setBlocks(post.lv.body.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= post.lv.body.length) return;
    const next = [...post.lv.body];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setBlocks(next);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/blog-posts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(post),
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string; post?: BlogPost };
        if (!r.ok) {
          setMessage({ kind: "err", text: j.error || `Kļūda ${r.status}` });
          return;
        }
        if (j.post) setPost(j.post);
        if (j.post && j.post.slug !== originalSlug) {
          await fetch(`/api/admin/blog-posts?slug=${encodeURIComponent(originalSlug)}`, {
            method: "DELETE",
          }).catch(() => null);
          router.replace(`/admin/blogs/${encodeURIComponent(j.post.slug)}`);
        }
        setMessage({ kind: "ok", text: "Saglabāts." });
        router.refresh();
      } catch {
        setMessage({ kind: "err", text: "Neizdevās saglabāt." });
      }
    });
  }

  function removePost() {
    if (!confirm(`Dzēst ierakstu „${post.lv.title}”? Šo nevar atsaukt.`)) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/admin/blog-posts?slug=${encodeURIComponent(post.slug)}`, {
          method: "DELETE",
        });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          setMessage({ kind: "err", text: j.error || `Kļūda ${r.status}` });
          return;
        }
        router.push("/admin/blogs");
        router.refresh();
      } catch {
        setMessage({ kind: "err", text: "Neizdevās dzēst." });
      }
    });
  }

  function removeComment(id: string) {
    if (!confirm("Dzēst šo komentāru?")) return;
    startTransition(async () => {
      try {
        const r = await fetch(
          `/api/admin/blog-comments?slug=${encodeURIComponent(post.slug)}&id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          setMessage({ kind: "err", text: j.error || "Neizdevās dzēst komentāru." });
          return;
        }
        setComments((prev) => prev.filter((c) => c.id !== id));
      } catch {
        setMessage({ kind: "err", text: "Neizdevās dzēst komentāru." });
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/blogs"
          className="text-sm font-medium text-[var(--color-provin-accent)] hover:underline"
        >
          ← Visi ieraksti
        </Link>
        <span className="text-[var(--color-provin-muted)]">·</span>
        <a
          href={`/lv/blogs/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--color-provin-muted)] hover:text-[var(--color-provin-accent)]"
        >
          Skatīt publiski ↗
        </a>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:grid-cols-2">
        <label className={labelClass}>
          Slug (URL)
          <input
            className={fieldClass}
            value={post.slug}
            onChange={(e) => setPost((p) => ({ ...p, slug: e.target.value }))}
          />
        </label>
        <label className={labelClass}>
          Datums (YYYY-MM-DD)
          <input
            className={fieldClass}
            value={post.publishedAt}
            onChange={(e) => setPost((p) => ({ ...p, publishedAt: e.target.value }))}
          />
        </label>
        <label className={labelClass}>
          Kategorija
          <input
            className={fieldClass}
            value={post.category}
            onChange={(e) => setPost((p) => ({ ...p, category: e.target.value }))}
          />
        </label>
        <label className={labelClass}>
          Birkas (ar komatu)
          <input
            className={fieldClass}
            value={tagsText}
            onChange={(e) =>
              setPost((p) => ({
                ...p,
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              }))
            }
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Cover attēls (src) — SEO / Open Graph
          <input
            className={fieldClass}
            placeholder="/blog/auto-vestures-parbaude.jpg"
            value={post.coverImage?.src ?? ""}
            onChange={(e) => {
              const src = e.target.value.trim();
              setPost((p) => ({
                ...p,
                coverImage: src
                  ? {
                      src,
                      alt: p.coverImage?.alt ?? "Auto vēstures pārbaude",
                      width: p.coverImage?.width ?? 870,
                      height: p.coverImage?.height ?? 1024,
                      caption: p.coverImage?.caption,
                    }
                  : undefined,
              }));
            }}
          />
        </label>
        {post.coverImage ? (
          <>
            <label className={`${labelClass} sm:col-span-2`}>
              Cover alt (SEO)
              <input
                className={fieldClass}
                value={post.coverImage.alt}
                onChange={(e) =>
                  setPost((p) =>
                    p.coverImage
                      ? { ...p, coverImage: { ...p.coverImage, alt: e.target.value } }
                      : p,
                  )
                }
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Cover paraksts
              <input
                className={fieldClass}
                value={post.coverImage.caption ?? ""}
                onChange={(e) =>
                  setPost((p) =>
                    p.coverImage
                      ? {
                          ...p,
                          coverImage: {
                            ...p.coverImage,
                            caption: e.target.value.trim() || undefined,
                          },
                        }
                      : p,
                  )
                }
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">LV saturs</h2>
        <label className={labelClass}>
          Virsraksts
          <input
            className={fieldClass}
            value={post.lv.title}
            onChange={(e) => updateLv("title", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Izvilkums (saraksts)
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={post.lv.excerpt}
            onChange={(e) => updateLv("excerpt", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Sociālais izvilkums (pēc izvēles)
          <textarea
            className={`${fieldClass} min-h-[56px]`}
            value={post.lv.socialExcerpt ?? ""}
            onChange={(e) => updateLv("socialExcerpt", e.target.value || undefined)}
          />
        </label>

        <div className="pt-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
              Teksta bloki
            </h3>
            <div className="flex flex-wrap gap-1.5">
            {(["p", "h2", "callout", "stats", "image"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] hover:bg-slate-50"
              >
                + {type}
              </button>
            ))}
            </div>
          </div>

          <ul className="flex list-none flex-col gap-4">
            {post.lv.body.map((block, index) => (
              <li key={`${block.type}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                    {block.type}
                  </span>
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => moveBlock(index, -1)}>
                    ↑
                  </button>
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => moveBlock(index, 1)}>
                    ↓
                  </button>
                  <button type="button" className="ml-auto text-xs font-medium text-red-600 hover:underline" onClick={() => removeBlock(index)}>
                    Dzēst bloku
                  </button>
                </div>
                {block.type === "stats" ? (
                  <div className="space-y-2">
                    {block.rows.map((row, ri) => (
                      <div key={ri} className="grid gap-2 sm:grid-cols-2">
                        <input
                          className={fieldClass}
                          placeholder="Etiķete"
                          value={row.label}
                          onChange={(e) => {
                            const rows = block.rows.map((r, i) =>
                              i === ri ? { ...r, label: e.target.value } : r,
                            );
                            updateBlock(index, { type: "stats", rows });
                          }}
                        />
                        <input
                          className={fieldClass}
                          placeholder="Vērtība"
                          value={row.value}
                          onChange={(e) => {
                            const rows = block.rows.map((r, i) =>
                              i === ri ? { ...r, value: e.target.value } : r,
                            );
                            updateBlock(index, { type: "stats", rows });
                          }}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--color-provin-accent)]"
                      onClick={() =>
                        updateBlock(index, {
                          type: "stats",
                          rows: [...block.rows, { label: "", value: "" }],
                        })
                      }
                    >
                      + rinda
                    </button>
                  </div>
                ) : block.type === "image" ? (
                  <div className="space-y-2">
                    <input
                      className={fieldClass}
                      placeholder="src (/blog/...)"
                      value={block.src}
                      onChange={(e) => updateBlock(index, { ...block, src: e.target.value })}
                    />
                    <input
                      className={fieldClass}
                      placeholder="alt (SEO)"
                      value={block.alt}
                      onChange={(e) => updateBlock(index, { ...block, alt: e.target.value })}
                    />
                    <input
                      className={fieldClass}
                      placeholder="paraksts"
                      value={block.caption ?? ""}
                      onChange={(e) =>
                        updateBlock(index, {
                          ...block,
                          caption: e.target.value.trim() || undefined,
                        })
                      }
                    />
                  </div>
                ) : (
                  <textarea
                    className={`${fieldClass} min-h-[88px]`}
                    value={block.text}
                    onChange={(e) => updateBlock(index, { ...block, text: e.target.value })}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saglabā..." : "Saglabāt"}
        </button>
        <button
          type="button"
          onClick={removePost}
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 disabled:opacity-50"
        >
          Dzēst ierakstu
        </button>
        {message ? (
          <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>
            {message.text}
          </p>
        ) : null}
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">
          Komentāri ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-provin-muted)]">Nav komentāru.</p>
        ) : (
          <ul className="mt-4 flex list-none flex-col gap-4">
            {comments.map((c) => (
              <li key={c.id} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-apple-text)]">
                      {c.authorName}
                      <span className="ml-2 font-normal text-[var(--color-provin-muted)]">
                        {new Date(c.createdAt).toLocaleString("lv-LV")}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeComment(c.id)}
                    disabled={pending}
                    className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    Dzēst
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
