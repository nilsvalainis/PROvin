/**
 * Autoparks v2 kabineta cilnes (j63 / m03): CSDD reģistrs ir sava cilne, ne Pamatdatu karte.
 * `?t=` maršruts: pamatdati | csdd | iegade | serviss | izdevumi | cenu_lapa | vesture.
 */

import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";

export type CabinetTab = "pamatdati" | "csdd" | "iegade" | "serviss" | "izdevumi" | "cenu_lapa" | "vesture";
export type CabinetMainTab = Exclude<CabinetTab, "vesture">;
/** Cilnes, kas nāk no `CABINET_PANES` (CSDD un Pamatdati ir iebūvētas). */
export type CabinetPaneKey = Exclude<CabinetMainTab, "pamatdati" | "csdd">;

/** Cilnes: telefonā īsi (vietas dēļ), datorā pilni nosaukumi. */
export const CABINET_TAB_LABEL: Record<CabinetMainTab, { m: string; d: string }> = {
  pamatdati: { m: "Pamatdati", d: "Pamatdati" },
  csdd: { m: "CSDD reģistrs", d: "CSDD reģistrs" },
  iegade: { m: "Iegāde", d: "Iegādes dokumenti" },
  serviss: { m: "Serviss", d: "Serviss" },
  izdevumi: { m: "Izdevumi", d: "Citi izdevumi" },
  cenu_lapa: { m: "Cenu lapa", d: "Cenu lapa" },
};

export function allowedTabs(
  perms: AutoparksV2Perms,
  panes: Partial<Record<CabinetPaneKey, unknown>>,
): CabinetMainTab[] {
  const out: CabinetMainTab[] = [];
  if (perms.pamatdati) {
    out.push("pamatdati");
    out.push("csdd");
  }
  if (perms.iegade && panes.iegade) out.push("iegade");
  if (perms.serviss && panes.serviss) out.push("serviss");
  if (perms.izdevumi && panes.izdevumi) out.push("izdevumi");
  if (perms.cenuLapa && panes.cenu_lapa) out.push("cenu_lapa");
  return out;
}

export function resolveCabinetTab(
  want: string | null | undefined,
  tabs: readonly CabinetMainTab[],
  vesture: boolean,
): CabinetTab {
  if (want === "vesture" && vesture) return "vesture";
  if (want && (tabs as readonly string[]).includes(want)) return want as CabinetTab;
  return tabs[0] ?? "pamatdati";
}
