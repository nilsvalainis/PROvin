import { Cog, Cpu, Database, FileSearch, MessagesSquare } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

const iconStroke = 2;

/** Lielas, treknas līniju ikonas zīmola zilā krāsā. */
function ServiceIcon({ index }: { index: number }) {
  const single = "h-10 w-10 sm:h-11 sm:w-11 text-provin-accent [stroke-width:2]";
  switch (index) {
    case 0:
      return <Database className={single} aria-hidden strokeWidth={iconStroke} />;
    case 1:
      return <FileSearch className={single} aria-hidden strokeWidth={iconStroke} />;
    case 2:
      return (
        <span className="relative inline-flex h-9 w-11 items-center justify-center sm:h-10 sm:w-12" aria-hidden>
          <Cpu
            className="absolute left-0 top-1/2 h-7 w-7 -translate-y-1/2 text-provin-accent sm:h-8 sm:w-8"
            strokeWidth={iconStroke}
          />
          <Cog
            className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 text-provin-accent sm:h-7 sm:w-7"
            strokeWidth={iconStroke}
          />
        </span>
      );
    default:
      return <MessagesSquare className={single} aria-hidden strokeWidth={iconStroke} />;
  }
}

function ServiceCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <article
      className={[
        "flex h-full flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-8 text-left",
        "transition duration-200 ease-out",
        "hover:-translate-y-1 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--color-provin-accent-soft)] text-provin-accent sm:h-[5.25rem] sm:w-[5.25rem]">
        <ServiceIcon index={index} />
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[17px]">{title}</h3>
        <p className="mt-2 text-[13px] font-normal leading-relaxed text-[#6e6e73] sm:text-sm">{body}</p>
      </div>
    </article>
  );
}

/** Hero: 2×2 pakalpojumu režģis — lielas ikonas apaļā gaiši zilā fona, hover pacēlums. */
export function HeroServiceGrid({ items }: { items: HeroServiceItem[] }) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;

  return (
    <div className="mx-auto grid w-full max-w-[640px] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
      <ServiceCard index={0} title={a.title} body={a.body} />
      <ServiceCard index={1} title={b.title} body={b.body} />
      <ServiceCard index={2} title={c.title} body={c.body} />
      <ServiceCard index={3} title={d.title} body={d.body} />
    </div>
  );
}
