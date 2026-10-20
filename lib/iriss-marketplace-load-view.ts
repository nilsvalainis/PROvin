import { formatMarketplaceUsd } from "@/lib/marketplace/cost-caps";

export const IRISS_LOAD_TITLE = "Tirgus ielāde";
export const IRISS_LOAD_BUTTON = "Ielādēt";
export const IRISS_LOAD_BUSY = "Ielādē...";
export const IRISS_LOAD_FAIL = "Ielāde neizdevās.";
export const IRISS_LOAD_OFF = "Ielāde izslēgta (izmaksu kontrole)";
export const IRISS_LOAD_FIX = "Labot kritērijus";
export const IRISS_LOAD_ASSUMPTIONS = "Izmaksu pieņēmumi";

const LV_MONTH_LOCATIVE: readonly string[] = [
  "Janvārī",
  "Februārī",
  "Martā",
  "Aprīlī",
  "Maijā",
  "Jūnijā",
  "Jūlijā",
  "Augustā",
  "Septembrī",
  "Oktobrī",
  "Novembrī",
  "Decembrī",
];

export type IrissMarketplaceLoadTone = "off" | "missing" | "limit" | "warn" | "ready" | "busy" | "done" | "error";

export function formatIrissLoadMonthSpent(monthKey: string, usedUsd: number, capUsd: number): string {
  const month = Number((monthKey ?? "").slice(5, 7));
  const loc = LV_MONTH_LOCATIVE[month - 1] ?? "";
  const used = formatMarketplaceUsd(usedUsd).replace(" $", "");
  const cap = formatMarketplaceUsd(capUsd);
  return loc ? `${loc} ${used} / ${cap}` : `${used} / ${cap}`;
}

export function formatIrissLoadEstimateLine(estimatedUsd: number, perRunCapUsd: number): string {
  return `Aplēse ~${formatMarketplaceUsd(estimatedUsd)} · griesti ${formatMarketplaceUsd(perRunCapUsd)} ielādei`;
}

export function formatIrissLoadConfirmButton(estimatedUsd: number): string {
  return `Ielādēt par ~${formatMarketplaceUsd(estimatedUsd)}`;
}

export function irissMarketplaceLoadTone(input: {
  loadsOff: boolean;
  missing: boolean;
  overLimit: boolean;
  warning80: boolean;
  busy: boolean;
  done: boolean;
  error: boolean;
}): IrissMarketplaceLoadTone {
  if (input.busy) return "busy";
  if (input.loadsOff) return "off";
  if (input.missing) return "missing";
  if (input.overLimit) return "limit";
  if (input.error) return "error";
  if (input.done) return "done";
  if (input.warning80) return "warn";
  return "ready";
}
