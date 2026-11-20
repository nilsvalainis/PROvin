import "server-only";

/**
 * j70: apstiprināta piedāvājuma sekas.
 * - Klients piesaistīts IRISS pasūtījumam -> šis pasūtījums kļūst «Rezervēts» (dublikāts netiek veidots).
 * - Bez piesaistes -> jauns pasūtījums ar statusu «Rezervēts» (klienta vārds/tālrunis no piedāvājuma vai apstiprinājuma formas).
 * Abos ierakstos savstarpējas saites: piedāvājumā `approvedOrderId`, pasūtījumā iekšējā piezīme ar saiti
 * (pasūtījuma lapā arī josla «Piedāvājumi»). Piedāvājums paliek sarakstā kā «Apstiprināts».
 * Kļūdas nekad neaptur klienta atbildi; neizdevušos pasūtījumu admins izveido ar pogu detaļā.
 */

import { applyIrissOrderStage } from "@/lib/iriss-order-stage";
import { appendIrissStatusHistory, isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import {
  irissOfferCarIsConflict,
  irissOfferCarOutcomeOf,
  irissOfferCarReserveText,
  type IrissOfferCarReserveOutcome,
} from "@/lib/iriss-offer-car-conflict";
import { notifyIrissOfferCarConflict, notifyIrissOfferDecision, notifyIrissOfferQuestion } from "@/lib/iriss-offer-notify";
import type { IrissOfferNotifyFacts } from "@/lib/iriss-offer-notify-shared";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";
import { createIrissPasutijums, readIrissPasutijums, writeIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  appendIrissPdHistory,
  formatIrissPdPrice,
  splitIrissPdClientName,
} from "@/lib/iriss-piedavajumi";
import { irissPdNumberLabel, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

/**
 * Darījuma statuss pēc klienta apstiprinājuma: vismaz «Piedāvāts» (gaida avansu); tālāku posmu nepazemina.
 * Audits 27.10: pasūtījums bija «Rezervēts», bet darījuma statuss palika «Jauns».
 */
export function irissDealStatusAfterApproval(current: string | undefined): string {
  const cur = (current ?? "").trim();
  // P5: atcelts/nodots iepriekšējais darījums nedrīkst jaunu apstiprinājumu rādīt kā «Neaktīvs»/«Pārdots».
  return !cur || cur === "jauns" || cur === "meklejam" || cur === "atcelts" || cur === "nodots" ? "piedavats" : cur;
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
  return reserveSourceCar(next, opts);
}

/** Autoparka auto id no piedāvājuma avota (`autoparks:ID`); citiem avotiem - tukšs. */
export function irissPdAutoparksCarId(sourceRef: string): string {
  const m = sourceRef.match(/^autoparks:([\w-]{1,80})$/);
  return m ? m[1]! : "";
}

/**
 * Nils 27.10 + audits 20.11: klienta apstiprināts piedāvājums ar Autoparka auto -> auto «Rezervēts».
 * Kopīga jaunajam PD un vecajai formai (/p/[token]). Ja auto jau «Rezervēts» vai «Pārdots» - rezervācija netiek
 * veikta, adminam push (klientam nekas netiek sūtīts). Kļūdas nekad neaptur klienta atbildi.
 */
export async function reserveAutoparksCarForApprovedOffer(
  carId: string,
  notify: { offerId: string; label: string; vehicle: string; vin: string; adminPath: string },
): Promise<IrissOfferCarReserveOutcome> {
  let outcome: IrissOfferCarReserveOutcome;
  try {
    const { reserveAutoparksCarAfterOffer } = await import("@/lib/iriss-autoparks-v2-store");
    outcome = irissOfferCarOutcomeOf(await reserveAutoparksCarAfterOffer(carId, { id: "pd", name: notify.label }));
  } catch (e) {
    console.error("[iriss-offer-car] reserve autoparks", e instanceof Error ? e.message : e);
    outcome = "error";
  }
  if (irissOfferCarIsConflict(outcome)) {
    await notifyIrissOfferCarConflict(notify, outcome);
  }
  return outcome;
}

async function reserveSourceCar(rec: IrissPiedavajums, opts: { at: string; by: string }): Promise<IrissPiedavajums> {
  const carId = irissPdAutoparksCarId(rec.sourceRef);
  if (!carId) return rec;
  const label = irissPdNumberLabel(rec.number);
  const outcome = await reserveAutoparksCarForApprovedOffer(carId, {
    offerId: rec.id,
    label: `Piedāvājums ${label}`,
    vehicle: `${label} · ${rec.vehicle.title}`,
    vin: rec.vehicle.vin,
    adminPath: irissPdAdminPath(rec.id),
  });
  return appendIrissPdHistory(rec, { at: opts.at, by: opts.by, text: irissOfferCarReserveText(outcome) });
}

/* ---------------- Darījuma atcelšana (Nils 20.11, audits 1) ---------------- */

/** Pasūtījums «Rezervēts» -> «Aktīvs» (tikai, ja joprojām rezervēts; izpildītu / citu statusu nepārraksta). */
async function releaseOrder(orderId: string, rec: IrissPiedavajums, at: string, by: string): Promise<"released" | "skipped" | "failed"> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const order = await readIrissPasutijums(orderId);
    if (!order || isIrissRecordDeleted(order)) return "skipped";
    if (order.listStatus !== "reserved") return "skipped";
    // P5 (3A): atcelts PD -> pats atpakaļ «Meklējam» (arī darījuma lauks, citādi paliktu «Piedāvāts»).
    const next = applyIrissOrderStage(order, "searching", { at, by });
    const note = `Darījums atcelts (piedāvājums ${irissPdNumberLabel(rec.number)}, ${irissPdAdminPath(rec.id)}) - atpakaļ «Meklējam».`;
    next.internalNotes = [order.internalNotes.trim(), note].filter(Boolean).join("\n");
    const saved = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(order), historyBy: by });
    if (saved.ok) return "released";
    if (!saved.stale) return "failed";
  }
  return "failed";
}

