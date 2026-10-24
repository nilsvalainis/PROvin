import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { resetAllAutoparksV2MainPhotos, resetAutoparksV2MainPhoto } from "@/lib/iriss-autoparks-v2-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * J29 A: VIENREIZĒJS visu auto galvenās bildes atiestatīšanas/pārrēķina trigeris (tikai administrators - Nils).
 * Vecie sīktēli tiek saglabāti Blob dublējumā (`autoparks/<id>/v2-main-backup-*.jpg`, atgriežami - nekas netiek
 * dzēsts); nākamajā kabineta/saraksta atvērumā katram auto bilde tiek izvēlēta no jauna pēc jaunās heuristikas
 * (`pickStockMainPhoto`). Jāizpilda vienreiz pēc merge - skat. j29-REPORT.md.
 *
 * J39: opcionāls body `{ carId }` - atiestata TIKAI šo auto (nav vajadzīgs gaidīt 24h pārbaudes
 * intervālu `RECHECK_MS`, kas citādi bloķē pārrēķinu vienu dienu pēc IRISS tikko augšupielādētām
 * bildēm). Skat. j39-REPORT.md.
 */
export async function POST(req: Request) {
  const gate = await requireAutoparksV2Api("vesture");
  if (!gate.ok) return gate.response;
  const carId = String((await req.json().catch(() => ({})) as { carId?: unknown }).carId ?? "").trim();
  const actor = { id: gate.actorId, name: gate.actorName };
  if (carId) {
    const result = await resetAutoparksV2MainPhoto(carId, actor);
    if (!result) return autoparksV2Json({ ok: false, error: "not_found" }, 404);
    return autoparksV2Json({ ok: true, carId, ...result });
  }
  const summary = await resetAllAutoparksV2MainPhotos(actor);
  return autoparksV2Json({ ok: true, ...summary });
}
