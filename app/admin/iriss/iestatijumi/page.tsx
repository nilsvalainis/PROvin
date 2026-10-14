import { IrissCompanySettingsClient } from "@/components/admin/IrissCompanySettingsClient";
import { settingsFormDefaults } from "@/lib/iriss-company-settings";
import { readIrissCompanySettings } from "@/lib/iriss-company-settings-store";

export const dynamic = "force-dynamic";

export default async function IrissCompanySettingsPage() {
  const settings = await readIrissCompanySettings();
  return (
    <div className="mx-auto w-full max-w-3xl pb-24 sm:pb-8">
      <IrissCompanySettingsClient initial={settingsFormDefaults(settings)} />
    </div>
  );
}