/**
 * Atceltā PD sekas: pasūtījums atpakaļ «Aktīvs», Autoparka auto atpakaļ «Pārdošanā» (ja to rezervēja šis PD un tas
 * joprojām «Rezervēts»). Katrs solis vēsturē; kļūda neaptur atcelšanu (vēsturē - ko iestatīt ar roku).
 */
export async function runIrissPdCancelEffects(
  rec: IrissPiedavajums,
  opts: { at: string; by: string; carWasReserved: boolean },
): Promise<IrissPiedavajums> {
  let next = rec;
  const note = (text: string) => {
    next = appendIrissPdHistory(next, { at: opts.at, by: opts.by, text });
  };
  if (rec.approvedOrderId) {
    try {
      const r = await releaseOrder(rec.approvedOrderId, rec, opts.at, opts.by);
      if (r === "released") note("Pasūtījums atgriezts «Aktīvs»");
      else if (r === "failed") note("Pasūtījumu neizdevās atgriezt «Aktīvs» - iestati ar roku");
    } catch (e) {
      console.error("[iriss-piedavajumi] cancel order", e instanceof Error ? e.message : e);
      note("Pasūtījumu neizdevās atgriezt «Aktīvs» - iestati ar roku");
    }
  }
  const carId = irissPdAutoparksCarId(rec.sourceRef);
  if (carId && opts.carWasReserved) {
    try {
      const { releaseAutoparksCarAfterOfferCancel } = await import("@/lib/iriss-autoparks-v2-store");
      const res = await releaseAutoparksCarAfterOfferCancel(carId, { id: "pd", name: `Piedāvājums ${irissPdNumberLabel(rec.number)}` });
      if (res.ok) note("Autoparka auto atgriezts «Pārdošanā»");
      else if (res.reason === "not_reserved" || res.reason === "conflict") note("Autoparka auto atgriezts netika - statuss jau mainīts ar roku");
    } catch (e) {
      console.error("[iriss-piedavajumi] cancel autoparks", e instanceof Error ? e.message : e);
      note("Autoparka auto neizdevās atgriezt «Pārdošanā» - iestati ar roku");
    }
  }
  return next;
}

/** Paziņojuma fakti (bez klienta kontaktiem pushā - tos nerāda bloķētajā ekrānā). */
export function irissPdNotifyFacts(rec: IrissPiedavajums, contactName = "", opts: { pdLink?: boolean; reason?: string } = {}): IrissOfferNotifyFacts {
  const { first, last } = splitIrissPdClientName(rec.client.name || contactName);
  return {
    orderId: rec.approvedOrderId || rec.client.orderId || "",
    offerId: rec.id,
    vehicle: `${irissPdNumberLabel(rec.number)} · ${rec.vehicle.title}`,
    vin: rec.vehicle.vin,
    clientFirstName: first,
    clientLastName: last,
    total: formatIrissPdPrice(rec.price),
    deadlineAt: "",
    ...(opts.pdLink ? { adminPath: irissPdAdminPath(rec.id) } : {}),
    ...(opts.reason ? { reason: opts.reason } : {}),
  };
}

/** Nilam e-pasts + push (tas pats kanāls kā pasūtījumu piedāvājumiem). Saite ved uz izveidoto pasūtījumu. */
export async function notifyIrissPdApproved(rec: IrissPiedavajums, contactName = ""): Promise<void> {
  try {
    await notifyIrissOfferDecision(irissPdNotifyFacts(rec, contactName), "approve", rec.decidedAt || new Date().toISOString());
  } catch (e) {
    console.error("[iriss-piedavajumi] notify", e instanceof Error ? e.message : e);
  }
}

/** Klients noraidīja saitē: Nilam e-pasts (ar iemeslu) + push; saite uz piedāvājumu. */
export async function notifyIrissPdDeclined(rec: IrissPiedavajums, reason: string): Promise<void> {
  try {
    await notifyIrissOfferDecision(irissPdNotifyFacts(rec, "", { pdLink: true, reason }), "decline", rec.decidedAt || new Date().toISOString());
  } catch (e) {
    console.error("[iriss-piedavajumi] notify decline", e instanceof Error ? e.message : e);
  }
}

/** Klienta jautājums saitē: Nilam e-pasts (ar jautājumu) + push; saite uz piedāvājumu. Klientam nekas netiek sūtīts. */
export async function notifyIrissPdQuestion(rec: IrissPiedavajums, question: string): Promise<void> {
  try {
    await notifyIrissOfferQuestion(irissPdNotifyFacts(rec, "", { pdLink: true }), question);
  } catch (e) {
    console.error("[iriss-piedavajumi] notify question", e instanceof Error ? e.message : e);
  }
}
