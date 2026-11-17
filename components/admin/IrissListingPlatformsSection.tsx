"use client";

import { Filter, Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { IrissSectionHeading } from "@/components/admin/IrissSectionHeading";
import type { IrissAuctionLogoKey } from "@/lib/iriss-auction-logos";
import {
  buildListingPlatformChips,
  IR_LISTING_ALL_CHIP_STYLE,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import {
  addIrissListingLinkRow,
  coerceIrissListingLinkList,
  IRISS_LISTING_LINKS_PER_SOURCE_MAX,
  irissListingLinkUrlError,
  removeIrissListingLinkRow,
  setIrissListingLinkRow,
} from "@/lib/iriss-listing-link-lists";
import {
  applyGeneratedPlatformSearchLink,
  type IrissAuctionSearchPlatform,
} from "@/lib/iriss-listings-platform-search";
import { buildMobileDeOrderSearchUrl } from "@/lib/marketplace/search-urls";
import { marketplaceQueryFromOrder } from "@/lib/marketplace/query-from-order";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { nextStableRowKeys } from "@/lib/iriss-stable-row-keys";

const actionBtn =
  "inline-flex h-[34px] min-h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[var(--iriss-line)] bg-white px-4 text-[13px] font-semibold text-[var(--iriss-ink)] shadow-[0_1px_2px_#0000000d] transition hover:bg-[var(--iriss-surface-2)] disabled:opacity-40";

const inp =
  "h-11 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const inpInvalid =
  "h-11 min-h-11 w-full rounded-lg border border-red-400 bg-white px-3.5 py-1.5 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 sm:text-[15px]";

const lbl = "mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]";

export function IrissListingPlatformChipsRow({ rec }: { rec: IrissPasutijumsRecord }) {
  const chips = useMemo(() => buildListingPlatformChips(rec), [rec]);
  const openAll = useCallback(() => {
    for (const chip of chips) {
      window.open(chip.href, "_blank", "noopener,noreferrer");
    }
  }, [chips]);
  if (chips.length === 0) return null;
  return (
    <div className={`mb-2 ${LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}`}>
      {chips.map((c, i) => (
        <a
          key={`${c.href}-${i}`}
          href={c.href}
          target="_blank"
          rel="noopener noreferrer"
          title={c.title}
          className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS}
          style={c.chipStyle}
        >
            <IrissAuctionLogo platform={c.logoKey} fallback={c.letter} size="md" />
        </a>
      ))}
      <button
        type="button"
        onClick={openAll}
        title="Atvērt visas saites"
        aria-label="Atvērt visas"
        className={LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS}
        style={IR_LISTING_ALL_CHIP_STYLE}
      >
        ALL
      </button>
    </div>
  );
}

type LinkKey = keyof Pick<
  IrissPasutijumsRecord,
  | "listingLinkMobile"
  | "listingLinkAutobid"
  | "listingLinkOpenline"
  | "listingLinkAuto1"
  | "listingLinkEcarstrade"
  | "listingLinksOther"
>;

function SourceLinkList({
  label,
  logoKey,
  links,
  onChange,
  onGenerateFilter,
  onReadLink,
  readingUrl,
  readCountByUrl,
}: {
  label: string;
  logoKey?: IrissAuctionLogoKey;
  links: readonly string[];
  onChange: (next: string[]) => void;
  onGenerateFilter?: () => void;
  onReadLink?: (url: string) => void;
  readingUrl?: string | null;
  readCountByUrl?: Record<string, string>;
}) {
  const rows = coerceIrissListingLinkList(links);
  const canAdd = rows.length < IRISS_LISTING_LINKS_PER_SOURCE_MAX;
  const rowKeysRef = useRef<string[]>(nextStableRowKeys([], rows.length));
  rowKeysRef.current = nextStableRowKeys(rowKeysRef.current, rows.length);
  return (
    <div className="min-w-0 space-y-1.5 rounded-xl border border-[var(--iriss-line)] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {logoKey ? (
          <span className="inline-flex items-center" title={label}>
            <IrissAuctionLogo platform={logoKey} fallback={label} size="md" />
            <span className="sr-only">{label}</span>
          </span>
        ) : (
          <span className={lbl}>{label}</span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {onGenerateFilter ? (
            <button
              type="button"
              onClick={onGenerateFilter}
              className={actionBtn}
              title="Izveidot meklēšanas filtru no pasūtījuma specifikācijas"
            >
              <Filter className="h-4 w-4" aria-hidden />
              Izveidot
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(addIrissListingLinkRow(rows))}
            disabled={!canAdd}
            className={actionBtn}
            title="Pievienot vēl vienu saites lauku"
          >
            + Saite
          </button>
        </div>
      </div>
      {rows.map((line, idx) => {
        const err = irissListingLinkUrlError(line);
        const href = line.trim();
        const reading = Boolean(href && readingUrl === href);
        return (
          <div key={rowKeysRef.current[idx] ?? `row-${idx}`} className="space-y-0.5">
            <div className="flex min-w-0 items-start gap-1.5">
              <input
                className={`${err ? inpInvalid : inp} min-w-0 flex-1`}
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://…"
                value={line}
                onChange={(e) => onChange(setIrissListingLinkRow(rows, idx, e.target.value))}
                aria-label={`${label} - saite ${idx + 1}`}
                aria-invalid={Boolean(err)}
              />
              {onReadLink && href && !err ? (
                <button
                  type="button"
                  disabled={reading || Boolean(readingUrl)}
                  onClick={() => onReadLink(href)}
                  className={actionBtn}
                  title="Nolasīt šo meklēšanas saiti"
                >
                  {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {reading ? "Nolasa…" : "Nolasīt"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  rowKeysRef.current = nextStableRowKeys(rowKeysRef.current, rows.length - 1, idx);
                  onChange(removeIrissListingLinkRow(rows, idx));
                }}
                disabled={rows.length <= 1 && !line.trim()}
                className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--iriss-line)] bg-white text-[16px] leading-none text-slate-500 shadow-[0_1px_2px_#0000000d] transition hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-35"
                title="Noņemt saiti"
                aria-label="Noņemt saiti"
              >
                ×
              </button>
            </div>
            {err ? <p className="px-0.5 text-[11px] text-red-600">{err}</p> : null}
            {href && readCountByUrl?.[href] ? (
              <p className="px-0.5 text-[11px] text-[var(--iriss-ink-2)]">{readCountByUrl[href]}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  rec: IrissPasutijumsRecord;
  onPatch: (patch: Partial<IrissPasutijumsRecord>) => void;
  onReadLink?: (url: string) => void;
  readingUrl?: string | null;
  readCountByUrl?: Record<string, string>;
};

export function IrissListingPlatformsFields({ rec, onPatch, onReadLink, readingUrl, readCountByUrl }: Props) {
  const patchLinks = (key: LinkKey, next: string[]) => {
    onPatch({ [key]: next });
  };

  const generatePlatform = (platform: IrissAuctionSearchPlatform) => {
    const next = applyGeneratedPlatformSearchLink(rec, platform);
    if (!next.url) return;
    onPatch({
      listingLinkAuto1: next.record.listingLinkAuto1,
      listingLinkOpenline: next.record.listingLinkOpenline,
      listingLinkAutobid: next.record.listingLinkAutobid,
      listingLinkEcarstrade: next.record.listingLinkEcarstrade,
      ...(platform === "ecarstrade" ? { ecarstradeLinksManual: true } : {}),
    });
  };

  // Nils 30.10: mobile.de filtrs pēc tā paša principa kā viņa manuālie (pievieno blakus, esošās nemaina).
  const generateMobile = () => {
    const url = buildMobileDeOrderSearchUrl(marketplaceQueryFromOrder(rec));
    const existing = rec.listingLinkMobile.filter((u) => u.trim());
    if (existing.includes(url)) return;
    onPatch({ listingLinkMobile: [...existing, url] });
  };

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <IrissSectionHeading className="mb-0">Sludinājumu platformas (saites)</IrissSectionHeading>
      </div>
      <div className="grid grid-cols-1 gap-3.5">
        <SourceLinkList
          label="Mobile"
          logoKey="mobile"
          links={rec.listingLinkMobile}
          onChange={(next) => patchLinks("listingLinkMobile", next)}
          onGenerateFilter={generateMobile}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
        <SourceLinkList
          label="Autobid"
          logoKey="autobid"
          links={rec.listingLinkAutobid}
          onChange={(next) => patchLinks("listingLinkAutobid", next)}
          onGenerateFilter={() => generatePlatform("autobid")}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
        <SourceLinkList
          label="Openlane"
          logoKey="openline"
          links={rec.listingLinkOpenline}
          onChange={(next) => patchLinks("listingLinkOpenline", next)}
          onGenerateFilter={() => generatePlatform("openline")}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
        <SourceLinkList
          label="Auto1"
          logoKey="auto1"
          links={rec.listingLinkAuto1}
          onChange={(next) => patchLinks("listingLinkAuto1", next)}
          onGenerateFilter={() => generatePlatform("auto1")}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
        <SourceLinkList
          label="eCarsTrade"
          logoKey="ecarstrade"
          links={rec.listingLinkEcarstrade}
          onChange={(next) => patchLinks("listingLinkEcarstrade", next)}
          onGenerateFilter={() => generatePlatform("ecarstrade")}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
      </div>
      <div className="mt-3">
        <SourceLinkList
          label="Citi"
          links={rec.listingLinksOther}
          onChange={(next) => patchLinks("listingLinksOther", next)}
          onReadLink={onReadLink}
          readingUrl={readingUrl}
          readCountByUrl={readCountByUrl}
        />
      </div>
    </div>
  );
}

const SOURCE_ROWS: ReadonlyArray<{ key: LinkKey; label: string; logoKey?: IrissAuctionLogoKey; platform?: IrissAuctionSearchPlatform | "mobile" }> = [
  { key: "listingLinkMobile", label: "mobile.de", logoKey: "mobile", platform: "mobile" },
  { key: "listingLinkAuto1", label: "Auto1", logoKey: "auto1", platform: "auto1" },
  { key: "listingLinkOpenline", label: "Openlane", logoKey: "openline", platform: "openline" },
  { key: "listingLinkAutobid", label: "Autobid", logoKey: "autobid", platform: "autobid" },
  { key: "listingLinkEcarstrade", label: "eCarsTrade", logoKey: "ecarstrade", platform: "ecarstrade" },
  { key: "listingLinksOther", label: "Citi" },
];

function linkWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "saite" : "saites";
}

/**
 * Nils 30.10 (makets «Meklēšanas filtri»): saites pa avotiem filtru kartītē.
 * Rinda: avots, pirmā saite, skaits (atver sarakstu labošanai), «+ Izveidot» - pievieno jaunu blakus, esošās nemaina.
 */
export function IrissFilterSourceLinks({ rec, onPatch, onReadLink, readingUrl, readCountByUrl }: Props) {
  const [open, setOpen] = useState<LinkKey | null>(null);
  const generate = (platform: IrissAuctionSearchPlatform | "mobile") => {
    if (platform === "mobile") {
      const url = buildMobileDeOrderSearchUrl(marketplaceQueryFromOrder(rec));
      const existing = rec.listingLinkMobile.filter((u) => u.trim());
      if (existing.includes(url)) return;
      onPatch({ listingLinkMobile: [...existing, url] });
      return;
    }
    const next = applyGeneratedPlatformSearchLink(rec, platform);
    if (!next.url) return;
    onPatch({
      listingLinkAuto1: next.record.listingLinkAuto1,
      listingLinkOpenline: next.record.listingLinkOpenline,
      listingLinkAutobid: next.record.listingLinkAutobid,
      listingLinkEcarstrade: next.record.listingLinkEcarstrade,
      ...(platform === "ecarstrade" ? { ecarstradeLinksManual: true } : {}),
    });
  };
  return (
    <div className="iriss-filter-links">
      {SOURCE_ROWS.map((row) => {
        const links = coerceIrissListingLinkList(rec[row.key]).filter((u) => u.trim());
        const isOpen = open === row.key;
        if (row.key === "listingLinksOther" && links.length === 0 && !isOpen) return null;
        const first = links[0] ?? "";
        return (
          <div key={row.key} className="iriss-filter-links-row">
            <div className="iriss-filter-links-head">
              <span className="iriss-filter-links-src">{row.label}</span>
              {first ? (
                <a className="iriss-filter-links-url" href={first} target="_blank" rel="noopener noreferrer" title={first}>
                  {first.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              ) : (
                <span className="iriss-filter-links-url is-empty">nav saites</span>
              )}
              <button
                type="button"
                className="iriss-filter-links-count"
                aria-expanded={isOpen}
                aria-label={`${row.label}: ${links.length} ${linkWord(links.length)} - rādīt un labot`}
                onClick={() => setOpen(isOpen ? null : row.key)}
              >
                {links.length > 0 ? `${links.length} ${linkWord(links.length)}` : "0"} {isOpen ? "▴" : "▾"}
              </button>
              {row.platform ? (
                <button
                  type="button"
                  className={actionBtn}
                  aria-label={`${row.label}: izveidot filtru`}
                  onClick={() => generate(row.platform!)}
                  title="Pievieno jaunu saiti no filtriem; esošās netiek mainītas"
                >
                  + Izveidot
                </button>
              ) : null}
            </div>
            {isOpen ? (
              <div className="mt-2">
                <SourceLinkList
                  label={row.label}
                  logoKey={row.logoKey}
                  links={rec[row.key]}
                  onChange={(next) => onPatch({ [row.key]: next })}
                  onReadLink={onReadLink}
                  readingUrl={readingUrl}
                  readCountByUrl={readCountByUrl}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
