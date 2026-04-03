import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroVisual } from "@/components/HeroVisual";
import { orderSectionHref } from "@/lib/paths";

type Feature = { key: string; label: string; star?: boolean };

export async function Hero() {
  const t = await getTranslations("Hero");
  const locale = await getLocale();
  const messages = await getMessages();
  const features = (messages as { Hero: { features: Feature[] } }).Hero.features;

  return (
    <section className="border-b border-black/[0.06]">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-0">
          <HeroVisual />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1] provin-noise opacity-[0.38]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto min-w-0 max-w-[692px] px-4 pb-10 pt-10 text-center sm:px-6 sm:pb-12 sm:pt-12">
          <p className="text-[14px] font-normal tracking-wide text-provin-accent sm:text-[17px]">
            {t("approved")}
          </p>

          <h1 className="mt-2 text-balance text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]">
            <span className="text-[#1d1d1f]">{t("title1")}</span>
            <span className="text-provin-accent">{t("title2")}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[65ch] text-[17px] font-medium leading-[1.45] text-[#1d1d1f] sm:mt-6 sm:text-[19px] sm:leading-[1.4]">
            {t("tagline")}
          </p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:mt-8">
            <Link
              href={orderSectionHref(locale)}
              className="provin-btn inline-flex min-h-[44px] w-full max-w-[320px] items-center justify-center rounded-full px-8 text-[17px] font-normal shadow-[0_4px_16px_rgba(0,102,214,0.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent sm:w-auto"
            >
              {t("cta")}
            </Link>
            <a
              href="#iekļauts"
              aria-label={t("includedTitle")}
              className="inline-flex text-provin-accent transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          <div id="iekļauts" className="mx-auto mt-10 w-full min-w-0 max-w-[640px] scroll-mt-24">
            <div className="rounded-2xl border border-black/[0.08] bg-white/90 px-5 py-6 shadow-[0_8px_40px_rgba(0,0,0,0.07)] backdrop-blur-[1px] sm:px-7 sm:py-8">
              <h2 className="text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-provin-accent">
                {t("includedTitle")}
              </h2>
              <p className="mx-auto mt-5 max-w-[54ch] text-center text-[12px] font-normal leading-relaxed text-[#6e6e73] sm:text-[13px]">
                {t("youGetFootnote")}
              </p>
              <ul className="mt-6 grid min-w-0 grid-cols-1 gap-2.5 border-t border-black/[0.07] pt-6 text-left sm:grid-cols-2 sm:gap-3">
                {features.map((f) => (
                  <li
                    key={f.key}
                    className="provin-lift flex min-w-0 items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_10px_rgba(0,0,0,0.04)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f6f8] text-provin-accent ring-1 ring-black/[0.04]">
                      <FeatureGlyph kind={f.key as "cv" | "dna" | "records" | "listing" | "manual" | "clock"} />
                    </span>
                    <span className="text-left text-[15px] font-medium leading-snug text-[#1d1d1f] sm:text-[16px]">
                      {f.label}
                      {f.star ? (
                        <span className="ml-0.5 align-super text-[11px] font-normal text-[#86868b]">*</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-center text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
                {t("autoRecordsFootnote")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-black/[0.06] bg-[#fafbfc]">
        <div className="mx-auto min-w-0 max-w-[692px] px-4 pb-8 pt-10 text-center sm:px-6 sm:pb-10 sm:pt-10">
          <div className="mx-auto min-w-0 max-w-[640px] text-left">
            <div className="provin-lift-strong rounded-2xl border border-black/[0.06] bg-[#fbfbfd] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-7">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">
                {t("confidenceTitle")}
              </p>
              <p className="mt-3 max-w-[65ch] text-[16px] font-normal leading-[1.55] text-[#424245] sm:text-[17px] sm:leading-[1.5]">
                {t("confidenceBody")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureGlyph({ kind }: { kind: "cv" | "dna" | "records" | "listing" | "manual" | "clock" }) {
  switch (kind) {
    case "listing":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
    case "cv":
    case "dna":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "records":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case "manual":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      );
    case "clock":
      return (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    default:
      return null;
  }
}
