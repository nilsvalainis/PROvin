import type { IrissSettingsLimitsView } from "@/lib/iriss-iestatijumi-view";
import { IRISS_SETTINGS_LIMITS_HINT } from "@/lib/iriss-iestatijumi-view";

function LimitsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
      <span className="text-[15px] text-[var(--ink)]">{label}</span>
      <span className="tabular-nums text-[15px] text-[var(--ink2)]">{value}</span>
    </div>
  );
}

export function IrissMarketplaceLimitsCard({ limits }: { limits: IrissSettingsLimitsView }) {
  return (
    <section className="mt-5 max-w-xl">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">
        Sludinājumu ielādes limiti · tikai lasāmi
      </p>
      <div className="divide-y divide-[var(--hair)] overflow-hidden rounded-[22px] bg-[var(--s1)] shadow-[var(--sh)]">
        <LimitsRow label="Mēneša griesti" value={limits.monthlyCapLabel} />
        <LimitsRow label="Griesti vienai ielādei" value={limits.perRunCapLabel} />
        <LimitsRow label={limits.spentLabel} value={limits.spentValue} />
        <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
          <span className="text-[15px] text-[var(--ink)]">Ielāde</span>
          <span className="inline-flex max-w-[60%] items-center justify-end gap-1.5 text-right text-[13px] text-[var(--ink2)]">
            <span aria-hidden="true">{limits.loadsEnabled ? "" : "⊘"}</span>
            {limits.loadsStatus}
          </span>
        </div>
      </div>
      <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--ink2)]">{IRISS_SETTINGS_LIMITS_HINT}</p>
    </section>
  );
}
