import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { resetAllAutoparksV2MainPhotos } from "@/lib/iriss-autoparks-v2-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * J29 A: VIENREIZĒJS visu auto galvenās bildes atiestatīšanas/pārrēķina trigeris (tikai administrators - Nils).
 * Vecie sīktēli tiek saglabāti Blob dublējumā (`autoparks/<id>/v2-main-backup-*.jpg`, atgriežami - nekas netiek
 * dzēsts); nākamajā kabineta/saraksta atvērumā katram auto bilde tiek izvēlēta no jauna pēc jaunās heuristikas
 * (`pickStockMainPhoto`). Jāizpilda vienreiz pēc merge - skat. j29-REPORT.md.
 */
export async function POST() {
  const gate = await requireAutoparksV2Api("vesture");
  if (!gate.ok) return gate.response;
  const summary = await resetAllAutoparksV2MainPhotos({ id: gate.actorId, name: gate.actorName });
  return autoparksV2Json({ ok: true, ...summary });
}
