"use client";

import { useTranslations } from "next-intl";

const railHeightClass = "min-h-[min(52vh,420px)]";

/** Kreisā sleja — augsts z-index, `flex-row-reverse` + `items-center` pēc lapas specifikācijas. */
export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");

  const steps = [
    { n: "01", label: t("rail01") },
    { n: "02", label: t("rail02") },
    { n: "03", label: t("rail03") },
  ] as const;

  return (
    <aside
      className="pointer-events-none fixed left-6 top-1/2 z-[100] hidden -translate-y-1/2 lg:flex flex-row-reverse items-center gap-4"
      aria-hidden
    >
      <div className={`flex min-h-0 flex-col justify-between py-1 ${railHeightClass}`}>
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
    </aside>
  );
}
