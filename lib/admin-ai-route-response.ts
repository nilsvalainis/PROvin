import "server-only";

import { NextResponse } from "next/server";
import { withAiUsageMeter } from "@/lib/ai-usage-meter";

export async function nextJsonWithAiUsage(fn: () => Promise<string>): Promise<NextResponse> {
  const { result, usage } = await withAiUsageMeter(fn);
  return NextResponse.json({ text: result, usage });
}

export async function nextJsonBodyWithAiUsage<T extends object>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  const { result, usage } = await withAiUsageMeter(fn);
  return NextResponse.json({ ...result, usage });
}

/** Palaiž handleru meterā un pievieno `usage` JSON atbildei (arī kļūdām, ja AI jau tērēja tokenus). */
export async function withAiUsageOnJsonResponse(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  const { result, usage } = await withAiUsageMeter(fn);
  if (usage.calls <= 0) return result;
  const ct = result.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return result;
  try {
    const body: unknown = await result.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return result;
    return NextResponse.json({ ...(body as Record<string, unknown>), usage }, { status: result.status });
  } catch {
    return result;
  }
}
