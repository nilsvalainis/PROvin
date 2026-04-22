"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { IrissListingAggregateItem, IrissListingsLatestView } from "@/lib/iriss-listings-types";

const SOURCE_LABELS: Record<IrissListingAggregateItem["sourcePlatform"], string> = {
  mobile: "MOBILE",
  autobid: "AUTOBID",
  openline: "OPENLINE",
  auto1: "AUTO1",
  other: "CITI",
};

function sourceBadgeClass(platform: IrissListingAggregateItem["sourcePlatform"]): string {
  if (platform === "mobile") return "bg-blue-50 text-blue-800 border-blue-200/80";
  if (platform === "autobid") return "bg-violet-50 text-violet-800 border-violet-200/80";
  if (platform === "openline") return "bg-indigo-50 text-indigo-800 border-indigo-200/80";
  if (platform === "auto1") return "bg-amber-50 text-amber-800 border-amber-200/80";
  return "bg-slate-50 text-slate-700 border-slate-200/90";
}

function statusLabel(item: IrissListingAggregateItem): string {
  if (item.status === "ok") return "OK";
  if (item.status === "login_required") return "Login vajadzīgs";
  if (item.status === "parse_failed") return "Parse kļūda";
  return "Nolasīšana neizdevās";
}

function statusClass(item: IrissListingAggregateItem): string {
  if (item.status === "ok") return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
  if (item.status === "login_required") return "bg-amber-50 text-amber-900 border-amber-200/80";
  return "bg-red-50 text-red-900 border-red-200/80";
}

function priceText(item: IrissListingAggregateItem): string {
  const p1 = item.pricePrimary ? `${item.pricePrimary.value} ${item.pricePrimary.currency}` : "";
  const p2 = item.priceSecondary ? `${item.priceSecondary.value} ${item.priceSecondary.currency}` : "";
  if (p1 && p2) return `${p1} | ${p2}`;
  if (p1) return p1;
  if (p2) return p2;
  return "—";
}

type Props = {
  latest: IrissListingsLatestView | null;
};

export function IrissSludinajumiListClient({ latest }: Props) {
  const router = useRouter();
  const [hiddenImages, setHiddenImages] = useState<Record<string, true>>({});
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...(latest?.items ?? [])].sort((a, b) => (a.aggregatedAt < b.aggregatedAt ? 1 : a.aggregatedAt > b.aggregatedAt ? -1 : 0)),
    [latest?.items],
  );

  async function syncNow() {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-listings/sync-now", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        summary?: { totalSources?: number; okCount?: number };
      };
      if (!res.ok) {
        setSyncMsg(body.error ? `Nolasīšana neizdevās: ${body.error}` : "Nolasīšana neizdevās.");
        return;
      }
      setSyncMsg(`Nolasīšana pabeigta. Avoti: ${body.summary?.totalSources ?? 0}, OK: ${body.summary?.okCount ?? 0}.`);
      router.refresh();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message.slice(0, 220) : "Tīkla kļūda.");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <section className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-provin-muted)] sm:text-[13px]">
            <span>
              Pēdējā sinhronizācija:{" "}
              <span className="font-semibold text-[var(--color-apple-text)]">{latest?.summary.finishedAt ?? "nav veikta"}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>Kopā avoti: {latest?.summary.totalSources ?? 0}</span>
            <span className="text-slate-300">•</span>
            <span>OK: {latest?.summary.okCount ?? 0}</span>
            <span className="text-slate-300">•</span>
            <span>Login: {latest?.summary.loginRequiredCount ?? 0}</span>
          </div>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncBusy}
            className="inline-flex min-h-10 items-center rounded-full border border-[var(--color-provin-accent)] bg-white px-3.5 text-[12px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-[var(--color-provin-accent)]/8 disabled:opacity-55"
          >
            {syncBusy ? "Nolasa..." : "Nolasīt tagad"}
          </button>
        </div>
        {syncMsg ? <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">{syncMsg}</p> : null}
      </section>

      {sorted.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-black">Nav nolasītu sludinājumu ierakstu</p>
          <p className="mt-1.5 text-[12px] text-[var(--color-provin-muted)]">
            Spied “Nolasīt tagad”, lai ievāktu datus uzreiz, vai sagaidi ikdienas cron sinhronizāciju.
          </p>
        </section>
      ) : null}

      <div className="space-y-2.5">
        {sorted.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm transition hover:border-slate-300 sm:p-4"
          >
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <div className="shrink-0">
                {item.imageUrl && !hiddenImages[item.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title || item.orderBrandModel || "Sludinājuma foto"}
                    loading="lazy"
                    className="h-16 w-24 rounded-lg border border-slate-200/90 bg-slate-50 object-cover"
                    onError={() => setHiddenImages((prev) => ({ ...prev, [item.id]: true }))}
                  />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Nav foto
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex min-w-0 flex-wrap items-start gap-2">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--color-apple-text)] sm:text-[15px]">
                    {item.title || item.orderBrandModel || "—"}
                  </p>
                  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sourceBadgeClass(item.sourcePlatform)}`}>
                    {SOURCE_LABELS[item.sourcePlatform]}
                  </span>
                  <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(item)}`}>
                    {statusLabel(item)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--color-provin-muted)]">
                  <span>
                    <span className="font-medium text-[var(--color-apple-text)]">Gads:</span> {item.year || "—"}
                  </span>
                  <span>
                    <span className="font-medium text-[var(--color-apple-text)]">Cena:</span> {priceText(item)}
                  </span>
                  <span>
                    <span className="font-medium text-[var(--color-apple-text)]">Avots:</span> {item.sourceDomain || "—"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[12px]">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-[var(--color-apple-text)] hover:bg-slate-100"
                  >
                    Atvērt sludinājumu
                  </a>
                  <Link
                    href={`/admin/iriss/pasutijumi/${encodeURIComponent(item.orderId)}`}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-[var(--color-provin-accent)] hover:bg-slate-50"
                  >
                    Atvērt pasūtījumu
                  </Link>
                  <span className="text-[11px] text-slate-500">{item.aggregatedAt}</span>
                </div>

                {item.statusNote ? <p className="text-[11px] text-slate-500">{item.statusNote}</p> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
