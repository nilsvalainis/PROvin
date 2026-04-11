import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  BlueprintFourColumnRow,
  BlueprintGridCell,
  BlueprintSpecNode,
} from "@/components/home/BlueprintSpecGrid";

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
      className="relative z-10 overflow-hidden bg-transparent px-5 py-10 sm:px-6 sm:py-12"
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="relative z-20 mb-10 max-w-[min(100%,28rem)] text-[#050505] lg:mb-12">
          <p id="investigation-lab-trust" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#050505]">
            {trustHeadline}
          </p>
          <div className="mt-4 space-y-3">
            <Link
              href={orderHref}
              className="provin-btn provin-btn--compact home-cta-blueprint inline-flex min-h-[44px] w-fit max-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-[2px] px-6 text-[12px] font-semibold uppercase tracking-[0.06em] ring-0 shadow-none sm:text-[13px]"
            >
              {cta}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            </Link>
            {trustBody.trim() ? (
              <p className="text-[10px] font-normal leading-relaxed text-[#050505]/70">{trustBody}</p>
            ) : null}
          </div>
        </div>

        <BlueprintFourColumnRow>
          {pillars.slice(0, 4).map((p, i) => (
            <BlueprintGridCell key={`${p.ref}-${p.title}`} columnIndex={i}>
              <BlueprintSpecNode refTag={p.ref} title={p.title} body={p.body} columnIndex={i} />
            </BlueprintGridCell>
          ))}
        </BlueprintFourColumnRow>
      </div>
    </section>
  );
}
