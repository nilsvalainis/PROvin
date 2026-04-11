"use client";

import { useTranslations } from "next-intl";

/** Kreisā sleja — kreisā mala kā `max-w-[1200px]` + `px-8` iekšējai saturam; etiķetes pa kreisi no līnijas. */
export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");

  const steps = [
    { n: "01", label: t("rail01") },
    { n: "02", label: t("rail02") },
    { n: "03", label: t("rail03") },
  ] as const;

  return (
    <aside
      className="pointer-events-none fixed bottom-8 left-4 top-[calc(5.5rem+env(safe-area-inset-top,0px))] z-[100] hidden min-h-0 lg:left-[max(1.5rem,calc(50%-600px-4rem))] lg:flex lg:flex-row lg:items-stretch lg:gap-4"
      aria-hidden
    >
      <div className="flex min-h-0 flex-1 flex-col justify-between py-1">
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
      <div className="w-[0.5px] shrink-0 self-stretch bg-[#b8bcc4]/40" />
    </aside>
  );
}
