import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

/** Frosted glass tuned for silver blueprint “paper”. */
const GLASS =
  "rounded-2xl border border-white/60 bg-white/40 shadow-xl shadow-[0_40px_120px_-28px_rgba(0,0,0,0.055),0_18px_48px_-16px_rgba(0,0,0,0.04)] backdrop-blur-[20px]";

/** Exploded layout on lg+; stacked column on small screens. */
const CARD_LAYOUT = [
  {
    explode:
      "max-lg:translate-x-0 -translate-x-[10%] lg:-translate-x-[10%]",
    top: "lg:top-[2%]",
  },
  {
    explode:
      "max-lg:translate-x-0 max-lg:translate-y-0 translate-x-[5%] translate-y-[20px]",
    top: "lg:top-[22%]",
  },
  {
    explode:
      "max-lg:translate-x-0 -translate-x-[5%] lg:-translate-x-[5%]",
    top: "lg:top-[44%]",
  },
  {
    explode:
      "max-lg:translate-x-0 max-lg:translate-y-0 translate-x-[6%] translate-y-[14px]",
    top: "lg:top-[64%]",
  },
] as const;

export type InvestigationLabPillar = { title: string; body: string };

export type InvestigationLabClientProps = {
  pillars: InvestigationLabPillar[];
  trustHeadline: string;
  trustBody: string;
  cta: string;
  orderHref: string;
};

export function InvestigationLabClient({
  pillars,
  trustHeadline,
  trustBody,
  cta,
  orderHref,
}: InvestigationLabClientProps) {
  return (
    <section
      id="izmeklesanas-lab"
      aria-labelledby="investigation-lab-trust"
      className="home-body-ink relative z-10 overflow-hidden bg-transparent px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
    >
      <div className="relative mx-auto max-w-[1200px]">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
          <div className="relative w-full shrink-0 lg:sticky lg:top-28 lg:max-w-[min(100%,26rem)] lg:self-start">
            <p
              id="investigation-lab-trust"
              className="home-muted-foreground max-w-[52ch] text-left text-[12px] font-medium leading-snug sm:text-[13px] sm:leading-relaxed"
            >
              {trustHeadline}
            </p>
            <div className="mt-6 space-y-4 md:space-y-5 lg:mt-8">
              <Link
                href={orderHref}
                className="lab-chrome-cta provin-btn--compact inline-flex min-h-[43px] w-fit max-w-[min(100%,17.5rem)] items-center justify-center gap-2 rounded-full px-5 text-[12px] font-semibold uppercase tracking-[0.06em] shadow-[0_7px_24px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:min-h-[46px] sm:px-6 sm:text-[13px]"
              >
                {cta}
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              </Link>
              {trustBody.trim() ? (
                <p className="home-muted-foreground max-w-[52ch] text-left text-[11px] font-normal leading-relaxed sm:text-[12px] sm:leading-relaxed">
                  {trustBody}
                </p>
              ) : null}
            </div>
          </div>

          <div className="relative isolate flex w-full flex-1 flex-col gap-8 lg:min-h-[42rem] lg:gap-0">
            {pillars.map((p, i) => {
              const Icon = ICONS[i] ?? FileText;
              const layout = CARD_LAYOUT[i] ?? CARD_LAYOUT[0];
              return (
                <div
                  key={`${p.title}-${i}`}
                  className={`relative mx-auto w-full max-w-xl lg:absolute lg:left-0 lg:right-0 lg:mx-auto ${layout.top} ${layout.explode} ${GLASS} p-6 sm:p-8`}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                    <div className="flex shrink-0 justify-center sm:pt-1">
                      <Icon
                        className="h-9 w-9 shrink-0 text-[#050505] sm:h-10 sm:w-10"
                        strokeWidth={1.25}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <h3 className="home-body-ink text-xl font-bold tracking-tight sm:text-2xl">{p.title}</h3>
                      {p.body ? (
                        <p className="home-muted-foreground mt-3 text-sm font-extralight leading-relaxed sm:text-[15px]">
                          {p.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
