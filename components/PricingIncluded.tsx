import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PricingTransitionAndComparison } from "@/components/PricingTransitionAndComparison";
import { irissAnchorHref } from "@/lib/paths";
import { homeContentMaxClass } from "@/lib/home-layout";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

const pillarRowClass =
  "provin-lift-subtle flex min-h-0 gap-3.5 rounded-xl border border-black/[0.08] bg-white p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-5";

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  return (
    <section id="cena" className="relative scroll-mt-16 bg-white px-4 pt-8 sm:px-6 md:pt-16">
      <div className={`relative ${homeContentMaxClass}`}>
        <PricingTransitionAndComparison />

        <ul className="mt-8 grid list-none grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((item, i) => {
            const inner = (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-provin-accent text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-2 ring-white">
                  <GridIcon index={i} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-[#1d1d1f] sm:text-[16px]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] font-normal leading-relaxed text-[#86868b] sm:text-[14px] sm:leading-relaxed">
                    {item.body}
                  </p>
                  {item.href ? (
                    <p className="mt-2 text-[11px] font-medium text-provin-accent sm:text-[12px]">
                      {t("irissLink")} <span aria-hidden>↓</span>
                    </p>
                  ) : null}
                </div>
              </>
            );
            if (item.href) {
              return (
                <li key={item.title} className="min-w-0">
                  <Link
                    href={irissHref}
                    className={`${pillarRowClass} block min-h-[100%] transition hover:border-black/[0.12] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent`}
                  >
                    {inner}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.title} className={`${pillarRowClass} min-w-0`}>
                {inner}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}

function GridIcon({ index }: { index: number }) {
  const className = "h-4 w-4";
  switch (index) {
    case 0:
      return <IconGlobe className={className} />;
    case 1:
      return <IconClipboard className={className} />;
    case 2:
      return <IconHome className={className} />;
    case 3:
      return <IconSearch className={className} />;
    case 4:
      return <IconGear className={className} />;
    case 5:
      return <IconCompare className={className} />;
    case 6:
      return <IconScale className={className} />;
    case 7:
      return <IconPhone className={className} />;
    default:
      return <IconShield className={className} />;
  }
}

function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="7" y="5" width="10" height="14" rx="2" />
      <path d="M9 5.5h6M10 3h4v2h-4z" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function IconGear({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 4.5v2.2M12 17.3v2.2M6.7 6.7l1.6 1.6M15.7 15.7l1.6 1.6M4.5 12h2.2M17.3 12h2.2M6.7 17.3l1.6-1.6M15.7 8.3l1.6-1.6" />
    </svg>
  );
}

function IconCompare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M6 7h8M6 12h12M6 17h8" />
      <path d="m16 5 3 2-3 2M18 15l-3 2 3 2" />
    </svg>
  );
}

function IconScale({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 5v14M7 7h10M4.5 10.5h5l-2.5 4zM14.5 10.5h5l-2.5 4zM8 19h8" />
    </svg>
  );
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M7.5 4.5h3l1.2 3.2-2 1.3a13.3 13.3 0 0 0 5.3 5.3l1.3-2 3.2 1.2v3a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 5.5 6.7a2 2 0 0 1 2-2.2z" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 3.8 18.5 6v5.4c0 4.1-2.8 7.2-6.5 8.8-3.7-1.6-6.5-4.7-6.5-8.8V6z" />
      <path d="m9.5 12.2 1.8 1.8 3.4-3.4" />
    </svg>
  );
}
