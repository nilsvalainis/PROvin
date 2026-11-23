import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  AuctionArchiveChoicePageView,
  AuctionArchiveInvalidView,
  auctionArchiveChoiceView,
} from "@/components/auction-archive-choice/AuctionArchiveChoiceView";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import {
  AUCTION_ARCHIVE_COPY,
  isAuctionArchiveLinkActive,
  resolveAuctionArchiveLocale,
} from "@/lib/auction-archive-offer";
import { findAuctionArchiveOfferByToken } from "@/lib/auction-archive-offer-store";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: AUCTION_ARCHIVE_COPY[resolveAuctionArchiveLocale(locale)].pageTitle,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
    referrer: "no-referrer",
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * `/{locale}/izvele/<token>` (middleware pārraksta šurp). GET NEKAD neko nemaina - izvēli fiksē tikai
 * POST «Apstiprināt» (`/api/izvele/<token>`). Jebkura kļūme - neitrālā lapa.
 */
export default async function AuctionArchiveChoicePage({ params, searchParams }: Props) {
  const { locale: rawLocale, token: rawToken } = await params;
  const sp = await searchParams;
  const locale = resolveAuctionArchiveLocale(rawLocale);
  const token = (rawToken ?? "").trim();

  const ip = getClientIpFromHeaders(await headers());
  const rl = await checkRateLimit(`auction-archive-get:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return <AuctionArchiveInvalidView locale={locale} />;

  try {
    const found = await findAuctionArchiveOfferByToken(token);
    if (!found || !isAuctionArchiveLinkActive(found.doc)) return <AuctionArchiveInvalidView locale={locale} />;
    const view = auctionArchiveChoiceView(found.doc, {
      locale,
      token,
      change: one(sp.mainit) === "1",
      notice: one(sp.r),
    });
    return <AuctionArchiveChoicePageView view={view} />;
  } catch (e) {
    console.error("[izsoles-izvele] page", e instanceof Error ? e.message.slice(0, 160) : "error");
    return <AuctionArchiveInvalidView locale={locale} />;
  }
}
