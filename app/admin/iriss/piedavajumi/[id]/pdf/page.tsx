import "@/components/iriss-piedavajumi/piedavajumi.css";
import { notFound } from "next/navigation";
import { PdPrintTrigger } from "@/components/admin/iriss-piedavajumi/PdPrintTrigger";
import { PdClientView } from "@/components/iriss-piedavajumi/PdClientView";
import { buildIrissPdPublicView } from "@/lib/iriss-piedavajumi";
import { requireAdminPage } from "@/lib/admin-auth";
import { readIrissPd } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdId } from "@/lib/iriss-piedavajumi-types";

export const metadata = { title: "Piedāvājums PDF | IRISS" };
export const dynamic = "force-dynamic";

/**
 * Klienta PDF: tas pats klienta skats ar PDF redzamības slēdžiem; pārlūka «Drukāt -> Saglabāt kā PDF».
 * Drukā redzams tikai `.pdc-print` (sānjosla un admin rāmis paslēpti).
 */
export default async function IrissPiedavajumsPdfPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!isSafeIrissPdId(id)) notFound();
  const rec = await readIrissPd(id);
  if (!rec) notFound();
  const view = buildIrissPdPublicView(rec, "pdf", Date.now());
  return (
    <div className="pdv">
      <PdPrintTrigger backHref={`/admin/iriss/piedavajumi/${id}`} />
      <div className="pdc-print" style={{ maxWidth: 760 }}>
        <PdClientView
          view={{ ...view, state: "open" }}
          mode="pdf"
          embedded
          photoSrc={(n, s) => `/api/admin/iriss-piedavajumi/${id}/foto/${n}${s === "full" ? "?s=full" : ""}`}
        />
      </div>
    </div>
  );
}
