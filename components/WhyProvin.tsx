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
      <div className="relative mx-auto max-w-[1024px]">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("eyebrow")}</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[36px] sm:leading-[1.1]">
            {t("title")}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[16px] font-normal leading-relaxed text-[#86868b] sm:text-[17px]">
            {t("subtitle")}
          </p>
          <p className="provin-lift-subtle mx-auto mt-6 max-w-2xl rounded-2xl border border-provin-accent/18 bg-gradient-to-b from-provin-accent-soft/80 to-[#fbfbfd] px-5 py-4 text-left text-[15px] font-normal leading-relaxed text-[#424245] sm:px-6 sm:py-5 sm:text-[16px]">
            <span className="font-semibold text-[#1d1d1f]">{t("highlightQuote")} </span>
            {t("highlightQuoteBody")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className={highlightCardClass}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-provin-accent/10 text-provin-accent ring-1 ring-provin-accent/15">
                <IconDoc className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("block1Eyebrow")}</p>
                <h3 className="mt-2 text-[21px] font-semibold leading-[1.2] tracking-tight text-[#1d1d1f] sm:text-[23px]">
                  {t("block1Title")}
                </h3>
                <p className="mt-4 text-[15px] font-normal leading-relaxed text-[#424245] sm:text-[16px]">{t("block1Intro")}</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {block1List.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 text-[14px] font-normal leading-relaxed text-[#86868b] sm:text-[15px]">
                    <span className="font-semibold text-[#1d1d1f]">{item.t}</span>
                    <span className="text-[#86868b]"> — {item.d}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className={highlightCardClass}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-provin-accent/10 text-provin-accent ring-1 ring-provin-accent/15">
                <IconShield className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-provin-accent">{t("block2Eyebrow")}</p>
                <h3 className="mt-2 text-[21px] font-semibold leading-[1.2] tracking-tight text-[#1d1d1f] sm:text-[23px]">
                  {t("block2Title")}
                </h3>
                <p className="mt-4 text-[15px] font-normal leading-relaxed text-[#424245] sm:text-[16px]">{t("block2Intro")}</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 border-t border-provin-accent/12 pt-6">
              {puzzleBullets.map((item, i) => (
                <li
                  key={item.t}
                  className="provin-lift-subtle flex gap-3.5 rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-sm backdrop-blur-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-provin-accent text-[12px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 text-[14px] font-normal leading-relaxed text-[#86868b] sm:text-[15px]">
                    <span className="font-semibold text-[#1d1d1f]">{item.t}</span>
                    <span className="text-[#86868b]"> — </span>
                    <span className="text-[#86868b]">{renderFootnoteStar(item.d)}</span>
                  </div>
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

function renderFootnoteStar(text: string) {
  const idx = text.lastIndexOf("Records*");
  if (idx === -1) {
    return text;
  }
  const before = text.slice(0, idx + "Records".length);
  const after = text.slice(idx + "Records*".length);
  return (
    <>
      {before}
      <span className="align-super text-[11px] text-[#86868b]">*</span>
      {after}
    </>
  );
}

const highlightCardClass =
  "provin-lift-strong rounded-2xl border border-provin-accent/15 bg-gradient-to-b from-provin-accent-soft/95 to-[#fbfbfd] p-6 shadow-[0_4px_28px_rgba(0,102,214,0.1)] sm:p-8";

function IconDoc({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function IconShield({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}
