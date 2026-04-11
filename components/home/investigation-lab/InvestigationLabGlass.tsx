import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SILVER_GLASS_CARD } from "@/lib/silver-glass";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

export type InvestigationPillar = { ref: string; title: string; body: string };

const CLUSTER_POS = [
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-4 lg:absolute lg:left-[2%] lg:top-[6%] lg:w-[min(100%,22rem)]",
  "z-20 max-lg:relative max-lg:mx-auto max-lg:mb-4 lg:absolute lg:right-[2%] lg:top-[14%] lg:w-[min(100%,22rem)]",
  "z-30 max-lg:relative max-lg:mx-auto max-lg:mb-4 lg:absolute lg:bottom-[10%] lg:left-[4%] lg:w-[min(100%,22rem)]",
  "z-40 max-lg:relative max-lg:mx-auto max-lg:mb-4 lg:absolute lg:bottom-[6%] lg:right-[4%] lg:w-[min(100%,22rem)]",
] as const;

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
      className="relative z-10 overflow-hidden bg-transparent px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-10 max-w-[min(100%,28rem)] text-[#050505] lg:mb-12">
          <p id="investigation-lab-trust" className="text-[13px] font-medium leading-relaxed sm:text-[14px]">
            {trustHeadline}
          </p>
          <div className="mt-5 space-y-4">
            <Link
              href={orderHref}
              className="lab-chrome-cta provin-btn--compact inline-flex min-h-[44px] w-fit max-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-semibold uppercase tracking-[0.06em] sm:text-[13px]"
            >
              {cta}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            </Link>
            {trustBody.trim() ? (
              <p className="text-[11px] font-normal leading-relaxed text-[#050505]/85 sm:text-[12px]">
                {trustBody}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 w-full lg:min-h-[28rem]">
          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            const pos = CLUSTER_POS[i] ?? CLUSTER_POS[0];
            return (
              <article
                key={`${p.ref}-${p.title}`}
                className={`${SILVER_GLASS_CARD} max-w-md px-5 py-4 sm:px-6 sm:py-5 lg:absolute ${pos} ${i % 2 === 1 ? "lg:translate-x-[-2%]" : "lg:translate-x-[1%]"}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-center sm:gap-1.5">
                    <Icon className="h-7 w-7 shrink-0 text-[#050505] sm:h-8 sm:w-8" strokeWidth={1.35} aria-hidden />
                    <span className="font-mono text-[6px] font-medium uppercase tracking-[0.08em] text-[#050505]/75">
                      {p.ref}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-bold leading-snug text-[#050505] sm:text-[14px]">{p.title}</h3>
                    <p className="mt-1.5 text-[10px] font-normal leading-relaxed text-[#050505]/88 sm:text-[11px]">
                      {p.body}
                    </p>
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
