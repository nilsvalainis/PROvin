import { getMessages, getTranslations } from "next-intl/server";
import { homeContentMaxClass, sectionH2Class } from "@/lib/home-layout";

type ListItem = { t: string; d: string };
type PuzzleItem = { t: string; d: string };

export async function WhyProvin() {
  const t = await getTranslations("Why");
  const messages = await getMessages();
  const why = (messages as { Why: { block1List: ListItem[]; puzzleBullets: PuzzleItem[] } }).Why;
  const block1List = why.block1List;
  const puzzleBullets = why.puzzleBullets;

  return (
    <section className="relative bg-white px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
      <div className={`relative ${homeContentMaxClass}`}>
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-6">
          <article className={highlightCardClass}>
            <h2 className={`${sectionH2Class} uppercase tracking-[0.02em]`}>{t("block1Title")}</h2>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#5c5d62] sm:text-[16px]">{t("block1Subtitle")}</p>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {block1List.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-provin-accent/15 bg-white p-4 shadow-[0_2px_12px_rgba(0,102,214,0.06)] sm:p-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,102,214,0.3)]">
                    {i + 1}
                  </span>
                  <p className="min-w-0 text-[14px] font-normal leading-relaxed text-[#86868b] sm:text-[15px]">
                    <span className="font-semibold text-[#1d1d1f]">{item.t}:</span>{" "}
                    <span className="text-[#86868b]">{item.d}</span>
                  </p>
                </li>
              ))}
            </ul>
          </article>

          <article className={highlightCardClass}>
            <h2 className={`${sectionH2Class} uppercase tracking-[0.02em]`}>{t("block2Title")}</h2>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#5c5d62] sm:text-[16px]">{t("block2Subtitle")}</p>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {puzzleBullets.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-provin-accent/15 bg-white p-4 shadow-[0_2px_12px_rgba(0,102,214,0.06)] sm:p-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,102,214,0.3)]">
                    {i + 1}
                  </span>
                  <p className="min-w-0 text-[14px] font-normal leading-relaxed text-[#86868b] sm:text-[15px]">
                    <span className="font-semibold text-[#1d1d1f]">{item.t}:</span>{" "}
                    <span className="text-[#86868b]">{renderFootnoteStar(item.d)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}

function renderFootnoteStar(text: string) {
  const idx = text.indexOf("*");
  if (idx === -1) {
    return text;
  }
  return (
    <>
      {text.slice(0, idx)}
      <span className="align-super text-[11px] text-[#86868b]">*</span>
      {text.slice(idx + 1)}
    </>
  );
}

const highlightCardClass =
  "provin-lift-strong flex min-h-0 min-w-0 flex-col rounded-2xl border border-provin-accent/15 bg-gradient-to-b from-provin-accent-soft/95 to-[#fbfbfd] p-6 shadow-[0_4px_28px_rgba(0,102,214,0.1)] sm:p-8";
