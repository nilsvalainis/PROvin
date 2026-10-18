"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatB2bWalletEuro } from "@/lib/b2b-wallet";
import type { OneautoKvRow, OneautoServiceEvent } from "@/lib/oneauto-catalog";

type RawResponse = {
  orderId: string;
  vin: string;
  status: "pending" | "running" | "done" | "no_data" | "failed";
  refunded: boolean;
  refundCents: number;
  serviceTimeline: OneautoServiceEvent[];
  vehicle: OneautoKvRow[];
  fetchedAt?: string | null;
};

const POLL_MS = 4000;
const POLL_MAX = 60;
const TH = "pb-2 pr-4 text-left text-[0.52rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

export function B2bPartnerRawData({ orderId }: { orderId: string }) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [data, setData] = useState<RawResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/partner/wallet/raw/${encodeURIComponent(orderId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/partneriem");
          return;
        }
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const next = (await res.json()) as RawResponse;
        if (cancelled) return;
        setData(next);
        if (next.status === "done" || next.status === "no_data") return;
      } catch {
        /* nākamais mēģinājums */
      }
      attempts += 1;
      if (attempts < POLL_MAX && !cancelled) timer = window.setTimeout(() => void load(), POLL_MS);
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId, router]);

  const back = (
    <Link
      href="/partneriem/konts"
      className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#93c5fd] underline-offset-2 hover:underline"
    >
      {t("rawBack")}
    </Link>
  );

  if (notFound) {
    return (
      <section className="flex flex-col gap-5">
        <h1 className="text-lg font-bold text-zinc-100">{t("rawTitle")}</h1>
        <p className="text-[0.875rem] text-zinc-400">{t("rawNotFound")}</p>
        {back}
      </section>
    );
  }

  const status = data?.status ?? "pending";
  return (
    <section aria-labelledby="b2b-raw-title" className="flex flex-col gap-6">
      <div>
        <h1 id="b2b-raw-title" className="text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl">
          {t("rawTitle")}
        </h1>
        {data?.vin ? (
          <p className="mt-1 font-mono text-[0.85rem] tracking-wide text-zinc-400">{t("rawVin", { vin: data.vin })}</p>
        ) : null}
        <div className="mt-2.5 h-px w-full bg-white/10" aria-hidden />
      </div>

      {status === "pending" || status === "running" ? (
        <p className="text-[0.875rem] text-zinc-300" role="status">
          {t("rawPending")}
        </p>
      ) : null}
      {status === "failed" ? <p className="text-[0.875rem] text-amber-200">{t("rawFailed")}</p> : null}
      {status === "no_data" ? (
        <p className="text-[0.875rem] font-medium text-emerald-300" role="status">
          {t("rawNoData", { amount: formatB2bWalletEuro(data?.refundCents ?? 0) })}
        </p>
      ) : null}

      {status === "done" && data ? (
        <>
          <p className="text-[0.75rem] text-zinc-500">{t("rawOriginalNote")}</p>
          {data.vehicle.length > 0 ? (
            <div>
              <h2 className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
                {t("rawVehicleHeading")}
              </h2>
              <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {data.vehicle.map((row, i) => (
                  <div key={`${row.label}-${i}`} className="flex justify-between gap-4 border-b border-white/[0.07] py-2 text-[0.8rem]">
                    <dt className="text-zinc-500">{row.label}</dt>
                    <dd className="text-right text-zinc-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div>
            <h2 className="mb-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#93c5fd]">
              {t("rawServiceHeading")}
            </h2>
            {data.serviceTimeline.length === 0 ? (
              <p className="text-[0.85rem] text-zinc-400">{t("rawEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-[0.8rem]">
                  <thead>
                    <tr>
                      <th className={TH}>{t("rawDate")}</th>
                      <th className={TH}>{t("rawOdometer")}</th>
                      <th className={TH}>{t("rawPlace")}</th>
                      <th className={TH}>{t("rawWorks")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.serviceTimeline.map((row, i) => (
                      <tr key={`${row.date}-${i}`} className="border-t border-white/[0.07] align-top">
                        <td className="whitespace-nowrap py-2.5 pr-4 text-zinc-300">{row.date}</td>
                        <td className="whitespace-nowrap py-2.5 pr-4 tabular-nums text-zinc-100">{row.odometer}</td>
                        <td className="py-2.5 pr-4 text-zinc-300">{row.place}</td>
                        <td className="whitespace-pre-line py-2.5 text-zinc-200">{row.works}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
      {back}
    </section>
  );
}
