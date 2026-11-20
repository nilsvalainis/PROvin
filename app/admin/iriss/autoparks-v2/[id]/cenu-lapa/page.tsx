import "../../autoparks-v2.css";
import { notFound, redirect } from "next/navigation";
import { A4Sheet } from "@/components/admin/iriss-autoparks-v2/A4Sheet";
import { PrintButton } from "@/components/admin/iriss-autoparks-v2/PrintButton";
import { autoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { getAutoparksV2PageActor } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { readAutoparksV2Car } from "@/lib/iriss-autoparks-v2-store";

export const metadata = { title: "Cenu lapa | IRISS" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** "Priekšskatīt A4": cenu lapa A4 formātā drukai / PDF saglabāšanai no pārlūka. */
export default async function AutoparksV2PriceSheetPage({ params }: Props) {
  const access = await getAutoparksV2PageActor();
  if (!access?.perms.cenuLapa) redirect("/admin/iriss");
  const { id } = await params;
  const found = await readAutoparksV2Car(id);
  if (!found) notFound();
  const sheet = autoparksV2PriceSheet(found.car, found.v2, autoparksV2Basics(found.car, found.v2));
  // 20.11 audits: tiešā saite pārdotam auto bez manuālas stāvokļa izvēles - pārdošanas lapu nedrukā.
  if (sheet.sold) {
    return (
      <div className="ap2 ap2-print">
        <div className="ap2-card" data-testid="cl-sold-page">
          <h3>Auto pārdots</h3>
          <p>
            <a className="ap2-btn sm" href={`/admin/iriss/autoparks-v2/${encodeURIComponent(id)}`}>
              Atpakaļ uz auto
            </a>
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="ap2 ap2-print">
      <PrintButton />
      <A4Sheet s={sheet} />
    </div>
  );
}
