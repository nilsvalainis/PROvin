"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ENGINEERING_CONCEPT_METAS } from "@/components/demo/provin-engineering/engineeringContent";
import { EngineeringHeroConceptView } from "@/components/demo/provin-engineering/EngineeringHeroConcepts";

export function EngineeringHeroDemos() {
  const t = useTranslations("Hero");
  const [active, setActive] = useState(0);
  const content = useMemo(() => {
    const pillarsRaw = t.raw("pillars") as { title: string }[] | undefined;
    const pillars = Array.isArray(pillarsRaw) ? pillarsRaw.map((p) => p.title) : [];
    return {
      line1: `${t("h1Vin")} ${t("h1Un")} ${t("h1Sludinajuma")}`,
      auditWord: t("h1Line2"),
      subtitle: t("h2"),
      pillars,
    };
  }, [t]);

  const meta = ENGINEERING_CONCEPT_METAS[active] ?? ENGINEERING_CONCEPT_METAS[0]!;

  return (
    <div className="min-w-0 bg-[#020308] text-white">
      <div className="sticky top-0 z-[35] border-b border-white/[0.08] bg-[#020308]/95 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#020308]/85">
        <div className="mx-auto flex max-w-[min(96rem,calc(100vw-1rem))] flex-col gap-3 px-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/demo"
              className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 transition hover:text-[#7eb6ff]"
            >
              ← Demo studija
            </Link>
            <span className="text-[10px] text-white/25">|</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Engineering / choreography · 30 koncepti
            </p>
          </div>
          <div className="flex max-h-[min(40vh,22rem)] flex-col gap-2 overflow-y-auto pr-1 sm:max-h-none">
            <div className="flex flex-wrap gap-1.5">
              {ENGINEERING_CONCEPT_METAS.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-left text-[8px] font-semibold uppercase tracking-[0.08em] transition sm:text-[9px] ${
                    i === active
                      ? "border-[#0066ff]/55 bg-[#0066ff]/18 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/22 hover:text-white/85"
                  }`}
                >
                  <span className="text-white/35">{m.n}.</span> {m.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[min(96rem,calc(100vw-1rem))] px-3 pb-10 pt-5 sm:px-5 sm:pb-14">
        <header className="mb-8 max-w-[56rem] border-b border-white/[0.07] pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0066ff]/55">
            Tēma {meta.theme} · #{meta.n}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white/95 sm:text-2xl">{meta.title}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/55 sm:text-[14px]">{meta.blurb}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            Framer Motion: scroll saistītas rotācijas, pathLength zīmēšana, spring stagger, paralakse pret peli un
            slāņiem. Foni: multi-stop gradienti, stikls (backdrop-blur), rasējuma režģis, gaiši / tumši lauki.
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-black/40 shadow-[0_0_0_1px_rgb(0_0_0/0.5)]">
          <EngineeringHeroConceptView meta={meta} c={content} />
        </div>
      </div>
    </div>
  );
}
