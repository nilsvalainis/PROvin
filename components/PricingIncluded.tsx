import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { irissAnchorHref } from "@/lib/paths";
import { homeSectionTitleSilverClass } from "@/lib/home-layout";
import { BlueprintExplodedConnector } from "@/components/home/BlueprintExplodedConnector";
import { BlueprintFourColumnRow, BlueprintGridCell } from "@/components/home/BlueprintSpecGrid";

type GridItem = {
  title: string;
  body: string;
  href?: boolean;
};

const PRICING_REFS = [
  "REF. 911-PR",
  "REF. 911-BL",
  "REF. 911-SH",
  "REF. 911-SC",
  "REF. 911-AL",
  "REF. 911-SP",
  "REF. 911-SL",
  "REF. 911-HD",
] as const;

function PricingNodeBlock({
  refTag,
  title,
  body,
  columnIndex,
  irissLink,
}: {
  refTag: string;
  title: string;
  body: string;
  columnIndex: number;
  irissLink?: string;
}) {
  const edge = columnIndex < 2 ? "left" : "right";
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex max-w-[min(100%,30ch)] flex-col items-center text-center">
        <p className="mb-[5px] font-mono text-[7px] font-medium uppercase tracking-[0.06em] text-[#050505]">{refTag}</p>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#050505]">{title}</h3>
        <p className="mt-1.5 text-[10px] font-normal leading-relaxed text-[#050505]/70">{body}</p>
        {irissLink ? (
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#050505]/70">
            {irissLink} <span aria-hidden>↓</span>
          </p>
        ) : null}
      </div>
      <BlueprintExplodedConnector edge={edge} />
    </div>
  );
}

export async function PricingIncluded() {
  const t = await getTranslations("Pricing");
  const locale = await getLocale();
  const irissHref = irissAnchorHref(locale);
  const messages = await getMessages();
  const grid = (messages as { Pricing: { grid: GridItem[] } }).Pricing.grid;

  const rowA = grid.slice(0, 4);
  const rowB = grid.slice(4, 8);

  return (
    <section
      id="cena"
      className="relative scroll-mt-16 bg-transparent px-5 pb-8 pt-6 text-[#050505] sm:px-6 sm:pb-10 sm:pt-8 md:pb-12 md:pt-10"
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        <h2 className={homeSectionTitleSilverClass}>{t("workTitle")}</h2>

        <BlueprintFourColumnRow className="mt-8 sm:mt-10">
          {rowA.map((item, i) => {
            const refTag = PRICING_REFS[i] ?? `REF. 911-${String(i + 1).padStart(2, "0")}`;
            const cell = (
              <PricingNodeBlock
                refTag={refTag}
                title={item.title}
                body={item.body}
                columnIndex={i}
                irissLink={item.href ? t("irissLink") : undefined}
              />
            );
            return (
              <BlueprintGridCell key={item.title} columnIndex={i}>
                {item.href ? (
                  <Link
                    href={irissHref}
                    className="block w-full transition-opacity hover:opacity-80 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#050505]/20"
                  >
                    {cell}
                  </Link>
                ) : (
                  cell
                )}
              </BlueprintGridCell>
            );
          })}
        </BlueprintFourColumnRow>

        {rowB.length > 0 ? (
          <BlueprintFourColumnRow className="mt-14 border-t-[0.5px] border-black/[0.05] pt-14 sm:mt-16 sm:pt-16 lg:mt-20 lg:pt-20">
            {rowB.map((item, i) => {
              const idx = i + 4;
              const refTag = PRICING_REFS[idx] ?? `REF. 911-${String(idx + 1).padStart(2, "0")}`;
              const cell = (
                <PricingNodeBlock refTag={refTag} title={item.title} body={item.body} columnIndex={i} />
              );
              return (
                <BlueprintGridCell key={item.title} columnIndex={i}>
                  {item.href ? (
                    <Link
                      href={irissHref}
                      className="block w-full transition-opacity hover:opacity-80 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#050505]/20"
                    >
                      {cell}
                    </Link>
                  ) : (
                    cell
                  )}
                </BlueprintGridCell>
              );
            })}
          </BlueprintFourColumnRow>
        ) : null}

        <p className="mt-10 max-w-[65ch] text-left text-[10px] font-normal leading-snug text-[#050505]/70 sm:mt-12">
          {t("autoRecordsFootnote")}
        </p>
      </div>
    </section>
  );
}
