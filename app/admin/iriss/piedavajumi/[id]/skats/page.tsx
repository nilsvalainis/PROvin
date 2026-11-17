import "@/components/iriss-piedavajumi/piedavajumi.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import { requireAdminPage } from "@/lib/admin-auth";
import { readIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";

export const metadata = { title: "Piedāvājuma priekšskatījums | IRISS" };
export const dynamic = "force-dynamic";

/**
 * Nils 30.10: «opcija apskatīt priekšskatījumu ar visu saturu ... pirms sūtīt klientam linku».
 * Tieši tas, ko klients redz saitē (saites redzamības slēdži), no saglabātā ieraksta.
 */
export default async function IrissPiedavajumsPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!isSafeIrissPdId(id)) notFound();
  const rec = await readIrissPd(id);
  if (!rec) notFound();
  const view = buildIrissPdPublicView(rec, "link", Date.now());
  return (
    <div className="pdv">
      <div className="pd-preview-bar" role="note">
        <span>
          <b>Priekšskatījums</b> - tā klients redzēs saiti (saglabātā versija, bez apstiprināšanas pogas).
        </span>
        <Link className="pd-btn p" href={`/admin/iriss/piedavajumi/${id}`}>
          Atpakaļ uz piedāvājumu
        </Link>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <PdClientView
          view={{ ...view, state: "open" }}
          mode="link"
          embedded
          photoSrc={(n, s) => `/api/admin/iriss-piedavajumi/${id}/foto/${n}${s === "full" ? "?s=full" : ""}`}
        />
      </div>
    </div>
  );
}
