import type { BlogBlock } from "@/lib/blog/types";

export function BlogPostBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="blog-post-body mx-auto flex w-full max-w-[min(42.5rem,calc(100vw-2rem))] flex-col gap-5 text-[0.9375rem] leading-[1.75] text-[#374151] sm:gap-6 sm:text-[1.05rem] sm:leading-[1.8]">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`;
        if (block.type === "h2") {
          return (
            <h2
              key={key}
              className="mt-4 text-balance text-[1.15rem] font-semibold tracking-tight text-[#111827] sm:mt-6 sm:text-[1.35rem]"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "callout") {
          return (
            <aside
              key={key}
              className="border-l-2 border-provin-accent bg-[#eef4ff] px-4 py-3 text-[0.95em] leading-snug text-[#1f2937] sm:px-5 sm:py-4"
            >
              {block.text}
            </aside>
          );
        }
        if (block.type === "stats") {
          return (
            <dl
              key={key}
              className="grid gap-3 rounded-sm border border-black/[0.08] bg-white px-4 py-4 sm:grid-cols-2 sm:gap-4 sm:px-5"
            >
              {block.rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                    {row.label}
                  </dt>
                  <dd className="mt-1 text-[0.95rem] font-medium text-[#111827] sm:text-[1.05rem]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
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
