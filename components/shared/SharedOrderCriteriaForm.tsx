"use client";

import { readSharedOrderCriteria } from "@/lib/iriss-criteria-shared";
import type { IrissCriteriaMigrationInput } from "@/lib/iriss-criteria-migrate";
import type {
  IrissCriteriaFilter,
  IrissFuelChoice,
  IrissGearboxChoice,
} from "@/lib/iriss-criteria-types";
import type { BodyGroup, DriveGroup } from "@/lib/iriss-criteria-taxonomy";

export type SharedOrderCriteriaSource = IrissCriteriaMigrationInput & { notes?: string };

const FUEL: Record<string, string> = {
  petrol: "Benzīns",
  diesel: "Dīzelis",
  hybrid: "Hibrīds",
  electric: "Elektro",
  gas: "Gāze",
  hydrogen: "Ūdeņradis",
  other: "Cits",
  full_hev: "HEV",
  phev: "PHEV",
  mhev: "MHEV",
  diesel_hybrid: "Dīzeļa hibrīds",
  bev: "BEV",
  erev: "EREV",
  lpg: "LPG",
  cng: "CNG",
  bifuel: "Divdegviela",
};

const GEARBOX: Record<string, string> = {
  manual: "Mehāniskā",
  automatic: "Automāts",
  torque_converter: "Hidrauliskais automāts",
  dsg_dct: "DSG/DCT",
  cvt: "CVT",
  amt: "Robotizētā",
  single_speed_ev: "EV viena pārnesuma",
};

const BODY: Record<BodyGroup, string> = {
  sedan: "Sedans",
  wagon: "Universālis",
  hatchback: "Hečbeks",
  suv: "SUV",
  coupe: "Kupeja",
  cabrio: "Kabriolets",
  mpv: "MPV",
  van_bus: "Mikroautobuss",
  pickup: "Pikaps",
};

const DRIVE: Record<DriveGroup, string> = {
  fwd: "Priekšējā",
  rwd: "Aizmugurējā",
  awd: "Pilnpiedziņa",
};

function fuelLabel(choice: IrissFuelChoice): string {
  const group = FUEL[choice.group] ?? choice.group;
  if ("sub" in choice && choice.sub) return `${group} (${FUEL[choice.sub] ?? choice.sub})`;
  return group;
}

function gearboxLabel(choice: IrissGearboxChoice): string {
  const group = GEARBOX[choice.group] ?? choice.group;
  if ("sub" in choice && choice.sub) return `${group} (${GEARBOX[choice.sub] ?? choice.sub})`;
  return group;
}

function range(from: number | null, to: number | null, unit: string): string {
  if (from != null && to != null && from !== to) return `${from}-${to} ${unit}`.trim();
  if (from != null && to != null) return `${from} ${unit}`.trim();
  if (from != null) return `no ${from} ${unit}`.trim();
  if (to != null) return `līdz ${to} ${unit}`.trim();
  return "";
}

function manuals(filter: IrissCriteriaFilter): string {
  const bits = [
    filter.make.manual,
    filter.yearFrom.manual,
    filter.mileageTo.manual,
    filter.budgetTo.manual,
    filter.fuel.manual,
    filter.gearbox.manual,
    filter.bodyTypes.manual,
    filter.drive.manual,
    filter.seatsFrom.manual,
    filter.equipmentRequired.manual,
    filter.equipmentDesired.manual,
  ]
    .map((item) => item.trim())
    .filter(Boolean);
  return bits.join("; ");
}

function rowsFor(filter: IrissCriteriaFilter): Array<{ label: string; value: string }> {
  const rows = [
    { label: "Marka", value: filter.make.value.join(", ") },
    { label: "Modeļi", value: filter.models.value.join(", ") },
    { label: "Gads", value: range(filter.yearFrom.value, filter.yearTo.value, "") },
    { label: "Nobraukums", value: range(filter.mileageFrom.value, filter.mileageTo.value, "km") },
    { label: "Budžets", value: range(filter.budgetFrom.value, filter.budgetTo.value, "EUR") },
    { label: "Degviela", value: filter.fuel.value.map(fuelLabel).join(", ") },
    { label: "Kārba", value: filter.gearbox.value.map(gearboxLabel).join(", ") },
    { label: "Virsbūve", value: filter.bodyTypes.value.map((item) => BODY[item] ?? item).join(", ") },
    { label: "Piedziņa", value: filter.drive.value.map((item) => DRIVE[item] ?? item).join(", ") },
    { label: "Sēdvietas", value: filter.seatsFrom.value != null ? `no ${filter.seatsFrom.value}` : "" },
    { label: "Jauda", value: range(filter.kwFrom.value, filter.kwTo.value, "kW") },
    { label: "Emisija", value: filter.emissionMin.value ?? "" },
    { label: "Obligātais aprīkojums", value: filter.equipmentRequired.value.join(", ") },
    { label: "Vēlamais aprīkojums", value: filter.equipmentDesired.value.join(", ") },
    { label: "Nelasītais teksts", value: manuals(filter) },
  ];
  return rows.filter((row) => row.value.trim());
}

/** Viena kritēriju forma IRISS un B2B demo. Rāda atmiņas aprēķinu un neko nesaglabā. */
export function SharedOrderCriteriaForm({ source }: { source: SharedOrderCriteriaSource }) {
  const criteria = readSharedOrderCriteria({
    ...source,
    note: source.note ?? source.notes ?? "",
  });
  const filters = criteria.filters;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kritēriji</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tas pats aprēķins IRISS un demo. Esošais pasūtījums netiek pārrakstīts.
        </p>
      </div>
      {filters.map((filter) => {
        const rows = rowsFor(filter);
        return (
          <div key={filter.id} className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{filter.label}</p>
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Teksta laukos nav nolasāmu kritēriju.</p>
            ) : (
              <dl className="grid gap-2 sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-[11px] font-medium text-slate-500">{row.label}</dt>
                    <dd className="text-sm text-slate-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </section>
  );
}
