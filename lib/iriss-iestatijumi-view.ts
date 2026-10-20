import { formatMarketplaceUsd } from "@/lib/marketplace/cost-caps";
import type { IrissTameCommissionRates } from "@/lib/iriss-tame-commission";

export const IRISS_SETTINGS_LOAD_ERROR = "Neizdevās ielādēt saglabātās likmes. Rāda noklusējumu.";
export const IRISS_SETTINGS_SAVE_BUSY = "Saglabā...";
export const IRISS_SETTINGS_SAVE_OK = "Saglabāts.";
export const IRISS_SETTINGS_SAVE_FAIL = "Saglabāšana neizdevās.";
export const IRISS_SETTINGS_DIRTY = "Nesaglabātas izmaiņas";
export const IRISS_SETTINGS_CANCEL = "Atcelt";
export const IRISS_SETTINGS_SAVE = "Saglabāt";
export const IRISS_SETTINGS_GOOGLE_EMAIL = "info@provin.lv";
export const IRISS_SETTINGS_GOOGLE_HINT =
  "Piesaista IRISS pasūtījumu klientus. Esošos kontaktus nepārraksta.";
export const IRISS_SETTINGS_GOOGLE_SYNC = "Sinhronizēt klientus";
export const IRISS_SETTINGS_LIMITS_HINT =
  "Mainās tikai servera iestatījumos. Katru ielādi apstiprina atsevišķi.";
export const IRISS_SETTINGS_LOADS_ON = "Ielāde ieslēgta";
export const IRISS_SETTINGS_LOADS_OFF = "Ielāde izslēgta (izmaksu kontrole)";

const LV_MONTH_LOCATIVE: readonly string[] = [
  "janvārī",
  "februārī",
  "martā",
  "aprīlī",
  "maijā",
  "jūnijā",
  "jūlijā",
  "augustā",
  "septembrī",
  "oktobrī",
  "novembrī",
  "decembrī",
];

export const IRISS_SETTINGS_COMMISSION_FIELDS = [
  { key: "variantANet", label: "A variants", unit: "EUR neto" },
  { key: "variantBBaseNet", label: "B variants, bāze", unit: "EUR neto" },
  { key: "variantBLoanPercent", label: "B variants, no atlikuma", unit: "%" },
] as const;

export type IrissSettingsCommissionFieldKey = (typeof IRISS_SETTINGS_COMMISSION_FIELDS)[number]["key"];

export type IrissSettingsLimitsView = {
  monthlyCapLabel: string;
  perRunCapLabel: string;
  spentLabel: string;
  spentValue: string;
  loadsEnabled: boolean;
  loadsStatus: string;
};

export function formatIrissSettingsSpentMonth(monthKey: string): string {
  const month = Number((monthKey ?? "").slice(5, 7));
  const loc = LV_MONTH_LOCATIVE[month - 1] ?? "";
  return loc ? `Izlietots ${loc}` : "Izlietots";
}

export function buildIrissSettingsLimitsView(input: {
  monthlyCapUsd: number;
  perRunCapUsd: number;
  spentUsd: number;
  loadsEnabled: boolean;
  monthKey: string;
}): IrissSettingsLimitsView {
  return {
    monthlyCapLabel: formatMarketplaceUsd(input.monthlyCapUsd),
    perRunCapLabel: formatMarketplaceUsd(input.perRunCapUsd),
    spentLabel: formatIrissSettingsSpentMonth(input.monthKey),
    spentValue: formatMarketplaceUsd(input.spentUsd),
    loadsEnabled: input.loadsEnabled,
    loadsStatus: input.loadsEnabled ? IRISS_SETTINGS_LOADS_ON : IRISS_SETTINGS_LOADS_OFF,
  };
}

export function irissSettingsDirtyFieldLabels(
  saved: IrissTameCommissionRates,
  draft: IrissTameCommissionRates,
): string[] {
  return IRISS_SETTINGS_COMMISSION_FIELDS.filter((field) => saved[field.key] !== draft[field.key]).map(
    (field) => field.label,
  );
}

export function irissSettingsDirtyDockTitle(labels: readonly string[]): string {
  if (labels.length === 1) return `${IRISS_SETTINGS_DIRTY} · ${labels[0]}`;
  return IRISS_SETTINGS_DIRTY;
}

export function irissSettingsCommissionDirty(
  saved: IrissTameCommissionRates,
  draft: IrissTameCommissionRates,
): boolean {
  return irissSettingsDirtyFieldLabels(saved, draft).length > 0;
}
