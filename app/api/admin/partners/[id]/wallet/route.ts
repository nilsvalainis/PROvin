import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { getB2bPartnerById, updateB2bPartner } from "@/lib/b2b-partner-store";
import {
  applyB2bWalletAdjust,
  B2B_WALLET_PRODUCTS,
  emptyB2bWalletPrices,
  formatB2bWalletEuro,
  parseB2bEuroInput,
  parseB2bWalletHiddenProducts,
  validateB2bWalletPriceInput,
  type B2bWalletProductId,
} from "@/lib/b2b-wallet";
import { readB2bWallet, updateB2bWallet } from "@/lib/b2b-wallet-store";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PRODUCT_LABEL_LV: Record<B2bWalletProductId, string> = {
  business: "PROVIN Business",
  dealer_raw: "Dīlera dati (RAW)",
  dealer_pro: "Dīlera dati (PRO)",
};

async function loadPartner(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isSafeB2bPartnerId(id)) return null;
  return getB2bPartnerById(id);
}

export async function GET(_req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const partner = await loadPartner(ctx);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const wallet = await readB2bWallet(partner.id);
  return NextResponse.json({
    wallet: buildB2bWalletView(wallet, partner.walletPrices, 200, partner.walletHiddenProducts),
    overrides: partner.walletPrices,
    hidden: partner.walletHiddenProducts,
  });
}

/**
 * Individuālās cenas: `{ prices }` vai `{ reset: true }` (noklusējuma cenas).
 * Redzamība: `{ hidden: ["dealer_raw", ...] }` maina tikai paslēptos produktus.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const partner = await loadPartner(ctx);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if ("hidden" in raw) {
    if (!Array.isArray(raw.hidden)) return NextResponse.json({ error: "hidden" }, { status: 400 });
    const hidden = parseB2bWalletHiddenProducts(raw.hidden);
    const updated = await updateB2bPartner(partner.id, { walletHiddenProducts: hidden });
    if (!updated.ok) return NextResponse.json({ error: updated.error }, { status: 400 });
    const wallet = await readB2bWallet(partner.id);
    return NextResponse.json({
      wallet: buildB2bWalletView(wallet, partner.walletPrices, 200, hidden),
      overrides: partner.walletPrices,
      hidden,
    });
  }

  let prices = emptyB2bWalletPrices();
  if (raw.reset !== true) {
    const input = (raw.prices ?? {}) as Record<string, unknown>;
    const pick = (key: B2bWalletProductId) => {
      const v = input[key];
      return typeof v === "string" || typeof v === "number" ? v : null;
    };
    const validation = validateB2bWalletPriceInput({
      business: pick("business"),
      dealer_raw: pick("dealer_raw"),
      dealer_pro: pick("dealer_pro"),
    });
    if (!validation.ok) {
      const label = PRODUCT_LABEL_LV[validation.product];
      const message =
        validation.reason === "below_min"
          ? `${label}: cena nevar būt zemāka par ${formatB2bWalletEuro(validation.minCents)}.`
          : `${label}: nederīga summa.`;
      return NextResponse.json(
        { error: validation.reason, product: validation.product, minCents: validation.minCents, message },
        { status: 400 },
      );
    }
    prices = validation.prices;
  }

  const result = await updateB2bPartner(partner.id, { walletPrices: prices });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const wallet = await readB2bWallet(partner.id);
  return NextResponse.json({
    wallet: buildB2bWalletView(wallet, prices, 200, partner.walletHiddenProducts),
    overrides: prices,
    hidden: partner.walletHiddenProducts,
    defaults: Object.fromEntries(
      Object.values(B2B_WALLET_PRODUCTS).map((spec) => [spec.id, spec.defaultCents]),
    ),
  });
}

/** Manuāla atlikuma korekcija ar piezīmi: `{ amount: "-10,00" | "10", note, key }`. */
export async function POST(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const partner = await loadPartner(ctx);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const amountRaw = typeof raw.amount === "string" ? raw.amount.trim() : "";
  const negative = amountRaw.startsWith("-");
  const parsed = parseB2bEuroInput(negative ? amountRaw.slice(1) : amountRaw.replace(/^\+/, ""));
  if (parsed == null || parsed === "invalid") {
    return NextResponse.json({ error: "amount", message: "Ievadiet derīgu summu." }, { status: 400 });
  }
  const note = typeof raw.note === "string" ? raw.note : "";
  const key =
    typeof raw.key === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(raw.key)
      ? raw.key
      : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await updateB2bWallet(partner.id, (wallet) => {
    const r = applyB2bWalletAdjust(wallet, { amountCents: negative ? -parsed : parsed, note, key });
    if (!r.ok || r.duplicate) return { value: r };
    return { value: r, next: r.wallet };
  });
  if (!result.ok) {
    const message =
      result.reason === "note_required"
        ? "Piezīme ir obligāta."
        : result.reason === "negative_balance"
          ? "Atlikums nevar kļūt negatīvs."
          : "Summa nevar būt 0.";
    return NextResponse.json({ error: result.reason, message }, { status: 400 });
  }
  const wallet = await readB2bWallet(partner.id);
  return NextResponse.json({
    wallet: buildB2bWalletView(wallet, partner.walletPrices, 200, partner.walletHiddenProducts),
  });
}
