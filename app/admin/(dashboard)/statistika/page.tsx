import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import {
  getAnalyticsDashboardUrl,
  getAnalyticsEmbedUrl,
  isVercelDeployment,
} from "@/lib/analytics-public";

export const metadata = {
  title: "Statistika",
};

export const dynamic = "force-dynamic";

export default async function AdminStatistikaPage() {
  const embedUrl = getAnalyticsEmbedUrl();
  const dashboardUrl = getAnalyticsDashboardUrl();
  const onVercel = isVercelDeployment();

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Mājas lapa
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Statistika
        </h1>
        <p className="mt-2 max-w-[42rem] text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          Apmeklējumu skaiti, avoti un ceļš līdz lapai parasti tiek vākti ar analīzes rīku (Vercel, Plausible, Google
          Analytics u.c.). Šeit ir īss kopsavilkums un, ja iestatīts, iegults ārējais panelis.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Vercel Web Analytics</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
            {onVercel ? (
              <>
                Šī izvietošana darbojas uz Vercel. Vietnē ir ieslēgts <span className="font-medium text-[var(--color-apple-text)]">@vercel/analytics</span>{" "}
                — apmeklējumu dati un lapu skatījumi parādās Vercel projekta sadaļā{" "}
                <span className="font-medium text-[var(--color-apple-text)]">Analytics</span> (pēc pierakstīšanās).
              </>
            ) : (
              <>
                Lokālā izstrādē vai uz citas platformas detalizēti skaitļi šeit nav. Uz{" "}
                <span className="font-medium text-[var(--color-apple-text)]">Vercel</span> ieslēdziet Web Analytics
                projektā un pievienojiet pakotni <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">@vercel/analytics</code>{" "}
                (jau ir <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">SiteVercelAnalytics</code>{" "}
                saknes layoutā).
              </>
            )}
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-provin-muted)]">
            Pilns ceļš „no kurienes atnākuši” (referrer, UTMs) Vercel Analytics ietvaros ir ierobežots; detalizētākai
            avotu analīzei bieži izmanto Plausible vai Google Analytics.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://vercel.com/docs/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50"
            >
              Vercel Analytics dokumentācija
            </a>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)]"
            >
              Atvērt Vercel paneli
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Ārējais panelis (Plausible, GA…)</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
            Iestatiet vides mainīgos{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">NEXT_PUBLIC_ANALYTICS_DASHBOARD_URL</code>{" "}
            (saite uz pilnu paneli) un/vai{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px]">NEXT_PUBLIC_ANALYTICS_EMBED_URL</code>{" "}
            (https iframe, piemēram Plausible „Shared dashboard” embed). Abiem jābūt <span className="font-medium">https://</span>.
          </p>
          {dashboardUrl ? (
            <div className="mt-4">
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)]"
              >
                Atvērt analīzes paneli
              </a>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-[var(--color-provin-muted)]">
              <span className="font-medium text-[var(--color-apple-text)]">NEXT_PUBLIC_ANALYTICS_DASHBOARD_URL</span> nav
              iestatīts.
            </p>
          )}
        </div>
      </div>

      {embedUrl ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Iegults panelis</h2>
          <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">
            Avots: <span className="break-all font-mono text-[11px] text-[var(--color-apple-text)]">{embedUrl}</span>
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 shadow-inner">
            <iframe
              title="Analīzes panelis"
              src={embedUrl}
              className="h-[min(720px,70vh)] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-10 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav iegultā paneļa</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Pievienojiet <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">NEXT_PUBLIC_ANALYTICS_EMBED_URL</code>{" "}
            Vercel / .env, lai šeit parādītos Plausible vai cits https embed.
          </p>
        </div>
      )}

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-provin-muted)]">
        <Link href="/admin" className="font-medium text-[var(--color-provin-accent)] hover:underline">
          ← Atpakaļ uz pasūtījumiem
        </Link>
      </p>
    </div>
  );
}
