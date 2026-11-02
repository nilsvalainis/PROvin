import type { VinObservation } from "@/lib/vin-memory";
import type { AuctionSourceProgress, VinMemoryArchiveCounts, VinMemoryBrowseRow } from "@/lib/vin-memory-auction";

const SOURCE_LV: Record<string, string> = {
  auto1: "Auto1",
  autobid: "Autobid",
  openline: "Openlane",
  ecarstrade: "eCarsTrade",
  order: "PROVIN pasūtījums",
  quick_eval: "Ātrais vērtējums",
  logistics: "Loģistika",
};

export type AuctionArchiveCounts = VinMemoryArchiveCounts & { countedAt: string; shards: number; recent?: VinMemoryBrowseRow[] };

export type AuctionArchiveViewProps = {
  counts: AuctionArchiveCounts | null;
  recent: VinMemoryBrowseRow[];
  progress: { autobid: AuctionSourceProgress; openline: AuctionSourceProgress } | null;
  passDay: string;
  completedDay: string | null;
  vin: string;
  observations: VinObservation[];
  rollback: { earlier: VinObservation; later: VinObservation } | null;
  vinNote: string;
  message: string;
  busy: boolean;
  onRun?: () => void;
  onDeleteVin?: () => void;
  onDeleteLedger?: () => void;
};

function lvDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "-";
}

function km(v: number | null | undefined): string {
  return typeof v === "number" && v > 0 ? `${v.toLocaleString("lv-LV")} km` : "-";
}

function sourceLabel(id: string): string {
  return SOURCE_LV[id] ?? id;
}

function otherObservations(counts: VinMemoryArchiveCounts): { vins: number; observations: number } {
  let vins = 0;
  let observations = 0;
  for (const [id, row] of Object.entries(counts.bySource)) {
    if (id === "autobid" || id === "openline") continue;
    observations += row.observations;
    vins += row.vins;
  }
  return { vins, observations };
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums leading-none text-[var(--color-apple-text)]">{value}</p>
      <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">{hint}</p>
    </div>
  );
}

