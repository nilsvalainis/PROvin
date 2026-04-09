import { Cpu, Database, FileSearch, MessagesSquare } from "lucide-react";

export type HeroServiceItem = {
  title: string;
  body: string;
};

const CLIP = {
  tl: "provin-hero-svc-puzzle-tl",
  tr: "provin-hero-svc-puzzle-tr",
  bl: "provin-hero-svc-puzzle-bl",
  br: "provin-hero-svc-puzzle-br",
} as const;

/** Klasiska 2×2 puzle — objectBoundingBox, asi ārējie stūri, cilpas tikai uz iekšējām malām. */
function PuzzleClipDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden" width="0" height="0">
      <defs>
        <clipPath id={CLIP.tl} clipPathUnits="objectBoundingBox">
          <path d="M0,0 L1,0 L1,0.35 Q1.055,0.5 1,0.65 L1,1 L0.65,1 Q0.5,1.055 0.35,1 L0,1 L0,0 Z" />
        </clipPath>
        <clipPath id={CLIP.tr} clipPathUnits="objectBoundingBox">
          <path d="M0,0 L1,0 L1,1 L0.65,1 Q0.5,1.055 0.35,1 L0,1 L0,0.65 Q0.055,0.5 0,0.35 L0,0 Z" />
        </clipPath>
        <clipPath id={CLIP.bl} clipPathUnits="objectBoundingBox">
          <path d="M0,0 L0.35,0 Q0.5,-0.055 0.65,0 L1,0 L1,0.35 Q1.055,0.5 1,0.65 L1,1 L0,1 L0,0 Z" />
        </clipPath>
        <clipPath id={CLIP.br} clipPathUnits="objectBoundingBox">
          <path d="M0,0 L0.35,0 Q0.5,-0.055 0.65,0 L1,0 L1,1 L0,1 L0,0.65 Q0.055,0.5 0,0.35 L0,0 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

const iconClass = "h-16 w-16 shrink-0 text-provin-accent sm:h-20 sm:w-20";

function ServiceIcon({ index }: { index: number }) {
  const sw = 1.65;
  switch (index) {
    case 0:
      return <Database className={iconClass} aria-hidden strokeWidth={sw} />;
    case 1:
      return <FileSearch className={iconClass} aria-hidden strokeWidth={sw} />;
    case 2:
      return <Cpu className={iconClass} aria-hidden strokeWidth={sw} />;
    default:
      return <MessagesSquare className={iconClass} aria-hidden strokeWidth={sw} />;
  }
}

function PuzzlePiece({
  clipId,
  index,
  title,
  body,
  overlapClass,
}: {
  clipId: string;
  index: number;
  title: string;
  body: string;
  overlapClass: string;
}) {
  return (
    <div
      className={`relative h-full min-h-0 min-w-0 w-full ${overlapClass}`}
      style={{
        clipPath: `url(#${clipId})`,
        WebkitClipPath: `url(#${clipId})`,
      }}
    >
      <article
        className={[
          "flex h-full min-h-[10rem] flex-col gap-2.5 rounded-none bg-white p-3 text-left sm:min-h-[12rem] sm:gap-3.5 sm:p-5",
          "transition-[transform,filter] duration-200 ease-out",
          "[filter:drop-shadow(0_0_0_1px_rgb(229,231,235))]",
          "hover:z-[5] hover:-translate-y-1 hover:[filter:drop-shadow(0_0_0_2px_rgb(0,97,210))]",
        ].join(" ")}
      >
        <ServiceIcon index={index} />
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[15px]">{title}</h3>
          <p className="mt-1.5 text-[11.5px] font-normal leading-relaxed text-[#6e6e73] sm:text-[12.5px]">{body}</p>
        </div>
      </article>
    </div>
  );
}

/**
 * Hero: fiziski savienots 2×2 puzles režģis (SVG clip-path), `grid-cols-2` visos platumos.
 * Pelēka kontūra (gray-200), hover — pacēlums un zīmola zila kontūra.
 */
export function HeroServiceGrid({ items }: { items: HeroServiceItem[] }) {
  const [a, b, c, d] = items;
  if (!a || !b || !c || !d) return null;

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,440px)]">
      <PuzzleClipDefs />
      <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-visible">
        <PuzzlePiece clipId={CLIP.tl} index={0} title={a.title} body={a.body} overlapClass="z-[2] -mb-[5%] -mr-[5%]" />
        <PuzzlePiece clipId={CLIP.tr} index={1} title={b.title} body={b.body} overlapClass="z-[2] -mb-[5%] -ml-[5%]" />
        <PuzzlePiece clipId={CLIP.bl} index={2} title={c.title} body={c.body} overlapClass="z-[1] -mt-[5%] -mr-[5%]" />
        <PuzzlePiece clipId={CLIP.br} index={3} title={d.title} body={d.body} overlapClass="z-[1] -mt-[5%] -ml-[5%]" />
      </div>
    </div>
  );
}
