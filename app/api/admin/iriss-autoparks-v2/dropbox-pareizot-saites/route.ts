import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { relinkKnownAutoparksV2Folders } from "@/lib/iriss-autoparks-dropbox-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * J36: VIENREIZĒJS trigeris - pārpiesaista zināmos Viano/V300d auto īstajām /STOCK mapēm (tikai
 * administrators - Nils/Andris). Droši palaist atkārtoti: maina tikai tad, ja auto šobrīd piesaistīts
 * tukšai mapei vai nav saistīts; citādi atgriež iemeslu katram VIN, bet neko nemaina. Skat. j36-REPORT.md.
 */
export async function POST() {
  const gate = await requireAutoparksV2Api("vesture");
  if (!gate.ok) return gate.response;
  const results = await relinkKnownAutoparksV2Folders(gate.actorName);
  return autoparksV2Json({ ok: true, results });
}
