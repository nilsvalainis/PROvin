import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { fetchListingAiSnapshot } from "@/lib/listing-scrape";
import { isPlausibleListingUrl } from "@/lib/order-field-validation";

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body === "object" && body && "url" in body ? String((body as { url: unknown }).url).trim() : "";
  if (!url || !isPlausibleListingUrl(url)) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  // ListingAiSnapshot ir ListingMarketSnapshot papildināts ar description/pageTitle/options/photoCount -
  // esošie patērētāji (Tirgus autofill), kas lasa tikai market laukus, turpina strādāt nemainīti.
  const snapshot = await fetchListingAiSnapshot(url);
  return NextResponse.json(snapshot);
}