/** Pilns admin skats. Nosaukums vienmēr Izsoļu portālu arhīvs. */
export function AdminAuctionArchiveView(props: AuctionArchiveViewProps) {
  const { counts, recent, progress, passDay, completedDay, vin, observations, rollback, vinNote, message, busy } = props;
  const others = counts ? otherObservations(counts) : { vins: 0, observations: 0 };
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
      <p className="text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
        Izsoļu portālu arhīvs ir mūsu VIN atmiņa: datums, nobraukums, avots, modelis un pirmā reģistrācija. Autobid un Openlane nāk masveidā.
        Bildes un personas datus šeit neliek. Pārdoto arhīva bez meklēšanā redzamā auto nav.
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Kopsavilkums">
        <Stat label="VIN" value={counts ? counts.vins.toLocaleString("lv-LV") : "-"} hint={counts ? `${counts.shards} šķembas` : "Skaitītāji vēl nav"} />
        <Stat label="Novērojumi" value={counts ? counts.observations.toLocaleString("lv-LV") : "-"} hint={counts ? `Skaitīts ${lvDate(counts.countedAt)}` : "Gaida pirmo nolasīšanu"} />
        <Stat
          label="Autobid"
          value={counts ? counts.bySource.autobid.observations.toLocaleString("lv-LV") : "-"}
          hint={counts ? `${counts.bySource.autobid.vins.toLocaleString("lv-LV")} VIN` : "Avots autobid"}
        />
        <Stat
          label="Openlane"
          value={counts ? counts.bySource.openline.observations.toLocaleString("lv-LV") : "-"}
          hint={counts ? `${counts.bySource.openline.vins.toLocaleString("lv-LV")} VIN` : "Avots openline"}
        />
      </section>
      <p className="text-[12px] text-[var(--color-provin-muted)]">
        Citi avoti (pasūtījumi, eCarsTrade, loģistika, ātrais vērtējums): {others.observations.toLocaleString("lv-LV")} novērojumi, {others.vins.toLocaleString("lv-LV")} VIN.
        Nakts ielase no jau ielādētajiem IRISS sludinājumiem paliek atsevišķi.
      </p>

      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Jaunākie VIN</h2>
          <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">Līdz 40 pēdējiem ierakstiem no šķembām. Atver rindu, lai redzētu visu vēsturi.</p>
        </div>
        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-[var(--color-provin-muted)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">VIN</th>
                  <th className="px-3 py-2 font-semibold">Datums</th>
                  <th className="px-3 py-2 font-semibold">Nobraukums</th>
                  <th className="px-3 py-2 font-semibold">Avots</th>
                  <th className="px-3 py-2 font-semibold">Modelis</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.vin} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-[12px]">
                      <a className="underline" href={`/admin/izsolu-arhivs?vin=${encodeURIComponent(row.vin)}`}>
                        {row.vin}
                      </a>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{lvDate(row.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{km(row.km)}</td>
                    <td className="px-3 py-2">{row.sources.map(sourceLabel).join(", ")}</td>
                    <td className="px-3 py-2">{row.model || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-[13px] text-[var(--color-provin-muted)]">Arhīvā vēl nav VIN, ko pārlūkot. Meklēšana zemāk strādā arī tad.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Meklēt VIN</h2>
        <form className="mt-3 flex flex-wrap gap-2" action="/admin/izsolu-arhivs" method="get">
          <input
            name="vin"
            defaultValue={vin}
            maxLength={17}
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="17 zīmes"
            aria-label="VIN"
            className="min-w-[16rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-[14px] uppercase"
          />
          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold">
            Meklēt
          </button>
          {vin && props.onDeleteVin ? (
            <button
              type="button"
              className="rounded-lg border border-red-200 px-4 py-2 text-[13px] font-semibold text-red-800 disabled:opacity-50"
              disabled={busy}
              onClick={props.onDeleteVin}
            >
              Dzēst šo VIN no arhīva
            </button>
          ) : null}
        </form>
        {vin ? <p className="mt-2 font-mono text-[12px] text-[var(--color-apple-text)]">{vin}</p> : null}
        {vinNote ? <p className="mt-2 text-[13px] text-[var(--color-provin-muted)]">{vinNote}</p> : null}
        {rollback ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-800">
            Nobraukuma pretruna: {km(rollback.earlier.km)} {lvDate(rollback.earlier.date)} pret {km(rollback.later.km)} {lvDate(rollback.later.date)}
          </p>
        ) : null}
        {observations.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-[var(--color-provin-muted)]">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Datums</th>
                  <th className="py-2 pr-3 font-semibold">Nobraukums</th>
                  <th className="py-2 pr-3 font-semibold">Avots</th>
                  <th className="py-2 pr-3 font-semibold">Modelis</th>
                  <th className="py-2 pr-3 font-semibold">Pirmā reģistrācija</th>
                  <th className="py-2 font-semibold">Valsts</th>
                </tr>
              </thead>
              <tbody>
                {[...observations].reverse().map((o) => (
                  <tr key={`${o.date}-${o.source}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3 tabular-nums">{lvDate(o.date)}</td>
                    <td className="py-2 pr-3 tabular-nums">{km(o.km)}</td>
                    <td className="py-2 pr-3">{sourceLabel(o.source)}</td>
                    <td className="py-2 pr-3">{o.model || "-"}</td>
                    <td className="py-2 pr-3 tabular-nums">{o.firstRegistration || "-"}</td>
                    <td className="py-2">{o.country || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--color-apple-text)]">Masveida nolasīšana</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--color-apple-text)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              disabled={busy || !props.onRun}
              onClick={props.onRun}
            >
              {busy ? "Nolasa…" : "Nolasīt nākamo soli"}
            </button>
            {props.onDeleteLedger ? (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={props.onDeleteLedger}
              >
                Dzēst gājiena kursoru
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-provin-muted)]">
          Gājiens no {passDay ? lvDate(passDay) : "-"}
          {completedDay ? `, pabeigts ${lvDate(completedDay)}` : ""}. Autobid ir publiska meklēšana pa lapām. Openlane iet caur sludinājumu releju, pa vienai markai.
          Kursora dzēšana nenodzeš VIN šķembas. Tā tikai sāk gājienu no jauna un notīra skaitītāju kešu.
        </p>
        {progress ? (
          <ul className="mt-2 space-y-1 text-[13px] text-[var(--color-apple-text)]">
            <li>
              Autobid: {progress.autobid.vins} VIN šajā gājienā, {progress.autobid.done} pabeigtas, {progress.autobid.partial} nepilnas,{" "}
              {progress.autobid.pending + progress.autobid.active} rindā
              {progress.autobid.error ? `, ${progress.autobid.error} kļūdas` : ""}
            </li>
            <li>
              Openlane: {progress.openline.vins} VIN šajā gājienā, {progress.openline.done} pabeigtas, {progress.openline.partial} nepilnas,{" "}
              {progress.openline.pending + progress.openline.active} rindā
              {progress.openline.error ? `, ${progress.openline.error} kļūdas` : ""}
            </li>
          </ul>
        ) : null}
        {message ? <p className="mt-2 text-[13px] text-[var(--color-apple-text)]">{message}</p> : null}
      </section>
    </div>
  );
}
