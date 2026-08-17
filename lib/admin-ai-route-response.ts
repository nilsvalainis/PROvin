import "server-only";

import { NextResponse } from "next/server";
import { isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import { withAiUsageMeter } from "@/lib/ai-usage-meter";

export async function nextJsonWithAiUsage(fn: () => Promise<string>): Promise<NextResponse> {
  return withAiUsageOnJsonResponse(async () => {
    try {
      const text = (await fn()).trim();
      if (!text) {
        return NextResponse.json({ error: "ai_empty_content" }, { status: 502 });
      }
      return NextResponse.json({ text });
    } catch (e) {
      if (isAiIncompleteCommentError(e) && e.partialText) {
        return NextResponse.json(
          {
            error: "ai_incomplete_comment",
            text: e.partialText,
            incomplete: true,
          },
          { status: 422 },
        );
      }
      throw e;
    }
  });
}

export async function nextJsonBodyWithAiUsage<T extends object>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  return withAiUsageOnJsonResponse(async () => {
    try {
      return NextResponse.json(await fn());
    } catch (e) {
      if (isAiIncompleteCommentError(e) && e.partialText) {
        return NextResponse.json(
          {
            error: "ai_incomplete_comment",
            text: e.partialText,
            incomplete: true,
          },
          { status: 422 },
        );
      }
      throw e;
    }
  });
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
