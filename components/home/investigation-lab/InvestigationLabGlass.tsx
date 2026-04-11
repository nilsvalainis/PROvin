import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PREMIUM_GLASS_CARD } from "@/lib/premium-glass";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

const CLUSTER_POS = [
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-5 lg:absolute lg:left-[2%] lg:top-[6%] lg:w-[min(100%,22rem)]",
  "z-20 max-lg:relative max-lg:mx-auto max-lg:mb-5 lg:absolute lg:right-[1%] lg:top-[16%] lg:w-[min(100%,22rem)]",
  "z-30 max-lg:relative max-lg:mx-auto max-lg:mb-5 lg:absolute lg:bottom-[12%] lg:left-[4%] lg:w-[min(100%,22rem)]",
  "z-40 max-lg:relative max-lg:mx-auto max-lg:mb-5 lg:absolute lg:bottom-[4%] lg:right-[3%] lg:w-[min(100%,22rem)]",
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
      <div className="relative mx-auto max-w-[1100px]">
        <div className="relative z-50 mx-auto mb-12 max-w-[52ch] text-center lg:mb-14 lg:text-left">
          <p
            id="investigation-lab-trust"
            className="home-muted-foreground text-[12px] font-medium leading-snug sm:text-[13px] sm:leading-relaxed"
          >
            {trustHeadline}
          </p>
          <div className="mt-6 space-y-4 lg:mt-8">
            <Link
              href={orderHref}
              className="lab-chrome-cta provin-btn--compact inline-flex min-h-[44px] w-fit max-w-[min(100%,17.5rem)] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-semibold uppercase tracking-[0.06em] shadow-[0_7px_24px_rgba(0,0,0,0.12)] sm:min-h-[46px] sm:px-6 sm:text-[13px]"
            >
              {cta}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            </Link>
            {trustBody.trim() ? (
              <p className="home-muted-foreground text-left text-[11px] font-normal leading-relaxed sm:text-[12px]">
                {trustBody}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 w-full lg:min-h-[30rem]">
          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            const pos = CLUSTER_POS[i] ?? CLUSTER_POS[0];
            return (
              <article
                key={`${p.ref}-${p.title}`}
                className={`${PREMIUM_GLASS_CARD} px-5 py-5 sm:px-7 sm:py-6 ${pos} ${i % 2 === 1 ? "lg:translate-x-[-1%]" : "lg:translate-x-[1%]"}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                  <div className="flex shrink-0 flex-col items-center gap-1 sm:items-start">
                    <Icon className="h-9 w-9 shrink-0 text-[#0066ff] sm:h-10 sm:w-10" strokeWidth={1.25} aria-hidden />
                    <span className="font-mono text-[6px] font-semibold uppercase tracking-[0.1em] text-[#0066ff]">
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
