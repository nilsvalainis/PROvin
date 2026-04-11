import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PREMIUM_GLASS_CARD } from "@/lib/premium-glass";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

/** Nedaudz pārklājošs, „CAD” klasteris lielajos ekrānos. */
const CARD_CLUSTER = [
  "relative z-10",
  "relative z-20 -mt-5 lg:-mt-8 lg:translate-x-[3%]",
  "relative z-30 -mt-5 lg:-mt-8 lg:-translate-x-[2%]",
  "relative z-40 -mt-5 lg:-mt-8 lg:translate-x-[5%]",
] as const;

export type InvestigationPillar = { ref: string; title: string; body: string };

export type InvestigationLabGlassProps = {
  pillars: InvestigationPillar[];
  trustHeadline: string;
  trustBody: string;
  cta: string;
  orderHref: string;
};

export function InvestigationLabGlass({
  pillars,
  trustHeadline,
  trustBody,
  cta,
  orderHref,
}: InvestigationLabGlassProps) {
  return (
    <section
      id="izmeklesanas-lab"
      aria-labelledby="investigation-lab-trust"
      className="home-body-ink relative z-10 overflow-hidden bg-transparent px-4 py-14 sm:px-6 sm:py-16 lg:py-24"
    >
      <div className="relative mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-x-14 lg:gap-y-12">
        <div className="relative flex flex-col justify-start lg:sticky lg:top-28 lg:max-h-[calc(100dvh-7rem)] lg:self-start">
          <p
            id="investigation-lab-trust"
            className="home-muted-foreground mx-auto max-w-[52ch] text-left text-[12px] font-medium leading-snug sm:text-[13px] sm:leading-relaxed"
          >
            {trustHeadline}
          </p>
          <div className="mt-6 space-y-4 md:space-y-5 lg:mt-8">
            <Link
              href={orderHref}
              className="provin-btn provin-btn--compact home-cta-blueprint inline-flex min-h-[44px] w-fit max-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-[2px] px-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-white ring-0 shadow-none sm:text-[13px]"
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

        <div className="relative z-10 flex min-h-0 flex-col gap-5 lg:min-h-[28rem] lg:gap-6">
          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            const shift = CARD_CLUSTER[i] ?? CARD_CLUSTER[0];
            return (
              <article
                key={`${p.ref}-${p.title}`}
                className={`${PREMIUM_GLASS_CARD} px-5 py-5 sm:px-7 sm:py-6 ${shift}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                  <div className="flex shrink-0 flex-col items-center gap-1.5 sm:items-start sm:pt-0.5">
                    <Icon className="h-8 w-8 shrink-0 text-[#0066ff] sm:h-9 sm:w-9" strokeWidth={1.25} aria-hidden />
                    <span className="font-mono text-[7px] font-semibold uppercase tracking-[0.08em] text-[#050505]/80">
                      {p.ref}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h3 className="home-body-ink text-lg font-bold tracking-tight sm:text-xl">{p.title}</h3>
                    {p.body ? (
                      <p className="home-muted-foreground mt-2.5 text-sm font-extralight leading-relaxed sm:text-[15px]">
                        {p.body}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
