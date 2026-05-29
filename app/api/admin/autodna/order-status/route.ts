/**
 * Admin: autoDNA POST /api/orderStatus (multipart: orderId).
 */
import { NextResponse } from "next/server";

import { autodnaOrderStatus, getAutodnaConfig } from "@/lib/autodna-api";
import { autodnaResultToNextResponse } from "@/lib/autodna-admin-route";
import { getAdminSession } from "@/lib/admin-auth";

export const maxDuration = 90;
export const runtime = "nodejs";
export const preferredRegion = "fra1";

const ORDER_ID_RE = /^[a-f0-9]{20,128}$/i;

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = getAutodnaConfig();
  if (!config) {
    return NextResponse.json({ error: "missing_autodna_credentials" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const o = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const orderId = String(o.orderId ?? "").trim();
  if (!ORDER_ID_RE.test(orderId)) {
    return NextResponse.json({ error: "invalid_order_id" }, { status: 400 });
  }

  try {
    const result = await autodnaOrderStatus({ orderId }, config);
    return autodnaResultToNextResponse(result, "admin/autodna/order-status", { orderId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/autodna/order-status] unhandled exception", { orderId, message: msg, error: e });
    return NextResponse.json({ error: "autodna_request_failed", detail: msg }, { status: 502 });
  }
}
