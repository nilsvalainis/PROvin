import { AdminAuditKnowledgePanel } from "@/components/admin/AdminAuditKnowledgePanel";
import { AdminAuditKnowledgePanelV2 } from "@/components/admin/AdminAuditKnowledgePanelV2";
import { requireAdminPage } from "@/lib/admin-auth";
import { isTrainingV2Enabled } from "@/lib/feature-flags-v2";

export const metadata = {
  title: "Agregātu zināšanas",
};

export const dynamic = "force-dynamic";

export default async function AdminAgregatuZinasanasPage() {
  await requireAdminPage();
  const trainingV2 = isTrainingV2Enabled();
  return (
    <div className={`w-full space-y-4 max-md:px-4 ${trainingV2 ? "max-w-5xl" : "max-w-3xl"}`}>
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-apple-text)] max-md:text-[34px] max-md:font-bold max-md:leading-none">
          Agregātu zināšanas
        </h1>
        {trainingV2 ? (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
              Apstiprinātās zināšanas AI lieto kā faktus. Kandidāti no nosūtītām atskaitēm gaida tavu
              apstiprinājumu. Noraidītie kļūst par sarakstu „Nepareizi apgalvojumi”.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-[var(--color-apple-text)]">
              <li>
                <strong className="font-semibold">Nolasīt vecās atskaites</strong> - iziet cauri nosūtītajām
                atskaitēm un sagatavo mācību teikumus (kandidātus).
              </li>
              <li>
                <strong className="font-semibold">Gaida apstiprinājumu</strong> - apstiprini, labo vai noraidi
                (+ iemesls).
              </li>
              <li>
                <strong className="font-semibold">Ko AI zina</strong> - apstiprinātās zināšanas pa agregātiem.
              </li>
            </ol>
          </>
        ) : (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
              Šeit aģents iemācās no jau saglabātajiem auditiem (motori, kārbas, tipiskās kaites) un saglabā
              iekšējo atmiņu nākamajiem ✨. Nav jāraksta koda vai konzoles komandas - nospied pogas zemāk.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-[var(--color-apple-text)]">
              <li>
                <strong className="font-semibold">Iemācīties no vēstures</strong> - iziet cauri līdz ~120
                pasūtījumiem un pieraksta anonimizētus fragmentus.
              </li>
              <li>
                <strong className="font-semibold">Sagatavot kandidātus</strong> - izveido īsu sarakstu, ko
                pēc tam var pārvērst par cieto paku (piem. OM654).
              </li>
            </ol>
          </>
        )}
      </div>
      {trainingV2 ? <AdminAuditKnowledgePanelV2 /> : <AdminAuditKnowledgePanel />}
    </div>
  );
}
