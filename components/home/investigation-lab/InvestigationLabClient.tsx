import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

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
      className="home-body-ink relative isolate overflow-hidden bg-transparent px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
    >
      <div className="relative z-[5] mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:gap-x-14">
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

        <div className="flex flex-col gap-6 lg:gap-8">
          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            return (
              <div
                key={`${p.title}-${i}`}
                className="rounded-2xl border border-white/[0.08] bg-[#121212] p-6 sm:p-8"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                  <div className="flex shrink-0 justify-center sm:pt-1">
                    <Icon
                      className="h-9 w-9 shrink-0 text-[#0061D2] sm:h-10 sm:w-10"
                      strokeWidth={1.25}
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{p.title}</h3>
                    {p.body ? (
                      <p className="mt-3 text-sm font-extralight leading-relaxed text-[#b8bcc4] sm:text-[15px]">
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
    </section>
  );
}
