import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import {
  fetchListingPriceHistory,
  LISTING_HISTORY_HTML_MAX_CHARS,
  snapshotFromVendorHistoryHtml,
} from "@/lib/listing-price-history";
import { isPlausibleListingUrl } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url =
    typeof body === "object" && body && "url" in body ? String((body as { url: unknown }).url).trim() : "";
  if (!url || !isPlausibleListingUrl(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const htmlRaw =
    typeof body === "object" && body && "html" in body && typeof (body as { html: unknown }).html === "string"
      ? (body as { html: string }).html
      : "";
  if (htmlRaw) {
    if (htmlRaw.length > LISTING_HISTORY_HTML_MAX_CHARS) {
      return NextResponse.json({ error: "html_too_large" }, { status: 413 });
    }
    return NextResponse.json(snapshotFromVendorHistoryHtml(htmlRaw));
  }

  const snapshot = await fetchListingPriceHistory(url);
  return NextResponse.json(snapshot);
}
