import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { currentDealerCheckCreatorId } from "@/lib/dealer-check-actor";
import { addDealerCheckDelivery, readOwnedDealerCheck } from "@/lib/dealer-check-store";
import { isSafeDealerCheckId, type DealerCheckRecord } from "@/lib/dealer-check";
import { dealerCheckEmailDefaults, dealerCheckEmailDefaultsByLang } from "@/lib/dealer-check-report";
import { resolveClientEmailLang } from "@/lib/email/client-lang-email-copy";
import {
  deliverDealerCheckToAutoparks,
  findDealerCheckAutoparksCar,
  sendDealerCheckEmail,
} from "@/lib/dealer-check-platform";
import { isSmtpConfigured } from "@/lib/email/send-transactional";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Owned = { ok: true; record: DealerCheckRecord; creator: string } | { ok: false; response: Response };

async function ownedRecord(id: string): Promise<Owned> {
  if (!isSafeDealerCheckId(id)) return { ok: false, response: NextResponse.json({ error: "invalid_id" }, { status: 400 }) };
  const creator = await currentDealerCheckCreatorId();
  const record = await readOwnedDealerCheck(id, creator);
  if (!record) return { ok: false, response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { ok: true, record, creator };
}

/** Piegādes iespējas: vai auto ir Autoparkā (pēc VIN), e-pasta noklusējuma teksts. */
export async function GET(req: Request): Promise<Response> {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const got = await ownedRecord(new URL(req.url).searchParams.get("id") ?? "");
  if (!got.ok) return got.response;
  const found = await findDealerCheckAutoparksCar(got.record.vin).catch(() => null);
  return NextResponse.json({
    ok: true,
    autoparks: found?.info ?? null,
    email: dealerCheckEmailDefaults(got.record),
    emailByLang: dealerCheckEmailDefaultsByLang(got.record),
    smtp: isSmtpConfigured(),
    deliveries: got.record.deliveries ?? [],
  });
}

/**
 * POST { id, action: "autoparks" } - servera PDF uz esošā Autoparka auto dokumentiem + Dropbox STOCK.
 * POST { id, action: "email", to, subject, text, lang?, confirmed: true } - sūta no info@provin.lv ar PDF
 *   (`lang` lv/en/ru/de - e-pasta veidnes valoda; OEM PDF paliek oriģinālā).
 * Bez `confirmed: true` e-pasts netiek sūtīts (apstiprinājuma solis UI).
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const got = await ownedRecord(typeof body.id === "string" ? body.id : "");
  if (!got.ok) return got.response;
  const { record, creator } = got;

  try {
    if (body.action === "autoparks") {
      const result = await deliverDealerCheckToAutoparks(record, creator);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.error === "not_in_autoparks" ? 409 : 500 });
      }
      const updated = await addDealerCheckDelivery(record.id, {
        kind: "autoparks",
        at: new Date().toISOString(),
        target: result.car.title,
        ...(result.dropboxVerified ? { path: result.dropboxPath } : {}),
        by: creator,
      });
      return NextResponse.json({ ok: true, result, deliveries: updated?.deliveries ?? record.deliveries ?? [] });
    }

    if (body.action === "email") {
      if (body.confirmed !== true) return NextResponse.json({ error: "not_confirmed" }, { status: 400 });
      const sent = await sendDealerCheckEmail(record, {
        to: typeof body.to === "string" ? body.to : "",
        subject: typeof body.subject === "string" ? body.subject : "",
        text: typeof body.text === "string" ? body.text : "",
        lang: resolveClientEmailLang(typeof body.lang === "string" ? body.lang : null),
      });
      if (!sent.ok) {
        return NextResponse.json({ error: sent.error }, { status: sent.error === "smtp_not_configured" ? 503 : 400 });
      }
      const updated = await addDealerCheckDelivery(record.id, {
        kind: "email",
        at: new Date().toISOString(),
        target: sent.to,
        by: creator,
      });
      return NextResponse.json({ ok: true, to: sent.to, deliveries: updated?.deliveries ?? record.deliveries ?? [] });
    }
  } catch (e) {
    console.error("[admin/dealer-check/deliver]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "deliver_failed" }, { status: 502 });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
