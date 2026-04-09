import { Cog, Cpu, Database, FileSearch, MessagesSquare } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

const iconStroke = 1.5;

const iconWrapClass =
  "flex shrink-0 items-center justify-center rounded-2xl bg-[var(--color-provin-accent-soft)]/85 text-provin-accent shadow-none";

/** Viena liela ikona — apm. 36–40px vizuālais svars. */
function ServiceIcon({ index }: { index: number }) {
  const single = "h-9 w-9 sm:h-10 sm:w-10 [stroke-width:1.5]";
  switch (index) {
    case 0:
      return <Database className={single} aria-hidden strokeWidth={iconStroke} />;
    case 1:
      return <FileSearch className={single} aria-hidden strokeWidth={iconStroke} />;
    case 2:
      return (
        <span className="relative inline-flex h-9 w-[2.75rem] items-center justify-center sm:h-10 sm:w-12" aria-hidden>
          <Cpu
            className="absolute left-0 top-1/2 h-8 w-8 -translate-y-1/2 sm:h-9 sm:w-9"
            strokeWidth={iconStroke}
          />
          <Cog
            className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 sm:h-7 sm:w-7"
            strokeWidth={iconStroke}
          />
        </span>
      );
    default:
      return <MessagesSquare className={single} aria-hidden strokeWidth={iconStroke} />;
  }
}

function ServiceCard({ index, title, body }: { index: number; title: string; body: string }) {
  const isDualIcon = index === 2;
  return (
    <article
      className={[
        "flex h-full min-h-0 flex-col gap-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left",
        "transition-[border-color,background-color] duration-200 sm:min-h-[11.5rem] sm:flex-row sm:gap-4 sm:p-5",
        "hover:border-gray-200/90 hover:bg-white/90",
      ].join(" ")}
    >
      <div
        className={`${iconWrapClass} ${isDualIcon ? "h-[3.75rem] w-[4.25rem] sm:h-16 sm:w-[4.5rem]" : "h-[3.75rem] w-[3.75rem] sm:h-16 sm:w-16"}`}
      >
        <ServiceIcon index={index} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[15px]">{title}</h3>
        <p className="mt-1.5 text-[12px] font-normal leading-relaxed text-[#6e6e73] sm:text-[13px]">{body}</p>
      </div>
    </article>
  );
}

/** Hero: 2×2 „premium” pakalpojumu režģis — tīras līnijas, lielas ikonas, bez puzles. */
export function HeroServiceGrid({ items }: { items: HeroServiceItem[] }) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;

  return (
    <div className="mx-auto grid w-full max-w-[560px] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 md:gap-4">
      <ServiceCard index={0} title={a.title} body={a.body} />
      <ServiceCard index={1} title={b.title} body={b.body} />
      <ServiceCard index={2} title={c.title} body={c.body} />
      <ServiceCard index={3} title={d.title} body={d.body} />
    </div>
  );
}
