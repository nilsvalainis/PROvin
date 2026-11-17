import { NextResponse } from "next/server";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2ServissFile } from "@/lib/iriss-autoparks-v2-serviss-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Servisa fails caur serveri. Fails, kas nepieder šī auto Servisam - 404. `?dl=1` lejupielāde. */
export async function GET(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("serviss");
  if (!gate.ok) return gate.response;
  const { id, fileId } = await ctx.params;
  const got = await readAutoparksV2ServissFile(id, decodeURIComponent(fileId));
  if (!got) return autoparksV2Json({ error: "not_found" }, 404);
  const name = `${got.name.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "dokuments"}.pdf`;
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return new NextResponse(new Uint8Array(got.bytes), {
    headers: {
      "Content-Type": got.contentType,
      "Content-Disposition": `${dl ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
