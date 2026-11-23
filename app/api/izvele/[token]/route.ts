import { NextResponse } from "next/server";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import {
  AUCTION_ARCHIVE_HEADERS,
  auctionArchivePublicPath,
  isAuctionArchiveChoice,
  isAuctionArchiveLinkActive,
  resolveAuctionArchiveLocale,
} from "@/lib/auction-archive-offer";
import { findAuctionArchiveOfferByToken } from "@/lib/auction-archive-offer-store";
import { recordAuctionArchiveChoice } from "@/lib/auction-archive-offer-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Klienta izvēle: TIKAI POST no izvēles lapas pogas «Apstiprināt» (e-pasta skeneri atver saites ar GET -
 * GET šeit neko nemaina). Atbilde vienmēr 303 atpakaļ uz lapu, kas parāda saglabāto stāvokli.
 * Tokens netiek žurnālēts.
 */
function back(req: Request, locale: string, token: string, flag: string): NextResponse {
  const dest = new URL(auctionArchivePublicPath(resolveAuctionArchiveLocale(locale), token), req.url);
  if (flag) dest.searchParams.set("r", flag);
  return NextResponse.redirect(dest, { status: 303, headers: AUCTION_ARCHIVE_HEADERS });
}

/** Cits avots (nav mūsu lapa) - neņem pretī. Pārlūki POST formai sūta Origin. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return true;
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  const token = (raw ?? "").trim();
  let choice = "";
  let locale = "lv";
  try {
    const form = await req.formData();
    choice = String(form.get("choice") ?? "");
    locale = String(form.get("locale") ?? "lv");
  } catch {
    /* tukša forma */
  }
  if (!sameOrigin(req)) return back(req, locale, token, "err");

  const ip = getClientIpFromHeaders(req.headers);
  const rl = await checkRateLimit(`auction-archive-choice:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return back(req, locale, token, "err");
  if (!isAuctionArchiveChoice(choice)) return back(req, locale, token, "pick");

  try {
    const found = await findAuctionArchiveOfferByToken(token);
    if (!found || !isAuctionArchiveLinkActive(found.doc)) return back(req, locale, token, "");
    const r = await recordAuctionArchiveChoice({ sessionId: found.sessionId, choice, via: "link" });
    return back(req, locale, token, r.ok ? "ok" : "");
  } catch (e) {
    console.error("[api/izvele] choice", e instanceof Error ? e.message.slice(0, 160) : "error");
    return back(req, locale, token, "err");
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return back(req, "lv", (token ?? "").trim(), "");
}
