import { after } from "next/server";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readServiceInvoiceAmountWithAi } from "@/lib/iriss-autoparks-v2-ai-invoice";
import { isServissScanTarget } from "@/lib/iriss-autoparks-v2-serviss";
import { getAutoparksV2Serviss, scanAutoparksV2Serviss } from "@/lib/iriss-autoparks-v2-serviss-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel ķermeņa limits ~4,5 MB: klients bildes saspiež un sūta pa daļām. */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 12;

type Ctx = { params: Promise<{ id: string }> };

/** Skenējums (T4): `target` = number_check | diag | invoice | invoice_page (+ `invoiceId`), `file` = lapas (bildes). */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("serviss");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return autoparksV2Json({ error: "invalid_body" }, 400);
  }
  const target = form.get("target");
  if (!isServissScanTarget(target)) return autoparksV2Json({ error: "invalid_target" }, 400);
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return autoparksV2Json({ error: "missing_file" }, 400);
  if (files.length > MAX_PAGES) return autoparksV2Json({ error: "too_many_pages" }, 413);
  if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) return autoparksV2Json({ error: "too_large" }, 413);
  if (files.some((f) => !f.type.startsWith("image/"))) return autoparksV2Json({ error: "not_image" }, 415);
  const invoiceId = typeof form.get("invoiceId") === "string" ? String(form.get("invoiceId")) : undefined;
  try {
    const res = await scanAutoparksV2Serviss({
      carId: id,
      target,
      invoiceId,
      images: await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()))),
      actor: { id: gate.actorId, name: gate.actorName },
    });
    if (!res.ok) return autoparksV2Json({ error: res.reason }, res.reason === "duplicate" ? 409 : 404);
    // F10: rēķina summu AI nolasa pēc atbildes (ieteikums; apstiprina cilvēks ar Summām).
    const aiInvoice = target === "invoice" || target === "invoice_page" ? res.invoiceId : undefined;
    if (aiInvoice) after(() => readServiceInvoiceAmountWithAi(id, aiInvoice).then(() => undefined).catch(() => undefined));
    return autoparksV2Json({ ok: true, invoiceId: res.invoiceId ?? null, serviss: await getAutoparksV2Serviss(id, gate.perms) });
  } catch {
    // Klients (bezsaistes rinda) saņem 503 un rāda "Vēlreiz"; lokālo kopiju dzēš tikai pēc 200.
    return autoparksV2Json({ error: "upload_failed" }, 503);
  }
}
