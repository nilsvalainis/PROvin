import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminAdsAttributionCard } from "@/components/admin/AdminAdsAttributionCard";
import { AdminHeardAboutCard } from "@/components/admin/AdminHeardAboutCard";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";
import { AdminVinChecksCard } from "@/components/admin/AdminVinChecksCard";
import { emptyAdVisitDoc } from "@/lib/admin-ad-visits";
import { readAdSpendRows } from "@/lib/admin-ad-spend-store";
import { readAdVisitDoc } from "@/lib/admin-ad-visit-store";
import {
  getAnalyticsDashboardUrl,
  getAnalyticsEmbedUrl,
  getGaMeasurementId,
  isVercelDeployment,
} from "@/lib/analytics-public";
import type { AdsAttributionOrder } from "@/lib/admin-ad-attribution-stats";
import type { HeardAboutOrder } from "@/lib/admin-heard-about-stats";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listAdminOrders } from "@/lib/admin-orders";
import { loadListingPeekConversionStats } from "@/lib/listing-peek-conversion-load";
import { getSampleReportClickStats } from "@/lib/sample-report-click-store";
import { requireAdminPage } from "@/lib/admin-auth";
import { lastRigaDates, rigaDate, rigaMonthDates, summarizeVinCheckDays } from "@/lib/vin-check-stats";
import { readVinCheckDays } from "@/lib/vin-check-stats-store";

export const metadata = {
  title: "Statistika",
};

export const dynamic = "force-dynamic";

/** VIN pārbaužu skaitītāji: 30 dienas, šodiena, šis mēnesis (CSDD līgumam). */
async function loadVinChecks() {
  const now = new Date();
  const dates = [...new Set([...lastRigaDates(30, now), ...rigaMonthDates(now)])];
  try {
    const days = await readVinCheckDays(dates);
    const last30Set = new Set(lastRigaDates(30, now));
    const monthSet = new Set(rigaMonthDates(now));
    const today = rigaDate(now);
    return {
      last30: summarizeVinCheckDays(days.filter((d) => last30Set.has(d.date))),
      today: summarizeVinCheckDays(days.filter((d) => d.date === today)),
      month: summarizeVinCheckDays(days.filter((d) => monthSet.has(d.date))),
    };
  } catch {
    const empty = summarizeVinCheckDays([]);
    return { last30: empty, today: empty, month: empty };
  }
}

/** Tie paši pasūtījumi kā sarakstā pēc noklusējuma (summa > 10 €). */
async function loadStatistikaOrders(): Promise<{ heard: HeardAboutOrder[]; ads: AdsAttributionOrder[] }> {
  try {
    const { rows } = await listAdminOrders();
    const orders = filterAdminOrdersForDashboard(rows, false);
    const withSource = orders.filter((o) => o.heardAbout?.trim());
    const drafts = await readOrderDraftSummaries(withSource.map((o) => o.id));
    return {
      heard: orders.map((o) => {
        const d = drafts.get(o.id);
        const label = [d?.customerName || o.companyName || d?.customerEmail || o.customerEmail || "Klients", d?.vin || o.vin]
          .filter(Boolean)
          .join(" · ");
        return { id: o.id, created: o.created, heardAbout: o.heardAbout ?? null, label, amountTotal: o.amountTotal };
      }),
      ads: orders.map((o) => ({
        id: o.id,
        created: o.created,
        amountTotal: o.amountTotal,
        isDemo: o.isDemo,
        isManual: o.isManual,
        fulfillment: o.fulfillment ?? null,
        heardAbout: o.heardAbout ?? null,
        attribution: o.attribution ?? null,
      })),
    };
  } catch {
    return { heard: [], ads: [] };
  }
}

function ToolLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-[13px] transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--color-apple-text)]">{label}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--color-provin-muted)]">{hint}</span>
      </span>
      <span className="shrink-0 text-[12px] font-medium text-[var(--color-provin-accent)]">Atvērt</span>
    </a>
  );
}

export default async function AdminStatistikaPage() {
  await requireAdminPage();
  const embedUrl = getAnalyticsEmbedUrl();
  const dashboardUrl = getAnalyticsDashboardUrl();
  const gaId = getGaMeasurementId();
  const onVercel = isVercelDeployment();
  const sampleClicks = await getSampleReportClickStats();
  const [peekConversion, statOrders, adSpend, adVisits, vinChecks] = await Promise.all([
    loadListingPeekConversionStats(),
    loadStatistikaOrders(),
    readAdSpendRows().catch(() => []),
    readAdVisitDoc().catch(() => emptyAdVisitDoc()),
    loadVinChecks(),
  ]);
  const heardOrders = statOrders.heard;
  const nowSec = Math.floor(Date.now() / 1000);
  const sampleLastLabel = sampleClicks.lastClickedAt
    ? new Date(sampleClicks.lastClickedAt).toLocaleString("lv-LV", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl max-md:px-4">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Statistika
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          Konversija no visiem ātrajiem vērtējumiem un īss vietnes kopsavilkums.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <AdminListingPeekConversionCard stats={peekConversion} />
      </div>

      <div className="mt-5">
        <AdminVinChecksCard {...vinChecks} />
      </div>

      <div className="mt-5">
        <AdminHeardAboutCard orders={heardOrders} nowSec={nowSec} />
      </div>

      <div className="mt-5">
        <AdminAdsAttributionCard
          orders={statOrders.ads}
          initialSpend={adSpend}
          visits={adVisits}
          nowSec={nowSec}
        />
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
          Vietne
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">Atskaites piemērs</h2>
            <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">
              Klikšķi uz „Skatīt atskaites piemēru” hero AUDITS cilnē.
            </p>
          </div>
          <p className="text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-apple-text)]">
            {sampleClicks.total.toLocaleString("lv-LV")}
          </p>
        </div>
        <p className="mt-3 text-[12px] text-[var(--color-provin-muted)]">
          {sampleLastLabel ? `Pēdējais klikšķis: ${sampleLastLabel}` : "Vēl nav reģistrētu klikšķu."}
        </p>
      </section>

      <section className="mt-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
          Ārējie rīki
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToolLink
            href="https://vercel.com/dashboard"
            label="Vercel Analytics"
            hint={onVercel ? "Apmeklējumi šajā izvietošanā" : "Pieejams pēc deploy uz Vercel"}
          />
          <ToolLink
            href="https://analytics.google.com/"
            label="Google Analytics"
            hint={gaId ? gaId : "Mērījuma ID nav iestatīts"}
          />
          {dashboardUrl ? (
            <ToolLink href={dashboardUrl} label="Ārējais panelis" hint="Plausible vai cits koplietots dashboard" />
          ) : null}
        </div>
      </section>

      {embedUrl ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <iframe
            title="Analīzes panelis"
            src={embedUrl}
            className="h-[min(640px,65vh)] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          />
        </section>
      ) : null}

      {/* Telefonā atpakaļ ir augšā ("‹ Atpakaļ"). */}
      <p className="mt-8 text-[12px] max-md:hidden">
        <Link href="/admin/dashboard" className="font-medium text-[var(--color-provin-accent)] hover:underline">
          Atpakaļ uz pasūtījumiem
        </Link>
      </p>
    </div>
  );
}
