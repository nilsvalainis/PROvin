import type { Metadata } from "next";
import { headers } from "next/headers";
import { IrissCarSharePublicUnavailable, IrissCarSharePublicView } from "@/components/iriss-car-share-public/IrissCarSharePublicView";
import { isSafeIrissCarShareToken } from "@/lib/iriss-car-share";
import { loadIrissCarSharePublicView } from "@/lib/iriss-car-share-public";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dzintarzeme Auto",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export default async function IrissCarSharePublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw?.trim() ?? "";
  const headerList = await headers();
  const ipRl = await checkRateLimit(`iriss-car-share-get:${getClientIpFromHeaders(headerList)}`, 40, 10 * 60 * 1000);
  if (!ipRl.ok || !isSafeIrissCarShareToken(token)) return <IrissCarSharePublicUnavailable />;
  const view = await loadIrissCarSharePublicView(token);
  if (!view) return <IrissCarSharePublicUnavailable />;
  return <IrissCarSharePublicView token={token} view={view} />;
}
