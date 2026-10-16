import { AdminAuditKnowledgePanel } from "@/components/admin/AdminAuditKnowledgePanel";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Agregātu zināšanas",
};

export const dynamic = "force-dynamic";

export default async function AdminAgregatuZinasanasPage() {
  await requireAdminPage();
  return (
    <div className="w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-apple-text)] max-md:text-[34px] max-md:font-bold max-md:leading-none">
          Agregātu zināšanas
        </h1>
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
      </div>
      <AdminAuditKnowledgePanel />
    </div>
  );
}
