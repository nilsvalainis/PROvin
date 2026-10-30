import type { VinCheckSummary } from "@/lib/vin-check-stats";

const CSDD_MONTHLY_LIMIT = 10_000;

const REGION_LV: Record<string, string> = {
  europe: "Eiropa",
  northAmerica: "Ziemeļamerika",
  asia: "Āzija",
  southAmerica: "Dienvidamerika",
  africa: "Āfrika",
  oceania: "Okeānija",
};

const MODEL_LV: Record<string, string> = {
  vag: "VW grupa",
  mercedes: "Mercedes",
  volvo: "Volvo",
  bmw: "BMW",
  learned: "Iemācītā tabula",
  vpic: "NHTSA (ASV)",
  csdd: "CSDD (numurzīme)",
  none: "Tikai ražotājs",
};

const SOURCE_LV: Record<string, string> = { home: "Sākumlapa", decoder: "/vin-dekoders", direct: "Tieši (API)", test: "PROVIN tests" };

function n(v: number): string {
  return v.toLocaleString("lv-LV");
}

function pct(part: number, all: number): string {
  if (!all) return "-";
  return `${((part / all) * 100).toLocaleString("lv-LV", { maximumFractionDigits: 1 })}%`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums leading-none text-[var(--color-apple-text)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">{hint}</p> : null}
    </div>
  );
}

function Rows({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const shown = rows.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!shown.length) return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">{title}</p>
      <ul className="mt-1.5 divide-y divide-slate-100 border-t border-slate-100">
        {shown.map(([label, v]) => (
          <li key={label} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
            <span className="min-w-0 truncate text-[var(--color-apple-text)]">{label}</span>
            <span className="shrink-0 font-medium tabular-nums text-[var(--color-provin-muted)]">{n(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = { last30: VinCheckSummary; today: VinCheckSummary; month: VinCheckSummary };

/** Bezmaksas VIN / numurzīmju pārbaudes (pēdējās 30 dienas) un CSDD līguma lietojums šajā mēnesī. */
export function AdminVinChecksCard({ last30, today, month }: Props) {
  const vin = last30.byKind.vin;
  const plate = last30.byKind.plate;
  const vinAll = Object.values(vin).reduce((a, b) => a + b, 0);
  const plateAll = Object.values(plate).reduce((a, b) => a + b, 0);
  const okAll = vin.ok + plate.ok;
  const csddMonth = month.csddTotal;
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">VIN pārbaudes · 30 dienas</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-apple-text)]">Pārbaude → pasūtīt auditu</h2>
        </div>
        <p className="text-[2.25rem] font-semibold leading-none tracking-tight text-[var(--color-apple-text)] tabular-nums">
          {pct(last30.cta.cta_audit, okAll)}
        </p>
      </div>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
        {n(last30.cta.cta_audit)} klikšķi uz &quot;Pasūtīt auditu&quot; no {n(okAll)} sekmīgām pārbaudēm. Šodien {n(today.checks)} pārbaudes.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="VIN sekmīgi" value={n(vin.ok)} hint={`no ${n(vinAll)}`} />
        <Kpi label="VIN kļūdaini" value={n(vin.invalid_length + vin.invalid_chars)} hint={`${n(vin.invalid_length)} garums, ${n(vin.invalid_chars)} burti`} />
        <Kpi label="Numurzīmes sekmīgi" value={n(plate.ok)} hint={`no ${n(plateAll)}`} />
        <Kpi
          label="Numurzīmes neveiksmīgi"
          value={n(plate.not_found + plate.invalid_plate + plate.csdd_error + plate.quota)}
          hint={`${n(plate.not_found)} nav atrasts, ${n(plate.invalid_plate)} kļūdaini, ${n(plate.csdd_error)} CSDD kļūda, ${n(plate.quota)} limits`}
        />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Rows title="Reģions (sekmīgie)" rows={Object.entries(last30.byRegion).map(([k, v]) => [REGION_LV[k] ?? k, v])} />
        <Rows title="Modelis atpazīts ar" rows={Object.entries(last30.byModel).map(([k, v]) => [MODEL_LV[k] ?? k, v])} />
        <Rows
          title="Kur pārbaudīja"
          rows={[
            ...Object.entries(last30.bySource).map(([k, v]) => [SOURCE_LV[k] ?? k, v] as [string, number]),
            ["Arhīvā bija ieraksti", last30.memoryHits],
            ["Klikšķis: bezmaksas sludinājums", last30.cta.cta_free],
          ]}
        />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200/80 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold text-[var(--color-apple-text)]">CSDD līgums šajā mēnesī</p>
          <p className="text-[13px] tabular-nums text-[var(--color-provin-muted)]">
            {n(csddMonth)} / {n(CSDD_MONTHLY_LIMIT)} ({pct(csddMonth, CSDD_MONTHLY_LIMIT)})
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[var(--color-provin-accent)]" style={{ width: `${Math.min(100, (csddMonth / CSDD_MONTHLY_LIMIT) * 100)}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">
          Dekoders {n(month.csdd.decoder.found + month.csdd.decoder.not_found + month.csdd.decoder.error)} · MINI pirkums{" "}
          {n(month.csdd.checkout.found + month.csdd.checkout.not_found + month.csdd.checkout.error)} · Admin{" "}
          {n(month.csdd.admin.found + month.csdd.admin.not_found + month.csdd.admin.error)} · Kļūdas{" "}
          {n(month.csdd.decoder.error + month.csdd.checkout.error + month.csdd.admin.error)}
        </p>
      </div>
      <p className="mt-3 text-[11px] text-[var(--color-provin-muted)]">
        Skaitītāji bez VIN, numurzīmēm un IP. Uzskaite sākās ar šo versiju; vienlaicīgos pieprasījumos var pazust atsevišķs skaitlis.
      </p>
    </section>
  );
}
