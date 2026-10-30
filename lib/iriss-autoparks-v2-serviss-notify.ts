/**
 * Nils 27.10: paziņojums tikai Nilam (administratoram), kad Servisā ierakstu vai dokumentu pievieno kāds cits.
 * Tīra loģika (kad un ko sūtīt); sūtīšana - `sendAdminPush` maršrutos.
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";

export type ServissAddition = "invoice" | "manual_invoice" | "problem" | "problem_photo";

const WHAT_LV: Record<ServissAddition, string> = {
  invoice: "pievienoja servisa rēķinu",
  manual_invoice: "ievadīja servisa rēķina summu",
  problem: "pievienoja problēmu",
  problem_photo: "pievienoja problēmas foto",
};

/** Ko pievienoja PATCH ķermenis (labojumi, atzīmes un dzēšana paziņojumu nerada). */
export function servissPatchAddition(body: Record<string, unknown>): ServissAddition | null {
  if (body.addInvoice && typeof body.addInvoice === "object") return "manual_invoice";
  const p = body.problem;
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    if (!o.id && !o.remove && typeof o.text === "string" && o.text.trim()) return "problem";
  }
  return null;
}

export function servissScanAddition(target: string): ServissAddition | null {
  if (target === "invoice" || target === "invoice_page") return "invoice";
  if (target === "problem_photo") return "problem_photo";
  return null;
}

/** Tikai, ja to izdarīja darbinieks (administratora paša darbības netiek ziņotas). */
export function servissPushMessage(input: {
  actorKind: "admin" | "staff";
  actorName: string;
  carId: string;
  what: ServissAddition | null;
}): AdminPushMessage | null {
  if (input.actorKind !== "staff" || !input.what) return null;
  return {
    title: "Serviss",
    body: `${input.actorName || "Kolēģis"} ${WHAT_LV[input.what]}`,
    url: `/admin/iriss/autoparks-v2/${encodeURIComponent(input.carId)}?t=serviss`,
    tag: `serviss-${input.carId}`,
    audience: "pro",
  };
}
