import "server-only";

/**
 * j70: apstiprināta piedāvājuma sekas.
 * - Klients piesaistīts IRISS pasūtījumam -> šis pasūtījums kļūst «Rezervēts» (dublikāts netiek veidots).
 * - Bez piesaistes -> jauns pasūtījums ar statusu «Rezervēts» (klienta vārds/tālrunis no piedāvājuma vai apstiprinājuma formas).
 * Abos ierakstos savstarpējas saites: piedāvājumā `approvedOrderId`, pasūtījumā iekšējā piezīme ar saiti
 * (pasūtījuma lapā arī josla «Piedāvājumi»). Piedāvājums paliek sarakstā kā «Apstiprināts».
 * Kļūdas nekad neaptur klienta atbildi; neizdevušos pasūtījumu admins izveido ar pogu detaļā.
 */

import { appendIrissStatusHistory, isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { notifyIrissOfferDecision } from "@/lib/iriss-offer-notify";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { createIrissPasutijums, readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { appendIrissPdHistory, formatIrissPdPrice, splitIrissPdClientName } from "@/lib/iriss-piedavajumi";
import { irissPdNumberLabel, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/**
 * Darījuma statuss pēc klienta apstiprinājuma: vismaz «Piedāvāts» (gaida avansu); tālāku posmu nepazemina.
 * Audits 27.10: pasūtījums bija «Rezervēts», bet darījuma statuss palika «Jauns».
 */
export function irissDealStatusAfterApproval(current: string | undefined): string {
  const cur = (current ?? "").trim();
  return !cur || cur === "jauns" || cur === "meklejam" ? "piedavats" : cur;
}

export function irissPdAdminPath(id: string): string {
  return `/admin/iriss/piedavajumi/${encodeURIComponent(id)}`;
}

function orderNote(rec: IrissPiedavajums): string {
  return `Izveidots no piedāvājuma ${irissPdNumberLabel(rec.number)} (${irissPdAdminPath(rec.id)}).`;
}

async function reserveExistingOrder(orderId: string, rec: IrissPiedavajums, at: string, by: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order || isIrissRecordDeleted(order)) return false;
    if (order.listStatus === "reserved" || order.listStatus === "completed") return true;
    const next = appendIrissStatusHistory(order, "reserved", { at, by });
    next.dealWorkflowStatus = irissDealStatusAfterApproval(order.dealWorkflowStatus);
    const note = `Rezervēts pēc piedāvājuma ${irissPdNumberLabel(rec.number)} (${irissPdAdminPath(rec.id)}).`;
    next.internalNotes = [order.internalNotes.trim(), note].filter(Boolean).join("\n");
    const saved = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(order), historyBy: by });
    if (saved.ok) return true;
    if (!saved.stale) return false;
  }
  return false;
}

async function createReservedOrder(
  rec: IrissPiedavajums,
  at: string,
  by: string,
  contact: { name: string; phone: string },
): Promise<string> {
  const id = crypto.randomUUID();
  const base = emptyIrissPasutijums(id, at);
  const { first, last } = splitIrissPdClientName(rec.client.name || contact.name);
  const seed = appendIrissStatusHistory(
    {
      ...base,
      clientFirstName: first,
      clientLastName: last,
      phone: rec.client.phone || contact.phone,
      email: rec.client.email,
      brandModel: rec.vehicle.title,
      vin: rec.vehicle.vin,
      totalBudget: formatIrissPdPrice(rec.price).replace(/\s*€$/, ""),
      internalNotes: orderNote(rec),
      dealWorkflowStatus: irissDealStatusAfterApproval(base.dealWorkflowStatus),
    },
    "reserved",
    { at, by },
  );
  const res = await createIrissPasutijums(seed);
  return res.ok ? res.id : "";
}

/** Izveido/rezervē pasūtījumu un ieraksta vēsturē. Atgriež atjaunināto piedāvājumu (vēl nesaglabātu). */
export async function runIrissPdApprovalEffects(
  rec: IrissPiedavajums,
  opts: { at: string; by: string; contactName?: string; contactPhone?: string },
): Promise<IrissPiedavajums> {
  if (rec.approvedOrderId) return rec;
  let next = rec;
  try {
    if (rec.client.orderId && (await reserveExistingOrder(rec.client.orderId, rec, opts.at, opts.by))) {
      next = appendIrissPdHistory(
        { ...next, approvedOrderId: rec.client.orderId },
        { at: opts.at, by: opts.by, text: "Klienta pasūtījums pārslēgts uz «Rezervēts»" },
      );
    } else {
      const orderId = await createReservedOrder(rec, opts.at, opts.by, { name: opts.contactName ?? "", phone: opts.contactPhone ?? "" });
      next = orderId
        ? appendIrissPdHistory({ ...next, approvedOrderId: orderId }, { at: opts.at, by: opts.by, text: "Izveidots pasūtījums «Rezervēts»" })
        : appendIrissPdHistory(next, { at: opts.at, by: opts.by, text: "Pasūtījumu neizdevās izveidot - izveido ar pogu" });
    }
  } catch (e) {
    console.error("[iriss-piedavajumi] approve order", e instanceof Error ? e.message : e);
    next = appendIrissPdHistory(next, { at: opts.at, by: opts.by, text: "Pasūtījumu neizdevās izveidot - izveido ar pogu" });
  }
  return next;
}

/** Nilam e-pasts + push (tas pats kanāls kā pasūtījumu piedāvājumiem). Saite ved uz izveidoto pasūtījumu. */
export async function notifyIrissPdApproved(rec: IrissPiedavajums, contactName = ""): Promise<void> {
  const { first, last } = splitIrissPdClientName(rec.client.name || contactName);
  try {
    await notifyIrissOfferDecision(
      {
        orderId: rec.approvedOrderId || rec.client.orderId || "",
        offerId: rec.id,
        vehicle: `${irissPdNumberLabel(rec.number)} · ${rec.vehicle.title}`,
        vin: rec.vehicle.vin,
        clientFirstName: first,
        clientLastName: last,
        total: formatIrissPdPrice(rec.price),
        deadlineAt: "",
      },
      "approve",
      rec.decidedAt || new Date().toISOString(),
    );
  } catch (e) {
    console.error("[iriss-piedavajumi] notify", e instanceof Error ? e.message : e);
  }
}
