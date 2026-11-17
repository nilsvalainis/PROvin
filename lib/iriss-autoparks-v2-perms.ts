/**
 * Autoparks v2 tiesības (tīra loģika, bez servera atkarībām - testējama).
 * Deny-by-default: darbiniekam tikai atzīmētās `ap_*` apakštiesības un tikai, ja v2 ieslēgts darbiniekiem.
 */
import type { IrissSection } from "@/lib/staff-roles";

export type AutoparksV2Category = "pamatdati" | "iegade" | "serviss" | "izdevumi" | "cenu_lapa";

export type AutoparksV2Perms = {
  admin: boolean;
  pamatdati: boolean;
  iegade: boolean;
  serviss: boolean;
  izdevumi: boolean;
  cenuLapa: boolean;
  /** Redz/ievada summas (servisa rēķinu summa, izdevumi, iepirkuma cena). */
  summas: boolean;
  /** Pašizmaksa = Iegāde + Summas. */
  pasizmaksa: boolean;
  /** Vēsture - tikai administrators. */
  vesture: boolean;
};

export type AutoparksV2PermActor = { kind: "admin" } | { kind: "staff"; sections: readonly IrissSection[] };

const NONE: AutoparksV2Perms = {
  admin: false,
  pamatdati: false,
  iegade: false,
  serviss: false,
  izdevumi: false,
  cenuLapa: false,
  summas: false,
  pasizmaksa: false,
  vesture: false,
};

export function autoparksV2PermsFor(actor: AutoparksV2PermActor, staffEnabled: boolean): AutoparksV2Perms {
  if (actor.kind === "admin") {
    return { admin: true, pamatdati: true, iegade: true, serviss: true, izdevumi: true, cenuLapa: true, summas: true, pasizmaksa: true, vesture: true };
  }
  if (!staffEnabled) return { ...NONE };
  const has = (s: IrissSection) => actor.sections.includes(s);
  const iegade = has("ap_iegade");
  const summas = has("ap_summas");
  return {
    ...NONE,
    pamatdati: has("ap_pamatdati"),
    iegade,
    serviss: has("ap_serviss"),
    izdevumi: has("ap_izdevumi"),
    cenuLapa: has("ap_cenu_lapa"),
    summas,
    pasizmaksa: iegade && summas,
  };
}

export function autoparksV2CanCategory(perms: AutoparksV2Perms, category: AutoparksV2Category): boolean {
  if (category === "cenu_lapa") return perms.cenuLapa;
  return perms[category];
}

/** Vai lapu vispār var atvērt (vismaz viena kategorija). */
export function autoparksV2CanOpen(perms: AutoparksV2Perms): boolean {
  return perms.pamatdati || perms.iegade || perms.serviss || perms.izdevumi || perms.cenuLapa;
}
