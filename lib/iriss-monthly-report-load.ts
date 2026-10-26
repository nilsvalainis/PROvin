import "server-only";

import { shiftYearMonth } from "@/lib/admin-riga-calendar";
import { buildIrissMonthlyReport, type IrissMonthlyReport } from "@/lib/iriss-monthly-report";
import {
  getIrissPasutijumiStorageState,
  listIrissPasutijumi,
  readIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";

export type IrissMonthlyReportLoad = {
  report: IrissMonthlyReport;
  previous: IrissMonthlyReport;
  storeEnabled: boolean;
  loadError: string | null;
};

/**
 * Single-tenant IRISS pasūtījumu mēneša atskaite.
 * TODO(multi-tenant): lasīt tikai tekošā dīlera tenantId ierakstus.
 */
export async function loadIrissMonthlyReport(year: number, month: number): Promise<IrissMonthlyReportLoad> {
  const storage = getIrissPasutijumiStorageState();
  const prev = shiftYearMonth(year, month, -1);
  if (!storage.enabled) {
    return {
      report: buildIrissMonthlyReport([], year, month),
      previous: buildIrissMonthlyReport([], prev.year, prev.month),
      storeEnabled: false,
      loadError: null,
    };
  }

  try {
    const rows = await listIrissPasutijumi();
    const records = (
      await Promise.all(rows.map((row) => readIrissPasutijums(row.id, { allowCache: true })))
    ).filter((rec): rec is NonNullable<typeof rec> => Boolean(rec));
    return {
      report: buildIrissMonthlyReport(records, year, month),
      previous: buildIrissMonthlyReport(records, prev.year, prev.month),
      storeEnabled: true,
      loadError: null,
    };
  } catch (e) {
    return {
      report: buildIrissMonthlyReport([], year, month),
      previous: buildIrissMonthlyReport([], prev.year, prev.month),
      storeEnabled: true,
      loadError: e instanceof Error ? e.message : "Neizdevās ielādēt IRISS pasūtījumus.",
    };
  }
}
