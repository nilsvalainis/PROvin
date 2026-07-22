import { NextResponse } from "next/server";
import { createOperatorOrderWithFields } from "@/lib/create-operator-order";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  getOrderContactFieldErrors,
  isPlausibleListingUrl,
  isValidVinOrPlate,
  normalizeVin,
} from "@/lib/order-field-validation";
import { operatorOrderConfigured, verifyOperatorOrderKey } from "@/lib/operator-order-auth";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const NOTES_MAX = 500;
const NAME_MAX = 120;
const CHECKOUT_MAX_PER_WINDOW = 20;
const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

type OperatorOrderBody = {
  operatorKey?: unknown;
  vin?: unknown;
  listingUrl?: unknown;
  email?: unknown;
  phone?: unknown;
  name?: unknown;
  notes?: unknown;
};

function storeErrorStatus(error: string): number {
  if (error === "store_disabled" || error === "store_not_durable") return 503;
  if (error === "not_found" || error === "invalid_session") return 404;
  return 500;
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST ar JSON (pasūtījuma lauki un operatorKey)." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: Request) {
  if (!operatorOrderConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`operator-order:${ip}`, CHECKOUT_MAX_PER_WINDOW, CHECKOUT_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Pārāk daudz pieprasījumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let raw: OperatorOrderBody;
  try {
    raw = (await req.json()) as OperatorOrderBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const headerKey = req.headers.get("x-operator-order-key")?.trim() ?? "";
  const bodyKey = typeof raw.operatorKey === "string" ? raw.operatorKey.trim() : "";
  const operatorKey = headerKey || bodyKey;
  if (!verifyOperatorOrderKey(operatorKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  const listingUrl = typeof raw.listingUrl === "string" ? raw.listingUrl.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, NAME_MAX) : "";
  const notesRaw = typeof raw.notes === "string" ? raw.notes.trim() : "";
  const notes = notesRaw.slice(0, NOTES_MAX);

  const errors: string[] = [];
  if (!vin || !isValidVinOrPlate(vin)) {
    errors.push("Ievadi derīgu VIN kodu vai numurzīmi.");
  }
  if (listingUrl && !isPlausibleListingUrl(listingUrl)) {
    errors.push("Norādi pilnu sludinājuma saiti (ne tikai vietnes sakni).");
  }
  const contact = getOrderContactFieldErrors(email, phone);
  if (contact.email) errors.push("Ievadi derīgu e-pasta adresi.");
  if (contact.phone) errors.push("Ievadi derīgu tālruņa numuru.");

  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const created = await createOperatorOrderWithFields({
    vin,
    listingUrl: listingUrl || undefined,
    email,
    phone,
    name: name || undefined,
    notes: notes || undefined,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: storeErrorStatus(created.error) });
  }

  return NextResponse.json({ ok: true, orderId: created.orderId });
}
