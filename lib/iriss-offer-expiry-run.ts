import "server-only";

/**
 * Cron (reizi 15 min): push Nilam, ja piedāvājuma termiņš beidzies bez klienta atbildes.
 * Tikai push, bez e-pasta (Nila lēmums 23.10 21:01). Viens paziņojums par katru termiņu.
 * Nekas pasūtījumā netiek rakstīts.
 */

import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";
import {
  claimIrissOfferExpiryNotice,
  listIrissOfferDeadlines,
  readIrissOfferClaimedDecision,
  readIrissOfferClientLinkByHash,
  registerIrissOfferDeadline,
  removeIrissOfferDeadline,
} from "@/lib/iriss-offer-client-link-store";
import { irissOfferNotifyFacts, notifyIrissOfferExpired } from "@/lib/iriss-offer-notify";
import { normalizeOfferValidUntilAt } from "@/lib/iriss-offer-valid-until";

/** Vecākus par šo termiņus vairs neziņo (piem., ja cron ilgi nav strādājis). */
const MAX_LATE_MS = 7 * 24 * 60 * 60 * 1000;

export type IrissOfferExpiryRunResult = { checked: number; notified: number; removed: number; pushes: number };

export async function runIrissOfferExpiryNotices(nowMs = Date.now()): Promise<IrissOfferExpiryRunResult> {
  const result: IrissOfferExpiryRunResult = { checked: 0, notified: 0, removed: 0, pushes: 0 };
  const entries = await listIrissOfferDeadlines();
  for (const entry of entries) {
    const deadlineMs = Date.parse(entry.deadlineAt);
    if (deadlineMs > nowMs) continue;
    result.checked += 1;
    const drop = async () => {
      await removeIrissOfferDeadline(entry.hash);
      result.removed += 1;
    };
    const link = await readIrissOfferClientLinkByHash(entry.hash);
    if (!link || link.revokedAt || link.decision || link.orderId !== entry.orderId || link.offerId !== entry.offerId) {
      await drop();
      continue;
    }
    if (await readIrissOfferClaimedDecision(entry.hash)) {
      await drop();
      continue;
    }
    const order = await readIrissPasutijums(entry.orderId);
    const offer = order && !isIrissRecordDeleted(order) ? order.offers.find((o) => o.id === entry.offerId) : undefined;
    if (!order || !offer) {
      await drop();
      continue;
    }
    const current = normalizeOfferValidUntilAt(offer.validUntilAt);
    if (current && current !== entry.deadlineAt && Date.parse(current) > nowMs) {
      // Termiņš pagarināts - gaidām jauno.
      await registerIrissOfferDeadline({ ...entry, deadlineAt: current });
      continue;
    }
    if (nowMs - deadlineMs <= MAX_LATE_MS && (await claimIrissOfferExpiryNotice(entry.hash, entry.deadlineAt))) {
      result.notified += 1;
      result.pushes += await notifyIrissOfferExpired(irissOfferNotifyFacts(order, offer));
    }
    await drop();
  }
  return result;
}
