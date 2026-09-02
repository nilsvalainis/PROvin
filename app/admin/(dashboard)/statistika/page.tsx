import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";
import {
  getAnalyticsDashboardUrl,
  getAnalyticsEmbedUrl,
  getGaMeasurementId,
  isVercelDeployment,
} from "@/lib/analytics-public";
import { loadListingPeekConversionStats } from "@/lib/listing-peek-conversion-load";
import { getSampleReportClickStats } from "@/lib/sample-report-click-store";

export const metadata = {
  title: "Statistika",
};

export const dynamic = "force-dynamic";

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
  const embedUrl = getAnalyticsEmbedUrl();
  const dashboardUrl = getAnalyticsDashboardUrl();
  const gaId = getGaMeasurementId();
  const onVercel = isVercelDeployment();
  const sampleClicks = await getSampleReportClickStats();
  const peekConversion = await loadListingPeekConversionStats();
  const sampleLastLabel = sampleClicks.lastClickedAt
    ? new Date(sampleClicks.lastClickedAt).toLocaleString("lv-LV", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Statistika
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          Konversija no atbildētajiem ātrajiem vērtējumiem un īss vietnes kopsavilkums.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <AdminListingPeekConversionCard stats={peekConversion} />
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

      <p className="mt-8 text-[12px]">
        <Link href="/admin/dashboard" className="font-medium text-[var(--color-provin-accent)] hover:underline">
          Atpakaļ uz pasūtījumiem
        </Link>
      </p>
    </div>
  );
}
