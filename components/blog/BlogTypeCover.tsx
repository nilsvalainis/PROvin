import { blogTypeCover } from "@/lib/blog/type-cover";

/** Melnbalts tipogrāfisks kadrs ar punktu rakstu (bez attēliem). */
export function BlogTypeCover({ slug, title, className = "" }: { slug: string; title: string; className?: string }) {
  const c = blogTypeCover(slug, title);
  return (
    <div className={`blog-type-cover ${className}`} aria-hidden>
      <b>{c.big}</b>
      {c.small ? <span>{c.small}</span> : null}
    </div>
  );
}
