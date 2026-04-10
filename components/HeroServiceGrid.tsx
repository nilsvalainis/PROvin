import { AlertTriangle, ArrowRight, Globe2, Headphones, ScanSearch } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
  hoverHint?: string;
};

const HERO_SVC_ICONS = [Globe2, ScanSearch, AlertTriangle, Headphones] as const;

/** „Tehnisko risku analīze” — izcelts režģis. */
const FEATURED_INDEX = 2;

type Accent = {
  leftBar: string;
  iconHover: string;
  shellIdle: string;
  shellHover: string;
};

const ACCENTS: readonly Accent[] = [
  {
    leftBar: "border-l-[#0061D2]",
    iconHover: "group-hover:text-[#0061D2]",
    shellIdle: "bg-[#f0f7ff]",
    shellHover: "group-hover:bg-[#dceafe]",
  },
  {
    leftBar: "border-l-[#059669]",
    iconHover: "group-hover:text-[#059669]",
    shellIdle: "bg-emerald-50/90",
    shellHover: "group-hover:bg-emerald-100/90",
  },
  {
    leftBar: "border-l-[#F97316]",
    iconHover: "group-hover:text-[#ea580c]",
    shellIdle: "bg-orange-50/95",
    shellHover: "group-hover:bg-orange-100/90",
  },
  {
    leftBar: "border-l-[#7c3aed]",
    iconHover: "group-hover:text-[#7c3aed]",
    shellIdle: "bg-violet-50/90",
    shellHover: "group-hover:bg-violet-100/90",
  },
] as const;

const cardBase =
  "group relative flex min-h-0 flex-row items-start gap-3 rounded-xl p-4 text-left shadow-none " +
  "transition-[box-shadow,background-color,border-color] duration-200 ease-out " +
  "hover:bg-black/[0.03] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] " +
  "motion-reduce:hover:shadow-none sm:gap-3.5 sm:p-4";

const cardDefault =
  `${cardBase} border border-[#e5e7eb] border-l-[3px] bg-white/95 ` +
  "motion-reduce:hover:bg-white/95";

const cardFeatured =
  `${cardBase} border border-solid border-[#F97316] bg-[rgba(249,115,22,0.08)] ` +
  "hover:bg-[rgba(249,115,22,0.11)] motion-reduce:hover:bg-[rgba(249,115,22,0.08)]";

const iconBase =
  "h-8 w-8 shrink-0 text-[#6b7280] transition-colors duration-200 [stroke-width:1.5] sm:h-[32px] sm:w-[32px]";

function BetweenDesktopArrow() {
  return (
    <div
      className="hidden shrink-0 items-center justify-center self-center px-0.5 sm:flex"
      aria-hidden
    >
      <ArrowRight className="h-4 w-4 text-[#9ca3af] opacity-[0.38]" strokeWidth={1.75} />
    </div>
  );
}

function HeroServiceCard({
  item,
  index,
  featuredBadge,
}: {
  item: HeroServiceItem;
  index: number;
  featuredBadge: string;
}) {
  const Icon = HERO_SVC_ICONS[index] ?? Globe2;
  const isFeatured = index === FEATURED_INDEX;
  const a = ACCENTS[index] ?? ACCENTS[0]!;
  const cardClass = isFeatured ? cardFeatured : `${cardDefault} ${a.leftBar}`;
  const iconClass = `${iconBase} ${a.iconHover}`;
  const shellClass = [
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 sm:h-11 sm:w-11 sm:rounded-xl",
    a.shellIdle,
    a.shellHover,
  ].join(" ");

  return (
    <div className={`${cardClass} min-w-0 w-full sm:flex-1`}>
      {isFeatured ? (
        <span className="absolute right-3 top-3 inline-flex rounded-full bg-orange-100/95 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-orange-900 sm:text-[10px]">
          {featuredBadge}
        </span>
      ) : null}
      <div className={shellClass} aria-hidden>
        <Icon className={iconClass} aria-hidden strokeWidth={1.5} />
      </div>
      <div
        className={`min-w-0 flex-1 pt-0.5 ${isFeatured ? "pr-14 sm:pr-16" : ""}`}
      >
        <h3 className="text-[15px] font-medium leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
          {item.title}
        </h3>
        <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#86868b] sm:text-[13px] sm:leading-relaxed">
          {item.body}
        </p>
        {item.hoverHint ? (
          <p
            className="mt-0 max-h-0 overflow-hidden text-[11px] font-normal leading-snug text-[#6b7280] opacity-0 transition-[margin-top,max-height,opacity] duration-200 ease-out group-hover:mt-2 group-hover:max-h-14 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:mt-0 motion-reduce:group-hover:max-h-0 motion-reduce:group-hover:opacity-0 sm:text-[11px]"
            aria-hidden
          >
            {item.hoverHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  items: HeroServiceItem[];
  headline: string;
  featuredBadge: string;
};

/**
 * Hero: 4 bloki — procesa sajūta (bultiņas desktop), unikālas krāsas, izcelts risku bloks.
 */
export function HeroServiceGrid({ items, headline, featuredBadge }: Props) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;
  return (
    <div className="mx-auto -mt-4 w-full max-w-[42rem] rounded-[2rem] border border-[#e5e7eb] bg-white/85 p-5 backdrop-blur-[10px] sm:-mt-5 sm:p-7 md:max-w-[44rem] md:p-8">
      <p className="mb-5 text-balance text-center text-[13px] font-medium leading-snug tracking-tight text-[#4b5563] sm:mb-6 sm:text-[14px]">
        {headline}
      </p>
      <div className="mx-auto w-full space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-2 md:gap-3">
          <HeroServiceCard item={a} index={0} featuredBadge={featuredBadge} />
          <BetweenDesktopArrow />
          <HeroServiceCard item={b} index={1} featuredBadge={featuredBadge} />
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-2 md:gap-3">
          <HeroServiceCard item={c} index={2} featuredBadge={featuredBadge} />
          <BetweenDesktopArrow />
          <HeroServiceCard item={d} index={3} featuredBadge={featuredBadge} />
        </div>
      </div>
    </div>
  );
}
