"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import { vinScanResultCards, type VinScanResultRow } from "@/lib/vin-scan/result-fields";

function Cell({ children }: { children: ReactNode }) {
  return <span className="min-w-0 truncate text-[11px] text-[var(--color-apple-text)]">{children}</span>;
}

function Kv({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-[11px] leading-snug">
      <span className="text-[var(--color-provin-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--color-apple-text)]">{value}</span>
    </div>
  );
}

export function AdminVinScanResultCards({ rows }: { rows: readonly VinScanResultRow[] }) {
  const cards = vinScanResultCards(rows);
  if (cards.length === 0) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 px-2 pb-20 sm:grid-cols-2 sm:pb-2">
      {cards.map((card) => (
        <li
          key={card.id}
          className="rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2.5 py-2"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold text-[var(--color-apple-text)]">{card.label}</p>
            {card.href ? (
              <a
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={card.label}
                className="inline-flex shrink-0 text-[var(--color-provin-accent)]"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
          <div className="space-y-0.5">
            {card.finlandLink ? (
              <>
                <Kv label="Saistīts ar Somiju" value={card.finlandLink.linked} />
                <Kv label="Avots" value={card.finlandLink.source} />
              </>
            ) : null}
            <Kv label="Marka" value={card.vehicle?.make ?? ""} />
            <Kv label="Modelis" value={card.vehicle?.model ?? ""} />
            <Kv label="Gads" value={card.vehicle?.year ?? ""} />
            <Kv label="Valsts" value={card.origin} />
          </div>
          {card.inspections.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {card.inspections.map((row, i) => (
                <li key={`${row.date}-${i}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-x-2">
                  <Cell>{row.date}</Cell>
                  <Cell>{row.result ?? ""}</Cell>
                  <Cell>{row.odometer ?? ""}</Cell>
                </li>
              ))}
            </ul>
          ) : card.listings.length === 0 && card.mileage.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {card.mileage.map((row, i) => (
                <li key={`${row.date}-${i}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                  <Cell>{row.date}</Cell>
                  <Cell>{row.odometer}</Cell>
                </li>
              ))}
            </ul>
          ) : null}
          {card.incidents.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {card.incidents.map((row, i) => (
                <li key={`${row.date}-${i}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                  <Cell>{row.date ?? ""}</Cell>
                  <Cell>{row.summary}</Cell>
                </li>
              ))}
            </ul>
          ) : null}
          {card.recalls.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {card.recalls.map((row, i) => (
                <li key={`${row.title}-${i}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
                  <span className="text-[11px] text-[var(--color-provin-muted)]">Atsaukums</span>
                  <Cell>{[row.title, row.date].filter(Boolean).join(" · ")}</Cell>
                </li>
              ))}
            </ul>
          ) : null}
          {card.auctions.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {card.auctions.map((row, i) => (
                <li key={`${row.title}-${i}`} className="space-y-0.5">
                  <Kv label="Izsole" value={row.title ?? ""} />
                  <Kv label="Datums" value={row.date ?? ""} />
                  <Kv label="Cena" value={row.price ?? ""} />
                  <Kv label="Vieta" value={row.venue ?? ""} />
                  <Kv label="Foto" value={row.photoCount ? String(row.photoCount) : ""} />
                  {row.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.photoUrl} alt="" className="mt-1 h-16 w-24 rounded object-cover" />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {card.listings.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {card.listings.map((row, i) => (
                <li key={`${row.date}-${i}`} className="grid grid-cols-[5.5rem_auto_minmax(0,1fr)] gap-x-2">
                  <Cell>{row.date}</Cell>
                  <Cell>{row.price ?? ""}</Cell>
                  <Cell>{row.odometer ?? ""}</Cell>
                </li>
              ))}
            </ul>
          ) : null}
          {card.photoUrl && card.auctions.every((row) => row.photoUrl !== card.photoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.photoUrl} alt="" className="mt-1.5 h-16 w-24 rounded object-cover" />
          ) : null}
          {!card.auctions.length && card.photoCount > 0 ? (
            <div className="mt-1">
              <Kv label="Foto" value={String(card.photoCount)} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
