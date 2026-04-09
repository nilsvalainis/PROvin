import { Cpu, Database, FileSearch, MessagesSquare } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

const iconStroke = 1.75;

function ServiceIcon({ index }: { index: number }) {
  const cls = "h-[1.15rem] w-[1.15rem] shrink-0 text-provin-accent sm:h-5 sm:w-5";
  switch (index) {
    case 0:
      return <Database className={cls} aria-hidden strokeWidth={iconStroke} />;
    case 1:
      return <FileSearch className={cls} aria-hidden strokeWidth={iconStroke} />;
    case 2:
      return <Cpu className={cls} aria-hidden strokeWidth={iconStroke} />;
    default:
      return <MessagesSquare className={cls} aria-hidden strokeWidth={iconStroke} />;
  }
}

/**
 * Hero: četri horizontāli bloki vertikālā sarakstā — baltas kartītes, mīksta ēna, gaiši pelēks fons.
 */
export function HeroServiceGrid({ items }: { items: HeroServiceItem[] }) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;
  const rows = [
    { item: a, index: 0 },
    { item: b, index: 1 },
    { item: c, index: 2 },
    { item: d, index: 3 },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[min(100%,440px)] rounded-[2rem] bg-[#ececf0] p-3 sm:p-3.5">
      <ul className="flex list-none flex-col gap-2.5 sm:gap-3">
        {rows.map(({ item, index }) => (
          <li key={`hero-svc-${index}`}>
            <article className="flex flex-row items-start gap-3 rounded-[2rem] bg-white px-4 py-3.5 text-left shadow-sm sm:gap-4 sm:px-5 sm:py-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f1fc] sm:h-10 sm:w-10"
                aria-hidden
              >
                <ServiceIcon index={index} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-[13px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[14px]">
                  {item.title}
                </h3>
                <p className="mt-1 text-[11px] font-normal leading-relaxed text-[#6e6e73] sm:text-[12px]">{item.body}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
