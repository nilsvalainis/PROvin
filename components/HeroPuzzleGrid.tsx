import { Cog, Cpu, Database, FileSearch, MessagesSquare } from "lucide-react";

export type HeroPuzzlePillar = {
  title: string;
  body: string;
};

const CLIP = {
  tl: "provin-hero-puzzle-tl",
  tr: "provin-hero-puzzle-tr",
  bl: "provin-hero-puzzle-bl",
  br: "provin-hero-puzzle-br",
} as const;

/**
 * objectBoundingBox — kvadrāta gabali ar klasiskām kvadrātām „cilpiņām” iekšējās malās.
 * Ārmalas — gandrīz taisnas (rounded-sm imitācija ar maziem lūzuma punktiem).
 */
function PuzzleClipDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden" width="0" height="0">
      <defs>
        <clipPath id={CLIP.tl} clipPathUnits="objectBoundingBox">
          <path d="M0.02,0.02 L0.98,0.02 L0.98,0.36 Q1.052,0.5,0.98,0.64 L0.98,0.98 L0.64,0.98 Q0.5,1.052,0.36,0.98 L0.02,0.98 L0.02,0.02 Z" />
        </clipPath>
        <clipPath id={CLIP.tr} clipPathUnits="objectBoundingBox">
          <path d="M0.02,0.02 L0.98,0.02 L0.98,0.36 Q1.052,0.5,0.98,0.64 L0.98,0.98 L0.64,0.98 Q0.5,1.052,0.36,0.98 L0.02,0.98 L0.02,0.64 Q0.08,0.5,0.02,0.36 L0.02,0.02 Z" />
        </clipPath>
        <clipPath id={CLIP.bl} clipPathUnits="objectBoundingBox">
          <path d="M0.02,0.02 L0.36,0.02 Q0.5,0.1,0.64,0.02 L0.98,0.02 L0.98,0.36 Q1.052,0.5,0.98,0.64 L0.98,0.98 L0.02,0.98 L0.02,0.02 Z" />
        </clipPath>
        <clipPath id={CLIP.br} clipPathUnits="objectBoundingBox">
          <path d="M0.02,0.02 L0.36,0.02 Q0.5,0.1,0.64,0.02 L0.98,0.02 L0.98,0.98 L0.02,0.98 L0.02,0.64 Q0.08,0.5,0.02,0.36 L0.02,0.02 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

const iconClass = "h-7 w-7 shrink-0 text-provin-accent [stroke-width:1.5] sm:h-8 sm:w-8";

function PuzzleIcon({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <Database className={iconClass} aria-hidden strokeWidth={1.5} />;
    case 1:
      return <FileSearch className={iconClass} aria-hidden strokeWidth={1.5} />;
    case 2:
      return (
        <span className="relative inline-flex h-7 w-[2.25rem] shrink-0 items-center justify-center sm:h-8 sm:w-[2.5rem]" aria-hidden>
          <Cpu className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 text-provin-accent [stroke-width:1.5] sm:h-7 sm:w-7" strokeWidth={1.5} />
          <Cog className="absolute right-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-provin-accent [stroke-width:1.5] sm:h-5 sm:w-5" strokeWidth={1.5} />
        </span>
      );
    default:
      return <MessagesSquare className={iconClass} aria-hidden strokeWidth={1.5} />;
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
          "flex h-full min-h-[8.5rem] flex-col gap-2 bg-white p-3 sm:min-h-[9.25rem] sm:gap-2.5 sm:p-3.5",
          "shadow-none transition-[filter,background-color] duration-200",
          "[filter:drop-shadow(0_0_0_1px_rgb(229,231,235))]",
          "hover:z-[4] hover:bg-gray-50/90",
          "hover:[filter:drop-shadow(0_0_0_1px_rgb(209,213,219))_drop-shadow(0_0_0_2px_rgba(0,97,210,0.12))]",
        ].join(" ")}
      >
        <div className="flex items-start gap-2.5 sm:gap-3">
          <PuzzleIcon index={index} />
          <div className="min-w-0 flex-1 pt-0.5 text-left">
            <h3 className="text-[12px] font-semibold leading-tight tracking-tight text-[#1d1d1f] sm:text-[13px]">{title}</h3>
            <p className="mt-1 text-[10.5px] font-normal leading-snug text-[#6e6e73] sm:text-[11.5px] sm:leading-relaxed">{body}</p>
          </div>
        </div>
      </article>
    </div>
  );
}

/** Hero: 2×2 plakans puzles režģis (bez 3D ēnām), zīmola zilas līniju ikonas. */
export function HeroPuzzleGrid({ pillars }: { pillars: HeroPuzzlePillar[] }) {
  const [a, b, c, d] = pillars;
  if (!a || !b || !c || !d) return null;

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,380px)]">
      <PuzzleClipDefs />
      <div
        className="grid aspect-square w-full grid-cols-2 grid-rows-2 overflow-visible"
        style={{ gap: 0 }}
      >
        <PuzzlePiece clipId={CLIP.tl} index={0} title={a.title} body={a.body} overlapClass="z-[2] -mb-[5.5%] -mr-[5.5%]" />
        <PuzzlePiece clipId={CLIP.tr} index={1} title={b.title} body={b.body} overlapClass="z-[2] -mb-[5.5%] -ml-[5.5%]" />
        <PuzzlePiece clipId={CLIP.bl} index={2} title={c.title} body={c.body} overlapClass="z-[1] -mt-[5.5%] -mr-[5.5%]" />
        <PuzzlePiece clipId={CLIP.br} index={3} title={d.title} body={d.body} overlapClass="z-[1] -mt-[5.5%] -ml-[5.5%]" />
      </div>
    </div>
  );
}
