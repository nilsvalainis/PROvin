import "server-only";

import { NextResponse, after } from "next/server";
import { recordSourceOutcomes } from "@/lib/source-health-store";

import type { AutodnaApiFailure, AutodnaBinarySuccess, AutodnaJsonSuccess } from "@/lib/autodna-api";
import { autodnaFailureHttpStatus } from "@/lib/autodna-api";

export function autodnaResultToNextResponse(
  result: AutodnaJsonSuccess | AutodnaBinarySuccess | AutodnaApiFailure,
  logTag: string,
  context: Record<string, string>,
): NextResponse {
  after(() =>
    recordSourceOutcomes([
      { id: "autodna", ok: result.ok, msg: result.ok ? undefined : `${result.code}: ${result.message ?? ""}` },
    ]),
  );
  if (!result.ok) {
    console.error(`[${logTag}] upstream failure`, {
      ...context,
      code: result.code,
      status: result.status,
      statusCode: result.statusCode,
      message: result.message,
    });
    return NextResponse.json(
      {
        error: result.code,
        message: result.message,
        upstreamStatus: result.status,
        ...(result.statusCode ? { autodnaStatusCode: result.statusCode } : {}),
        ...(result.rawBody ? { rawBodyPreview: result.rawBody } : {}),
      },
      { status: autodnaFailureHttpStatus(result.code, result.status) },
    );
  }

  if ("binaryBase64" in result) {
    return NextResponse.json({
      ...context,
      contentType: result.contentType,
      binaryBase64: result.binaryBase64,
    });
  }

  return NextResponse.json({
    ...context,
    data: result.data,
  });
}
