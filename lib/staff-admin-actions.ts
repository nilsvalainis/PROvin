import type { StaffStatus } from "@/lib/staff-types";

export type StaffAdminActionId =
  | "revoke_sessions"
  | "reset_password"
  | "revoke"
  | "restore"
  | "delete";

/** Pogas Darbinieki kartītē: atsauktajam nav reset (accept-invite to noraidītu). */
export function staffUserAdminActions(status: StaffStatus): StaffAdminActionId[] {
  if (status === "revoked") return ["restore", "delete"];
  return ["revoke_sessions", "reset_password", "revoke", "delete"];
}

export function staffResetPasswordLabel(status: StaffStatus): string {
  return status === "invited" ? "Nosūtīt saiti vēlreiz" : "Atiestatīt paroli";
}

export function staffResetPasswordConfirm(name: string, email: string, status: StaffStatus): string {
  if (status === "invited") {
    return `Nosūtīt jaunu uzaicinājuma saiti (24 h) uz ${email}? Iepriekšējā saite vairs nederēs.`;
  }
  return `Atiestatīt paroli ${name}? Vecā parole vairs nederēs. Nosūtīsim jaunu saiti (24 h) uz ${email}.`;
}

export function staffDeleteUserConfirm(name: string, email: string): string {
  return `Dzēst ${name} pavisam? E-pastu ${email} varēs uzaicināt no jauna. Šo nevar atsaukt.`;
}
