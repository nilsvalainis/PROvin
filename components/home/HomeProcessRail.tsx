"use client";

import { useTranslations } from "next-intl";

const railHeightClass = "min-h-[min(52vh,420px)]";

/** Kreisā sleja: etiķetes pa kreisi no līnijas; `left` = kā `max-w-[1200px]` slejas satura sākums (px-4 / sm:px-6). */
export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");

  const steps = [
    { n: "01", label: t("rail01") },
    { n: "02", label: t("rail02") },
    { n: "03", label: t("rail03") },
  ] as const;

  return (
    <aside
      className="pointer-events-none fixed top-1/2 z-[35] hidden -translate-y-1/2 lg:block left-[max(calc(1rem+env(safe-area-inset-left,0px)),calc(50%-37.5rem+1rem))] sm:left-[max(calc(1.5rem+env(safe-area-inset-left,0px)),calc(50%-37.5rem+1.5rem))]"
      aria-hidden
    >
      <div className={`flex items-stretch gap-3 ${railHeightClass}`}>
        <div className={`flex flex-col justify-between py-1 ${railHeightClass}`}>
          {steps.map((s) => (
            <p
              key={s.n}
              className="home-rail-label max-w-[10rem] text-left text-[10px] font-semibold uppercase leading-tight tracking-[0.22em] sm:max-w-[11rem] sm:text-[11px] sm:tracking-[0.24em]"
            >
              <span className="opacity-70">{s.n}</span>
              <span className="mx-1 opacity-40" aria-hidden>
                /
              </span>
              <span className="tracking-[0.18em] sm:tracking-[0.2em]">{s.label}</span>
            </p>
          ))}
        </div>
        <div className={`w-[0.5px] shrink-0 self-stretch bg-[#b8bcc4]/40 ${railHeightClass}`} />
      </div>
    </aside>
  );
}
