import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { readGoogleContactsConfig } from "@/lib/google-contacts";
import { maybeSyncGoogleContact } from "@/lib/iriss-google-contact-sync";
import { parseIrissPasutijumsPatchBody } from "@/lib/iriss-pasutijumi-body";
import {
  IRISS_STALE_REVISION,
  parseExpectedIrissRevision,
} from "@/lib/iriss-pasutijumi-save-safety";
import {
  deleteIrissPasutijums,
  hydrateIrissOfferImageThumbs,
  hydrateIrissPasutijumsImages,
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
/** Vercel: garš JSON + Blob/FS — pagarināts laiks, lai pēc 100% augšupielādes nepazustu ar 504. */
export const maxDuration = 120;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const thumbsOnly = new URL(req.url).searchParams.get("images") === "thumbs";
  const hydrated = thumbsOnly ? await hydrateIrissOfferImageThumbs(rec) : await hydrateIrissPasutijumsImages(rec);
  return NextResponse.json({
    record: hydrated,
    workspaceRevision: hydrated.workspaceRevision,
    googleContactsConfigured: Boolean(readGoogleContactsConfig()),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t0 = Date.now();
  const { id } = await ctx.params;
  try {
    const gate = await requireIrissSectionApi("pasutijumi");
    if (!gate.ok) return gate.response;
    if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[iriss PATCH] req.json failed", { id, ms: Date.now() - t0, err: String(e) });
      return NextResponse.json(
        { error: "invalid_json", detail: e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240) },
        { status: 400 },
      );
    }

    const rec = parseIrissPasutijumsPatchBody(id, body);
    if (!rec) {
      console.error("[iriss PATCH] invalid_body after parse", { id, ms: Date.now() - t0 });
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const bodyObj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const expected =
      parseExpectedIrissRevision(bodyObj.expectedWorkspaceRevision) ??
      parseExpectedIrissRevision(bodyObj.workspaceRevision);

    const previous = await readIrissPasutijums(id);

    let w: Awaited<ReturnType<typeof writeIrissPasutijums>>;
    try {
      w = await writeIrissPasutijums(rec, { expectedWorkspaceRevision: expected });
    } catch (e) {
      console.error("[iriss PATCH] writeIrissPasutijums threw", {
        id,
        ms: Date.now() - t0,
        err: String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return NextResponse.json(
        {
          error: "write_threw",
          detail: e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400),
        },
        { status: 500 },
      );
    }

    if (!w.ok) {
      if (w.stale || w.error === IRISS_STALE_REVISION) {
        return NextResponse.json(
          { error: IRISS_STALE_REVISION, record: w.record, workspaceRevision: w.record?.workspaceRevision ?? 0 },
          { status: 409 },
        );
      }
      console.error("[iriss PATCH] write rejected", { id, ms: Date.now() - t0, error: w.error });
      return NextResponse.json({ error: w.error }, { status: 500 });
    }

    const saved = await maybeSyncGoogleContact(w.record ?? previous, previous);
    return NextResponse.json({
      ok: true,
      record: saved,
      workspaceRevision: saved?.workspaceRevision ?? 0,
      googleContactsConfigured: Boolean(readGoogleContactsConfig()),
    });
  } catch (e) {
    console.error("[iriss PATCH] unhandled", {
      id,
      ms: Date.now() - t0,
      err: String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      { error: "server_error", detail: e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const d = await deleteIrissPasutijums(id);
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
