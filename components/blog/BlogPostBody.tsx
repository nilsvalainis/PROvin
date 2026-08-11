import Image from "next/image";
import type { BlogBlock } from "@/lib/blog/types";

export function BlogPostBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="blog-post-body mx-auto flex w-full max-w-[min(42.5rem,calc(100vw-2rem))] flex-col gap-5 text-[0.9375rem] leading-[1.7] text-[rgb(210_214_222/0.92)] sm:gap-6 sm:text-[1.05rem] sm:leading-[1.75]">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        if (block.type === "h2") {
          return (
            <h2
              key={key}
              className="mt-4 text-balance text-[1.15rem] font-semibold tracking-tight text-white/[0.96] sm:mt-6 sm:text-[1.35rem]"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "callout") {
          return (
            <aside
              key={key}
              className="border-l-2 border-provin-accent/80 bg-white/[0.04] px-4 py-3 text-[0.95em] leading-snug text-white/[0.92] sm:px-5 sm:py-4"
            >
              {block.text}
            </aside>
          );
        }
        if (block.type === "stats") {
          return (
            <dl
              key={key}
              className="grid gap-3 rounded-sm border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:grid-cols-2 sm:gap-4 sm:px-5"
            >
              {block.rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-[0.95rem] font-medium text-white/[0.95] sm:text-[1.05rem]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          );
        }
        if (block.type === "image") {
          const w = block.width ?? 870;
          const h = block.height ?? 1024;
          return (
            <figure key={key} className="my-1 overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.03]">
              <Image
                src={block.src}
                alt={block.alt}
                width={w}
                height={h}
                className="h-auto w-full object-cover"
                sizes="(max-width: 680px) 100vw, 42.5rem"
                priority={i < 2}
              />
              {block.caption ? (
                <figcaption className="border-t border-white/[0.06] px-3 py-2.5 text-[0.75rem] leading-snug text-white/55 sm:px-4 sm:text-[0.8125rem]">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }
        return (
          <p key={key} className="text-pretty">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
