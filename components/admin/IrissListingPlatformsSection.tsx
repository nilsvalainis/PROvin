"use client";

import { useCallback, useMemo } from "react";
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
import { listingLinkRunForUrl } from "@/lib/iriss-listings-url";
import { detectIrissListingPlatform } from "@/lib/iriss-listings-platform";
import type { IrissListingSourceRun } from "@/lib/iriss-listings-types";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const inp =
  "min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const inpInvalid =
  "min-h-[40px] w-full rounded-lg border border-red-400 bg-white px-2 py-1.5 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 sm:text-[15px]";

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
          {c.letter}
        </a>
      ))}
      <button
        type="button"
        onClick={openAll}
        title="Atvērt visas saites"
        aria-label="Atvērt visas saites"
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
  "listingLinkMobile" | "listingLinkAutobid" | "listingLinkOpenline" | "listingLinkAuto1" | "listingLinksOther"
>;

function fmtLinkReadAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso || "";
  return new Intl.DateTimeFormat("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Riga",
  }).format(new Date(t));
}

function listingLinkStatusLine(run: IrissListingSourceRun | null): string {
  if (!run) return "Vēl nav nolasīts";
  const when = run.fetchedAt ? fmtLinkReadAt(run.fetchedAt) : "";
  if (run.status === "skipped") return [when, "Gaida nākamo nolasīšanu"].filter(Boolean).join(" · ");
  if (run.status !== "ok") {
    const err =
      run.status === "login_required"
        ? "Jāielogojas"
        : run.status === "blocked_by_waf"
          ? "Bloķēts"
          : run.status === "relay_not_configured"
            ? "Relejs nav pieslēgts"
            : run.status === "parse_failed"
              ? "Parse kļūda"
              : "Nolasīšana neizdevās";
    return [when, err, run.note].filter(Boolean).join(" · ");
  }
  const count = `${run.vehicleCount} ${run.vehicleCount === 1 ? "sludinājums" : "sludinājumi"}`;
  const extra = run.complete === false ? "nolasījums nepilnīgs" : "";
  return [when, count, extra].filter(Boolean).join(" · ");
}

function SourceLinkList({
  label,
  links,
  onChange,
  statusFor,
}: {
  label: string;
  links: readonly string[];
  onChange: (next: string[]) => void;
  statusFor?: (url: string) => IrissListingSourceRun | null;
}) {
  const rows = coerceIrissListingLinkList(links);
  const canAdd = rows.length < IRISS_LISTING_LINKS_PER_SOURCE_MAX;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={lbl}>{label}</span>
        <button
          type="button"
          onClick={() => onChange(addIrissListingLinkRow(rows))}
          disabled={!canAdd}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-35"
          title="Pievienot vēl vienu saites lauku"
        >
          + Pievienot saiti
        </button>
      </div>
      {rows.map((line, idx) => {
        const err = irissListingLinkUrlError(line);
        return (
          <div key={idx} className="space-y-0.5">
            <div className="flex min-w-0 items-start gap-1.5">
              <input
                className={`${err ? inpInvalid : inp} min-w-0 flex-1`}
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://…"
                value={line}
                onChange={(e) => onChange(setIrissListingLinkRow(rows, idx, e.target.value))}
                aria-label={`${label} — saite ${idx + 1}`}
                aria-invalid={Boolean(err)}
              />
              <button
                type="button"
                onClick={() => onChange(removeIrissListingLinkRow(rows, idx))}
                disabled={rows.length <= 1 && !line.trim()}
                className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-[16px] leading-none text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-35"
                title="Noņemt saiti"
                aria-label="Noņemt saiti"
              >
                ×
              </button>
            </div>
            {err ? <p className="px-0.5 text-[11px] text-red-600">{err}</p> : null}
            {statusFor && line.trim() && detectIrissListingPlatform(line) ? (
              <p className="px-0.5 text-[11px] text-[var(--color-provin-muted)]">{listingLinkStatusLine(statusFor(line))}</p>
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
  sourceRuns?: IrissListingSourceRun[];
};

export function IrissListingPlatformsFields({ rec, onPatch, sourceRuns = [] }: Props) {
  const patchLinks = (key: LinkKey, next: string[]) => {
    onPatch({ [key]: next });
  };
  const statusFor = (url: string) => listingLinkRunForUrl(sourceRuns, rec.id, url);

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
        Sludinājumu platformas (saites)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SourceLinkList
          label="Mobile"
          links={rec.listingLinkMobile}
          onChange={(next) => patchLinks("listingLinkMobile", next)}
        />
        <SourceLinkList
          label="Autobid"
          links={rec.listingLinkAutobid}
          onChange={(next) => patchLinks("listingLinkAutobid", next)}
          statusFor={statusFor}
        />
        <SourceLinkList
          label="Openline"
          links={rec.listingLinkOpenline}
          onChange={(next) => patchLinks("listingLinkOpenline", next)}
          statusFor={statusFor}
        />
        <SourceLinkList
          label="Auto1"
          links={rec.listingLinkAuto1}
          onChange={(next) => patchLinks("listingLinkAuto1", next)}
          statusFor={statusFor}
        />
      </div>
      <div className="mt-3">
        <SourceLinkList
          label="Citi"
          links={rec.listingLinksOther}
          onChange={(next) => patchLinks("listingLinksOther", next)}
          statusFor={statusFor}
        />
      </div>
    </div>
  );
}
