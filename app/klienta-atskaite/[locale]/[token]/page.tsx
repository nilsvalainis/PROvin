import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ClientReportLinkInvalidView,
  ClientReportLinkPageView,
} from "@/components/client-report-link/ClientReportLinkView";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { CLIENT_REPORT_LINK_COPY, resolveClientReportLinkLocale } from "@/lib/client-report-link";
import { loadClientReportLinkView } from "@/lib/client-report-link-page";
import { findUsableClientReportLink } from "@/lib/client-report-link-store";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: CLIENT_REPORT_LINK_COPY[resolveClientReportLinkLocale(locale)].title,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    referrer: "no-referrer",
  };
}

/** `/{locale}/atskaite/<token>` (middleware pārraksta šurp). Jebkura kļūme - neitrālā lapa. */
export default async function ClientReportLinkPage({ params }: Props) {
  const { locale: rawLocale, token: rawToken } = await params;
  const locale = resolveClientReportLinkLocale(rawLocale);
  const token = (rawToken ?? "").trim();

  const ip = getClientIpFromHeaders(await headers());
  const rl = await checkRateLimit(`client-report-link-get:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return <ClientReportLinkInvalidView locale={locale} />;

  try {
    const found = await findUsableClientReportLink(token);
    if (!found) return <ClientReportLinkInvalidView locale={locale} />;
    const view = await loadClientReportLinkView({ token, sessionId: found.sessionId, record: found.record, locale });
    if (!view) return <ClientReportLinkInvalidView locale={locale} />;
    return <ClientReportLinkPageView view={view} />;
  } catch (e) {
    // Bez tokena un bez sessionId žurnālā.
    console.error("[klienta-atskaite] page", e instanceof Error ? e.message.slice(0, 160) : "error");
    return <ClientReportLinkInvalidView locale={locale} />;
  }
}
