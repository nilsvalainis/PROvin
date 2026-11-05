import { BUSINESS_POGA_BLOCK_LABEL, UNKNOWN_PARTNER, type BusinessPogaSummary } from "@/lib/business-poga-stats";

/** Dienas kopsavilkums uz info@provin.lv (Nils 05.11.2026: dienas, nevis katrs pirkums). */
export const BUSINESS_POGA_DIGEST_TO = "info@provin.lv";
/** Vienam partnerim dienā tik daudz bloķētu - brīdinājums (iespējama ļaunprātīga izmantošana). */
export const BUSINESS_POGA_BLOCKED_ALERT = 20;

export type BusinessPogaDigest = {
  hasActivity: boolean;
  subject: string;
  text: string;
  lines: { label: string; value: string }[];
  alerts: string[];
};

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function dmy(d: string): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

export function buildBusinessPogaDigest(
  date: string,
  s: BusinessPogaSummary,
  partnerNames: Record<string, string>,
): BusinessPogaDigest {
  const t = s.totals;
  const name = (id: string) => (id === UNKNOWN_PARTNER ? "Nezināms partneris" : (partnerNames[id] ?? id));
  const hasActivity = t.clicks + t.blocked + t.started + t.paid > 0;
  const alerts = s.partners
    .filter((p) => p.blocked >= BUSINESS_POGA_BLOCKED_ALERT)
    .map((p) => `${name(p.partnerId)}: ${p.blocked} bloķēti klikšķi dienā - iespējama ļaunprātīga izmantošana`);
  const lines: { label: string; value: string }[] = [
    { label: "Klikšķi", value: String(t.clicks) },
    { label: "Bloķēti", value: String(t.blocked) },
    { label: "Apmaksa sākta", value: String(t.started) },
    { label: "Apmaksāti", value: `${t.paid} (${eur(t.revenueCents)})` },
    ...s.partners.map((p) => ({
      label: name(p.partnerId),
      value: `${p.clicks} klikšķi · ${p.blocked} bloķēti · ${p.paid} apmaksāti · ${eur(p.revenueCents)}`,
    })),
    ...s.blockedByReason.map((r) => ({ label: `Bloķēti: ${BUSINESS_POGA_BLOCK_LABEL[r.reason]}`, value: String(r.count) })),
    ...s.cars
      .filter((c) => c.paid > 0)
      .map((c) => ({ label: `Pirkts: ${c.title || "auto"}`, value: `${c.vin} (${name(c.partnerId)})` })),
  ];
  const subject = `PROVIN poga ${dmy(date)}: ${t.paid} pirkumi, ${t.clicks} klikšķi${alerts.length ? " - BRĪDINĀJUMS" : ""}`;
  const text = [
    `PROVIN Business poga - ${dmy(date)}`,
    "",
    ...alerts.map((a) => `! ${a}`),
    ...(alerts.length ? [""] : []),
    ...lines.map((l) => `${l.label}: ${l.value}`),
  ].join("\n");
  return { hasActivity, subject, text, lines, alerts };
}
