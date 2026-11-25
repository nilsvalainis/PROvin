"use client";

/**
 * Datora apakšējā PDF josla: viena poga «Citi PDF ▾» ar visiem papildu PDF veidiem.
 * Katram veidam saglabātas tā paša apakšopcijas (valodas LV/EN/RU/DE vai «ar/bez cenām»).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { PdfExtraLang, PdfLockLang } from "@/components/admin/AdminPdfLangSplitButton";

type EntryBase = {
  id: string;
  label: string;
  title?: string;
  /** Piem. «42%» vai «Gatavo…» - rāda rindā un uz pogas. */
  busyLabel?: string | null;
  disabled?: boolean;
  /** Atdalītājs virs rindas. */
  separatorBefore?: boolean;
};

export type OtherPdfEntry =
  | (EntryBase & { kind: "lang"; onPrimary: () => void; onLang: (lang: PdfExtraLang) => void })
  | (EntryBase & {
      kind: "choices";
      choices: readonly { id: string; short: string; title?: string; onSelect: () => void }[];
    })
  | (EntryBase & { kind: "action"; onSelect: () => void });

export type OtherPdfMenuItem = {
  key: string;
  entryId: string;
  short: string;
  ariaLabel: string;
  title?: string;
  disabled: boolean;
  run: () => void;
};

const ROW_LABEL = "whitespace-nowrap text-[12px] font-medium text-slate-800";

const LANG_CHIPS: { lang: PdfLockLang; short: string; title: string }[] = [
  { lang: "lv", short: "LV", title: "Latviešu" },
  { lang: "en", short: "EN", title: "Angļu" },
  { lang: "ru", short: "RU", title: "Krievu" },
  { lang: "de", short: "DE", title: "Vācu" },
];

/** Visas izvēlnes darbības plakanā sarakstā (renderēšanai un testiem). */
export function otherPdfMenuItems(
  entries: readonly OtherPdfEntry[],
  lockLang: PdfLockLang | null = null,
): OtherPdfMenuItem[] {
  const out: OtherPdfMenuItem[] = [];
  for (const entry of entries) {
    const off = Boolean(entry.disabled);
    if (entry.kind === "lang") {
      for (const chip of LANG_CHIPS) {
        const locked = Boolean(lockLang) && chip.lang !== lockLang;
        out.push({
          key: `${entry.id}:${chip.lang}`,
          entryId: entry.id,
          short: chip.short,
          ariaLabel: `${entry.label} ${chip.short}`,
          title: chip.title,
          disabled: off || locked,
          run: chip.lang === "lv" ? entry.onPrimary : () => entry.onLang(chip.lang as PdfExtraLang),
        });
      }
    } else if (entry.kind === "choices") {
      for (const choice of entry.choices) {
        out.push({
          key: `${entry.id}:${choice.id}`,
          entryId: entry.id,
          short: choice.short,
          ariaLabel: `${entry.label}: ${choice.short}`,
          title: choice.title,
          disabled: off,
          run: choice.onSelect,
        });
      }
    } else {
      out.push({
        key: entry.id,
        entryId: entry.id,
        short: entry.label,
        ariaLabel: entry.label,
        title: entry.title,
        disabled: off,
        run: entry.onSelect,
      });
    }
  }
  return out;
}

