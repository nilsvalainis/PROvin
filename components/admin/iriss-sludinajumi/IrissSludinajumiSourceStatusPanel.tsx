"use client";

import { RefreshCw } from "lucide-react";
import { IrissListingsLoginButton } from "@/components/admin/IrissListingsLoginPanel";
import type { IrissListingPlatformIngestStat } from "@/lib/iriss-listings-ingest-stats";
import {
  LISTING_PLATFORM_LABEL,
  listingConnectionStatusLabel,
  listingIngestRowStatus,
  listingSourceRunStatusLabel,
  listingSourceStatusProse,
  listingSyncProgressLabel,
  listingVatNeedsCheck,
} from "@/lib/iriss-listings-panel";
import { IRISS_AUCTION_LISTING_PLATFORMS, IRISS_RELAY_LISTING_PLATFORMS } from "@/lib/iriss-listings-types";
import type { IrissListingSourceRun, IrissPlatformHealthReport } from "@/lib/iriss-listings-types";
import type { ListingVatHealthMap } from "@/lib/iriss-listings-vat";

const STROKE = 1.6;

export function IrissSludinajumiSourceStatusBody({
  finishedAtLabel,
  ingest,
  vehicleCount,
  freshCount,
  priceCount,
  okSources,
  totalSources,
  vatHealth,
  health,
  problemSources,
  problemsOpen,
  onToggleProblems,
  syncBusy,
  syncMsg,
  onSync,
  onHealthDone,
}: {
  finishedAtLabel: string;
  ingest: readonly IrissListingPlatformIngestStat[];
  vehicleCount: number;
  freshCount: number;
  priceCount: number;
  okSources: number;
  totalSources: number;
  vatHealth: ListingVatHealthMap;
  health: IrissPlatformHealthReport | null;
  problemSources: readonly IrissListingSourceRun[];
  problemsOpen: boolean;
  onToggleProblems: () => void;
  syncBusy: boolean;
  syncMsg: string | null;
  onSync: () => void;
  onHealthDone: () => void;
}) {
  const prose = listingSourceStatusProse({
    ingest,
    vehicleCount,
    freshCount,
    priceCount,
    okSources,
    totalSources,
  });
  const progress = listingSyncProgressLabel(syncBusy, syncMsg);
  const healthItems =
    health?.items ??
    IRISS_AUCTION_LISTING_PLATFORMS.map((platform) => ({
      platform,
      status: "not_run" as const,
      note: "",
      checkedAt: "",
    }));
  const problemOkLabel = problemSources.length > 0 ? `${problemSources.length} saites nebija OK` : "0 saites nebija OK";

  return (
    <div className="text-[14px] text-[var(--slud-ink,#0b0c10)]">
      <p className="text-[12.5px] leading-5 text-[var(--slud-ink2,#5e636e)]">
        Diagnostika{finishedAtLabel ? ` · ${finishedAtLabel}` : ""} · auto 9:00, 13:00, 17:00
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSync}
          disabled={syncBusy}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--slud-fill)] px-3 text-[13px] font-medium disabled:opacity-55"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin" : ""}`} strokeWidth={STROKE} />
          Nolasīt tagad
          {progress ? <span className="tabular-nums text-[var(--slud-ink2)]">{progress}</span> : null}
        </button>
      </div>
      <p className="mt-3 text-[14px] leading-6">{prose}</p>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3)]">Nolasīšana pa avotiem</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="text-[12px] text-[var(--slud-ink3)]">
              <th className="py-1.5 font-medium">Avots</th>
              <th className="py-1.5 font-medium">Statuss</th>
              <th className="py-1.5 text-right font-medium">Saites OK</th>
              <th className="py-1.5 text-right font-medium">Auto</th>
            </tr>
          </thead>
          <tbody>
            {ingest.map((s) => {
              const row = listingIngestRowStatus(s);
              return (
                <tr key={s.platform} className="border-t border-[var(--slud-hair)]">
                  <td className="py-2">{LISTING_PLATFORM_LABEL[s.platform]}</td>
                  <td className="py-2">
                    {row.label.startsWith("Daļēji") ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--slud-warn)]" aria-hidden />
                        {row.label}
                      </span>
                    ) : (
                      row.label
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.okText}</td>
                  <td className="py-2 text-right tabular-nums">{row.autoText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3)]">PVN režīms pa avotiem</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="text-[12px] text-[var(--slud-ink3)]">
              <th className="py-1.5 font-medium">Avots</th>
              <th className="py-1.5 text-right font-medium">Margin</th>
              <th className="py-1.5 text-right font-medium">Ar ārvalstu PVN</th>
              <th className="py-1.5 text-right font-medium">Bez PVN</th>
              <th className="py-1.5 text-right font-medium">Jāpārbauda</th>
            </tr>
          </thead>
          <tbody>
            {IRISS_AUCTION_LISTING_PLATFORMS.map((platform) => {
              const h = vatHealth[platform];
              return (
                <tr key={platform} className="border-t border-[var(--slud-hair)]">
                  <td className="py-2">{LISTING_PLATFORM_LABEL[platform]}</td>
                  <td className="py-2 text-right tabular-nums">{h.margin}</td>
                  <td className="py-2 text-right tabular-nums">{h.gross || "-"}</td>
                  <td className="py-2 text-right tabular-nums">{h.net || "-"}</td>
                  <td className="py-2 text-right tabular-nums">{listingVatNeedsCheck(h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[var(--slud-ink2)]">
        Jāpārbauda = trūkst vai novecojuši dati, nav likmes, pretrunas.
      </p>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--slud-ink3)]">Pieslēgumi</p>
      <div className="mt-1">
        {healthItems.map((item) => (
          <div key={item.platform} className="flex min-h-11 items-center justify-between gap-2 border-t border-[var(--slud-hair)]">
            <span className="min-w-0">
              <span className="font-medium">{LISTING_PLATFORM_LABEL[item.platform]}</span>
              {IRISS_RELAY_LISTING_PLATFORMS.includes(item.platform) ? (
                <span className="ml-2 text-[13px] text-[var(--slud-ink2)]">{listingConnectionStatusLabel(item.status)}</span>
              ) : null}
            </span>
            {IRISS_RELAY_LISTING_PLATFORMS.includes(item.platform) ? (
              <IrissListingsLoginButton platform={item.platform} onDone={onHealthDone} />
            ) : (
              <span className="text-[12.5px] text-[var(--slud-ink2)]">Pieslēgts servera iestatījumos</span>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleProblems}
        className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-[var(--slud-fill)] px-3 text-left"
        aria-expanded={problemsOpen}
      >
        <span className="inline-flex items-center gap-2">
          {problemSources.length > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--slud-warn)]" aria-hidden /> : null}
          <span className="font-medium">Avotu problēmas</span>
          <span className="text-[13px] text-[var(--slud-ink2)]">{problemOkLabel}</span>
        </span>
        <span className="text-[var(--slud-ink3)]">{problemsOpen ? "▴" : "▾"}</span>
      </button>
      {problemsOpen && problemSources.length > 0 ? (
        <ul className="mt-2 space-y-2 text-[13px]">
          {problemSources.map((src) => (
            <li key={src.id} className="rounded-xl bg-[var(--slud-s2)] px-3 py-2">
              <div className="font-medium">
                {LISTING_PLATFORM_LABEL[src.platform]} · {src.orderBrandModel || src.orderId}
              </div>
              <div className="text-[var(--slud-ink2)]">{listingSourceRunStatusLabel(src.status)}</div>
              {src.note ? <div className="text-[var(--slud-ink2)]">{src.note}</div> : null}
              {src.sourceUrl ? (
                <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--slud-ink)] underline">
                  saite
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
