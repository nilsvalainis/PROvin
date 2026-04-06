import { getMessages, getTranslations } from "next-intl/server";

type ListItem = { t: string; d: string };
type PuzzleItem = { t: string; d: string };

export async function WhyProvin() {
  const t = await getTranslations("Why");
  const messages = await getMessages();
  const why = (messages as { Why: { block1List: ListItem[]; puzzleBullets: PuzzleItem[] } }).Why;
  const block1List = why.block1List;
  const puzzleBullets = why.puzzleBullets;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-provin-surface-2/30 px-4 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 provin-noise opacity-25" aria-hidden />
      <div className="relative mx-auto min-w-0 max-w-[1024px]">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <article className={highlightCardClass}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("block1Eyebrow")}</p>
            <h3 className="mt-2 text-balance text-[20px] font-semibold uppercase leading-[1.2] tracking-[0.02em] text-[#1d1d1f] sm:text-[22px]">
              {t("block1Title")}
            </h3>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#5c5d62] sm:text-[16px]">{t("block1Subtitle")}</p>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {block1List.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white">
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
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("block2Eyebrow")}</p>
            <h3 className="mt-2 text-balance text-[20px] font-semibold uppercase leading-[1.2] tracking-[0.02em] text-[#1d1d1f] sm:text-[22px]">
              {t("block2Title")}
            </h3>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-[#5c5d62] sm:text-[16px]">{t("block2Subtitle")}</p>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {puzzleBullets.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white">
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
        <p className="mx-auto mt-8 max-w-[1024px] text-center text-[10px] font-normal leading-snug text-[#86868b] sm:text-[11px]">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}

/** Zvaigznīte pēc pirmā „vārds*” tekstā (atsauce uz kājenes piezīmi). */
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