export function AdminOtherPdfMenu({
  label = "Citi PDF",
  entries,
  toneClass,
  lockLang = null,
  onUnlockLang,
  defaultOpen = false,
}: {
  label?: string;
  entries: readonly OtherPdfEntry[];
  /** Krāsa un apmale (tā pati, kas pārējām pelēkajām pogām). */
  toneClass: string;
  lockLang?: PdfLockLang | null;
  onUnlockLang?: () => void;
  /** Tikai testiem / vizuālai pārbaudei. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const items = otherPdfMenuItems(entries, lockLang);
  const busy = entries.find((e) => e.busyLabel)?.busyLabel ?? null;

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "Tab"].includes(event.key)) return;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const nodes = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    if (nodes.length === 0) return;
    event.preventDefault();
    const at = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? nodes.length - 1
          : event.key === "ArrowDown" || event.key === "ArrowRight"
            ? (at + 1) % nodes.length
            : (at - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  const pick = (item: OtherPdfMenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.run();
  };

  const chipClass =
    "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0" data-other-pdf-menu>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3 text-[11px] font-semibold tracking-tight transition ${toneClass}`}
      >
        {busy ?? label}
        <ChevronDown className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute bottom-full right-0 z-50 mb-1.5 w-[19.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-800 shadow-lg"
        >
          {entries.map((entry) => {
            const rowItems = items.filter((i) => i.entryId === entry.id);
            const sep = entry.separatorBefore ? <div role="separator" className="my-1 h-px bg-slate-100" /> : null;
            if (entry.kind === "action") {
              const item = rowItems[0]!;
              return (
                <div key={entry.id}>
                  {sep}
                  <button
                    type="button"
                    role="menuitem"
                    title={entry.title}
                    disabled={item.disabled}
                    onClick={() => pick(item)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className={ROW_LABEL}>{entry.label}</span>
                    {entry.busyLabel ? <span className="text-[10px] font-medium text-slate-500">{entry.busyLabel}</span> : null}
                  </button>
                </div>
              );
            }
            return (
              <div key={entry.id}>
                {sep}
                <div
                  role="group"
                  aria-label={entry.label}
                  className="flex items-center justify-between gap-3 px-3 py-1"
                >
                  <span className={ROW_LABEL} title={entry.title}>
                    {entry.label}
                    {entry.busyLabel ? (
                      <span className="ml-1.5 text-[10px] font-medium text-slate-500">{entry.busyLabel}</span>
                    ) : null}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {rowItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        aria-label={item.ariaLabel}
                        title={item.title}
                        disabled={item.disabled}
                        onClick={() => pick(item)}
                        className={chipClass}
                      >
                        {item.short}
                      </button>
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
          {lockLang && onUnlockLang ? (
            <>
              <div role="separator" className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onUnlockLang();
                }}
                className="flex w-full items-center px-3 py-1.5 text-left text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 focus:bg-slate-50 focus:outline-none"
              >
                Mainīt valodu
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type OrderPdfPrintOpts = {
  printInk?: boolean;
  dealerOnly?: boolean;
  asvOnly?: boolean;
  businessBrand?: boolean;
  lang?: PdfExtraLang;
};

/**
 * Pasūtījuma darba vietas «Citi PDF» saturs - tās pašas darbības, kas agrāk bija atsevišķas pogas joslā.
 */
export function orderOtherPdfEntries({
  pdfBusy,
  familyBusy,
  inkBusy,
  archiveBusy,
  openPrintReport,
  openAuctionArchivePdf,
  openOemDealerReport,
}: {
  /** Kāds PDF jau tiek gatavots (pdfJob !== null). */
  pdfBusy: boolean;
  familyBusy: (prefix: "business" | "dealer" | "asv") => string | null;
  inkBusy: string | null;
  archiveBusy: boolean;
  openPrintReport: (opts: OrderPdfPrintOpts) => void;
  openAuctionArchivePdf: (showPrices: boolean) => void;
  openOemDealerReport: () => void;
}): OtherPdfEntry[] {
  return [
    {
      kind: "lang",
      id: "business",
      label: "Business PDF",
      title: "Tā pati atskaite ar virsrakstu Business Datu atskaite.",
      busyLabel: familyBusy("business"),
      disabled: pdfBusy,
      onPrimary: () => openPrintReport({ businessBrand: true }),
      onLang: (lang) => openPrintReport({ businessBrand: true, lang }),
    },
    {
      kind: "lang",
      id: "dealer",
      label: "Dīlera PDF",
      title: "Tikai OFICIĀLĀ DĪLERA DATI. Citi avoti netiek iekļauti.",
      busyLabel: familyBusy("dealer"),
      disabled: pdfBusy,
      onPrimary: () => openPrintReport({ dealerOnly: true }),
      onLang: (lang) => openPrintReport({ dealerOnly: true, lang }),
    },
    {
      kind: "choices",
      id: "auction-archive",
      label: "Izsoļu arhīva PDF",
      title: "Tikai IZSOĻU ARHĪVS (bildes, nobraukums, bojājumi).",
      busyLabel: archiveBusy ? "Gatavo…" : null,
      disabled: archiveBusy,
      choices: [
        { id: "plain", short: "Bez cenām", onSelect: () => openAuctionArchivePdf(false) },
        { id: "prices", short: "Ar cenām", title: "Ar izsoļu cenām", onSelect: () => openAuctionArchivePdf(true) },
      ],
    },
    {
      kind: "lang",
      id: "asv",
      label: "ASV PDF",
      title: "Tikai ASV vēsture. Citi avoti netiek iekļauti.",
      busyLabel: familyBusy("asv"),
      disabled: pdfBusy,
      onPrimary: () => openPrintReport({ asvOnly: true }),
      onLang: (lang) => openPrintReport({ asvOnly: true, lang }),
    },
    {
      kind: "action",
      id: "oem",
      label: "OEM dīlera PDF",
      title: "Oficiāla OEM izdruka (portrets A4): markas logo, oriģinālie API dati bez tulkojuma. Atsevišķs no PROVIN dīlera atskaites.",
      onSelect: openOemDealerReport,
    },
    {
      kind: "action",
      id: "print-ink",
      label: "Drukājamā versija",
      title: "Tā pati atskaite ar tumšāku tekstu un kontūrām papīra drukai",
      busyLabel: inkBusy,
      disabled: pdfBusy,
      separatorBefore: true,
      onSelect: () => openPrintReport({ printInk: true }),
    },
  ];
}
