import { NextResponse } from "next/server";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2IegadeFile } from "@/lib/iriss-autoparks-v2-iegade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Iegādes fails caur serveri (Dropbox/Blob nekad tieši). Fails no citas kategorijas vai cita auto - 404. `?dl=1` lejupielāde. */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id, fileId } = await ctx.params;
  const got = await readAutoparksV2IegadeFile(id, decodeURIComponent(fileId));
  if (!got) return autoparksV2Json({ error: "not_found" }, 404);
  const ext = got.contentType.includes("pdf") ? ".pdf" : "";
  const name = `${got.name.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "dokuments"}${ext}`;
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return new NextResponse(new Uint8Array(got.bytes), {
    headers: {
      "Content-Type": got.contentType || "application/octet-stream",
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
