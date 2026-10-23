/**
 * Paziņojums telefonā, kad pavadzīme izdota vai neizdevās (teksti: ~/pz-teksti.md 6. sadaļa).
 * Tīra loģika; sūta lib/iriss-waybill-requests-store.ts caur sendAdminPush tikai pieprasītāja ierīcēm.
 */
import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { waybillEndsLabel } from "@/lib/iriss-waybill-calendar";
import { compactDealerPlate, displayDealerPlate, formatRigaDateTimeComma } from "@/lib/iriss-waybill-plates";
import {
  isStaleWaybillRequest,
  waybillPendingExpired,
  type WaybillRequest,
  type WaybillRequestStatus,
} from "@/lib/iriss-waybill-requests";

export const WAYBILL_PUSH_URL = "/admin/iriss/pavadzimes";

/** Kļūda pēc "Saglabāt": CSDD pavadzīme var jau būt izveidota (worker teksts "Pārbaudi CSDD"). */
export function waybillErrorNeedsCheck(errorReason: string): boolean {
  return /pārbaudi csdd/i.test(errorReason);
}

/** Pieprasītāja ierīces (tā pati atslēga kā adminPushUserKey). */
export function waybillPushUserKey(createdBy: string): string {
  return createdBy === "env-admin" ? "admin" : `staff:${createdBy}`;
}

/** Ziņa tikai, kad statuss tikko kļuva par Izdota vai Kļūda. */
export function waybillPushMessage(
  before: Pick<WaybillRequest, "status">,
  after: Pick<WaybillRequest, "id" | "status" | "vehicle" | "validUntil" | "errorReason">,
): AdminPushMessage | null {
  const changed = (s: WaybillRequestStatus) => after.status === s && before.status !== s;
  const car = after.vehicle.brandModel.trim() || "Auto";
  const plate = displayDealerPlate(after.vehicle.plate) || after.vehicle.plate;
  const head = [car, plate].filter(Boolean).join(" · ");
  const base = { url: WAYBILL_PUSH_URL, tag: `waybill-${after.id}`, audience: "iriss" as const };
  if (changed("issued")) {
    const until = formatRigaDateTimeComma(after.validUntil);
    return {
      ...base,
      title: "Pavadzīme izdota",
      body: `${head}${until ? ` · derīga līdz ${until}` : ""}. Atver PDF.`,
    };
  }
  if (changed("error")) {
    const reason = after.errorReason.trim().slice(0, 120);
    if (waybillErrorNeedsCheck(reason)) {
      return { ...base, title: "Pārbaudi pavadzīmi", body: `${head}: iespējams, CSDD jau ir izveidota. Pārbaudi, pirms atkārto.` };
    }
    return {
      ...base,
      title: "Pavadzīme nav izdota",
      body: `${head}${reason ? `: ${reason}` : ""}. Atver un spied "Atkārtot".`,
    };
  }
  return null;
}

/** PN-SOON: atlikušas 24 h vai mazāk (tikai pavadzīmēm, kas izdotas ilgāk par 24 h - citādi ziņa nāktu uzreiz). */
export const WAYBILL_PUSH_SOON_MS = 24 * 60 * 60 * 1000;
/** PN-LONGWAIT: Gaida ilgāk par 15 min (tas pats slieksnis kā "Gaida ilgāk nekā parasti" telefona sarakstā). */
export const WAYBILL_PUSH_LONG_WAIT_MS = 15 * 60 * 1000;
/** PN-EXPIRED sūta tikai svaigi beigušām (pēc ilgāka pārtraukuma vecas ziņas vairs nesūta). */
export const WAYBILL_PUSH_EXPIRED_WINDOW_MS = 6 * 60 * 60 * 1000;

export type WaybillReminderKind = "soon" | "expired" | "longwait";

export type WaybillReminder = {
  /** Dedupe atslēga (viena ziņa katram gadījumam). */
  key: string;
  kind: WaybillReminderKind;
  requestId: string;
  userKey: string;
  message: AdminPushMessage;
};

/**
 * Atgādinājumi pieprasītājam (cron ik 15 min, lib/iriss-waybill-reminders.ts): drīz beigsies, beigusies, ilgi gaida.
 * Tīra loģika: `sent` = jau nosūtīto atslēgas. Dati netiek mainīti.
 */
export function dueWaybillReminders(
  requests: ReadonlyArray<WaybillRequest>,
  sent: Readonly<Record<string, string>>,
  nowMs = Date.now(),
): WaybillReminder[] {
  const out: WaybillReminder[] = [];
  for (const r of requests) {
    const car = r.vehicle.brandModel.trim() || "Auto";
    const plate = displayDealerPlate(r.vehicle.plate) || r.vehicle.plate;
    const base = { url: WAYBILL_PUSH_URL, tag: `waybill-${r.id}`, audience: "iriss" as const };
    const push = (kind: WaybillReminderKind, key: string, title: string, body: string) => {
      if (!sent[key]) out.push({ key, kind, requestId: r.id, userKey: waybillPushUserKey(r.createdBy), message: { ...base, title, body } });
    };
    if (r.status === "issued") {
      const until = Date.parse(r.validUntil);
      if (!Number.isFinite(until)) continue;
      // Tam pašam numuram izdota jaunāka pavadzīme (pagarināta vai aizstāta) - par veco neziņo.
      const superseded = requests.some(
        (o) =>
          o.id !== r.id &&
          o.status === "issued" &&
          o.createdAt > r.createdAt &&
          compactDealerPlate(o.vehicle.plate) === compactDealerPlate(r.vehicle.plate),
      );
      if (superseded) continue;
      const from = Date.parse(r.validFrom || r.createdAt);
      const total = Number.isFinite(from) ? until - from : (r.validHours ?? 0) * 3_600_000;
      if (until > nowMs && until - nowMs <= WAYBILL_PUSH_SOON_MS && total > WAYBILL_PUSH_SOON_MS) {
        push("soon", `soon:${r.id}`, "Pavadzīme drīz beigsies", `${plate} · ${car}: beidzas ${waybillEndsLabel(until, nowMs)}. Pagarini, ja vajag.`);
      } else if (until <= nowMs && nowMs - until <= WAYBILL_PUSH_EXPIRED_WINDOW_MS) {
        push("expired", `expired:${r.id}`, "Pavadzīme beigusies", `${plate} · ${car}: vairs nav derīga. Numurs atkal ir brīvs.`);
      }
      continue;
    }
    if (r.status === "queued" && !isStaleWaybillRequest(r, nowMs) && !waybillPendingExpired(r, nowMs)) {
      const since = Date.parse(r.updatedAt || r.createdAt);
      if (Number.isFinite(since) && nowMs - since > WAYBILL_PUSH_LONG_WAIT_MS) {
        // Atkārtots pieprasījums (jauns mēģinājums) var ziņot vēlreiz.
        push("longwait", `longwait:${r.id}:${r.attempts}`, "Pavadzīme vēl gaida", `${car} · ${plate}: Aivars vēl nav sācis. Atver, lai atkārtotu.`);
      }
    }
  }
  return out;
}
