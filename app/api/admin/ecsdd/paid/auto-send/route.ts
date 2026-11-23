import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { ecsddAutoSmsMode } from "@/lib/ecsdd-paid";
import { sendCsddSmsTriggerEmail } from "@/lib/email/send-transactional";
import { autoSmsDecision, isValidAutoSms, type EcsddAutoSmsRecord } from "@/lib/ecsdd-paid-logic";
import { readAutoSms, writeAutoSms } from "@/lib/ecsdd-paid-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin poga "Sūtīt automātiski": e-pasts no info@provin.lv uz `ECSDD_SMS_TRIGGER_EMAIL` ar tematu "PROVIN CSDD SMS"
 * (1. rinda numurs, 2. rinda SMS teksts) - uz to reaģē Nila iPhone Īsceļu automatizācija un nosūta SMS no viņa numura.
 * Viens pieprasījums = viens e-pasts (dubultklikšķis / atkārtojums -> `duplicate`). Tikai pēc admina klikšķa.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 80) : "";
  if (!/^[A-Za-z0-9:._-]{8,80}$/.test(id) || !isValidAutoSms(body)) return NextResponse.json({ error: "invalid_sms" }, { status: 400 });
  // ECSDD_SMS_TRIGGER_MODE=pull: e-pastu nesūta, Īsceļš paņem ar "Iegūt URL saturu" (/api/ecsdd/paid-sms).
  // Bez ECSDD_SMS_TRIGGER_EMAIL (e-pasta režīmā) poga nav redzama un galapunkts atsaka.
  const mode = ecsddAutoSmsMode();
  if (!mode) return NextResponse.json({ error: "trigger_not_configured" }, { status: 503 });
  const pull = mode === "pull";
  const to = (process.env.ECSDD_SMS_TRIGGER_EMAIL ?? "").trim();
  const now = new Date();
  const rec: EcsddAutoSmsRecord = {
    id,
    number: String(body.number),
    body: String(body.body).trim(),
    plate: String(body.plate).toUpperCase(),
    createdAt: now.toISOString(),
  };
  const prev = await readAutoSms();
  if (autoSmsDecision(prev, rec, now) === "duplicate") return NextResponse.json({ ok: true, duplicate: true });
  // Pull režīmā signāls = ieraksts pats (`emailedAt` = signalizēts), tāpēc tas pats `id` otrreiz neatjaunojas.
  if (!(await writeAutoSms(pull ? { ...rec, emailedAt: rec.createdAt } : rec))) {
    return NextResponse.json({ error: "store_failed" }, { status: 503 });
  }
  if (pull) return NextResponse.json({ ok: true, duplicate: false, mode: "pull" });
  try {
    await sendCsddSmsTriggerEmail({ to, number: rec.number, body: rec.body });
  } catch (e) {
    console.error("[ecsdd-paid] trigger email failed", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  // E-pasta režīmā SMS sūta e-pasta automatizācija - "Iegūt URL saturu" to vairs neatdod (viena SMS uz pieprasījumu).
  const sent = new Date().toISOString();
  await writeAutoSms({ ...rec, emailedAt: sent, consumedAt: sent });
  return NextResponse.json({ ok: true, duplicate: false, mode: "email" });
}
