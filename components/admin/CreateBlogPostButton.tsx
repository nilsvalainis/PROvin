"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateBlogPostButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createPost() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/blog-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Jauns ieraksts" }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        post?: { slug?: string };
      };
      if (!r.ok || typeof j.post?.slug !== "string") {
        setErr(typeof j.error === "string" ? j.error : `Kļūda ${r.status}`);
        return;
      }
      router.push(`/admin/blogs/${encodeURIComponent(j.post.slug)}`);
      router.refresh();
    } catch {
      setErr("Neizdevās izveidot ierakstu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={createPost}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-provin-accent)] px-5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Veido..." : "Jauns ieraksts"}
      </button>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
