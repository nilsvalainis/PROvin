import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { fetchEcsddRelaySession, readEcsddRelayConfig, startEcsddLookup } from "@/lib/ecsdd-auto";
import { readEcsddAutoStatus } from "@/lib/ecsdd-auto-store";
import { isEcsddAutoActive, type EcsddAutoStatus } from "@/lib/ecsdd-auto-types";
import { readLtabRelayConfig, startLtabLookup } from "@/lib/ltab-auto";
import { readLtabAutoStatus } from "@/lib/ltab-auto-store";
import { isLtabAutoActive, type LtabAutoStatus } from "@/lib/ltab-auto-types";
import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";
import { vinScanRelayRef } from "@/lib/vin-scan/v4-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Rezultāts (atrasts / nav) derīgs 12 h - atkārtota skenēšana e.csdd / LTAB lieki neprasa. */
const FRESH_MS = 12 * 60 * 60 * 1000;

function fresh(at: string | undefined, now: number): boolean {
  const t = Date.parse(at ?? "");
  return Number.isFinite(t) && now - t < FRESH_MS;
}

function ecsddDone(s: EcsddAutoStatus | null, now: number): boolean {
  return Boolean(s && (s.state === "found" || s.state === "not_found") && fresh(s.checkedAt ?? s.updatedAt, now));
}

function ltabDone(s: LtabAutoStatus | null, now: number): boolean {
  return Boolean(s && (s.state === "claims" || s.state === "no_claims") && fresh(s.checkedAt ?? s.updatedAt, now));
}

function parseVinPlate(vinRaw: unknown, plateRaw: unknown): { vin: string; plate: string } | null {
  const vin = normalizeVin(typeof vinRaw === "string" ? vinRaw : "");
  if (!isValidVin(vin)) return null;
  const plate = normalizePlateNumber(typeof plateRaw === "string" ? plateRaw : "").slice(0, 10);
  return { vin, plate };
}

async function view(vin: string) {
  const ref = vinScanRelayRef(vin);
  const ecsddConfigured = readEcsddRelayConfig() !== null;
  const ltabConfigured = readLtabRelayConfig() !== null;
  const [ecsdd, ltab, session] = await Promise.all([
    readEcsddAutoStatus(ref).catch(() => null),
    readLtabAutoStatus(ref).catch(() => null),
    ecsddConfigured ? fetchEcsddRelaySession() : Promise.resolve(null),
  ]);
  return {
    ecsdd,
    ltab,
    ecsddConfigured,
    ltabConfigured,
    // Tikai stāvoklis un kontrolkods - bez personas datiem.
    session: session ? { state: session.state, ...(session.verificationCode ? { verificationCode: session.verificationCode } : {}) } : null,
  };
}

/**
 * VIN SCAN v4: e.csdd (Smart-ID) un LTAB stāvoklis vienam VIN bez pasūtījuma (atsauce `vs_<vin>`).
 * GET ?vin= - tikai nolasa.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const q = parseVinPlate(sp.get("vin"), sp.get("plate"));
  if (!q) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  return NextResponse.json(await view(q.vin));
}

/**
 * POST {vin, plate?, force?}: sāk e.csdd un LTAB (LTAB tikai ar LV numuru) caur servera Smart-ID sesiju.
 * Palaiž tikai admina «Pārbaudīt» - bez maksas (e.csdd uzziņa un LTAB izziņa ar Smart-ID ir bezmaksas).
 * Svaigu rezultātu (12 h) atkārtoti neprasa, ja nav `force`.
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const q = parseVinPlate(body.vin, body.plate);
  if (!q) return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  const force = body.force === true;
  const ref = vinScanRelayRef(q.vin);
  const now = Date.now();
  const csdd = { ...mergeSourceBlocksWithDefaults({}).csdd, vin: q.vin, registrationNumber: q.plate };
  const [prevE, prevL] = await Promise.all([readEcsddAutoStatus(ref).catch(() => null), readLtabAutoStatus(ref).catch(() => null)]);
  const tasks: Promise<unknown>[] = [];
  if (readEcsddRelayConfig() && !isEcsddAutoActive(prevE) && (force || !ecsddDone(prevE, now))) {
    tasks.push(startEcsddLookup(ref, { trigger: "manual", orderVin: q.vin, csdd, force: true }).catch(() => null));
  }
  if (q.plate && readLtabRelayConfig() && !isLtabAutoActive(prevL) && (force || !ltabDone(prevL, now))) {
    tasks.push(startLtabLookup(ref, { trigger: "manual", orderVin: q.vin, csdd, force: true }).catch(() => null));
  }
  await Promise.all(tasks);
  return NextResponse.json(await view(q.vin));
}
