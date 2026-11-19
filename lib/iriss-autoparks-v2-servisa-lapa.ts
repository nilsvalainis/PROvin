/**
 * Servisa darbu lapa (makets apstiprināts, Nils 19.11): A4 drukai mehāniķim no Servisa cilnes.
 * Tīra loģika (bez servera atkarībām) - auto + problēmas + piezīmes -> lapas modelis.
 * Summas, akta numuri un foto lapā netiek likti.
 */
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import { REGISTRY_SAFETY_LV, type RegistrySafetyState } from "@/lib/iriss-autoparks-registry";
import { autoparksV2Basics, type AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import { fmtCm3, fmtDateLv, fmtKm, fmtKw } from "@/lib/iriss-autoparks-v2-format";
import { autoparksV2CanCategory, type AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import type { V2ServissFile } from "@/lib/iriss-autoparks-v2-serviss";

/** Uzņēmuma reģ. nr. lapas galvenē; DZA reģ. nr. sistēmā nav - tad nerāda. */
export const SERVISA_LAPA_OWNER_REG_NO: Record<"IRISS" | "DZA", string> = {
  IRISS: "59202001191",
  DZA: "",
};

export type ServisaLapaProblem = { n: number; text: string; done: boolean };

export type ServisaLapa = {
  carId: string;
  owner: "IRISS" | "DZA";
  ownerName: string;
  ownerRegNo: string;
  /** "19.11.2026 12:45" (Europe/Riga). */
  printedAt: string;
  statusLabel: string;
  title: string;
  vin: string;
  /** Tikai aizpildītie tehniskie dati (tukšie izlaisti). */
  tech: Array<{ label: string; value: string }>;
  problems: ServisaLapaProblem[];
  doneCount: number;
  openCount: number;
  notes: string;
  /** Jaunākais CSDD diagnostikas skenējums; null = 2. lapa netiek drukāta. */
  diag: V2ServissFile | null;
};

/** Servisa lapu drīkst atvērt tie paši, kam ir Servisa cilne (ap_serviss). */
export function servisaLapaAllowed(perms: AutoparksV2Perms): boolean {
  return autoparksV2CanCategory(perms, "serviss");
}

export function servisaLapaHref(carId: string): string {
  return `/admin/iriss/autoparks-v2/${encodeURIComponent(carId)}/servisa-lapa`;
}

/** "19.11.2026 12:45" Rīgas laikā. */
export function fmtRigaDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}.${p("month")}.${p("year")} ${p("hour")}:${p("minute")}`;
}

const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function safety(v: RegistrySafetyState | undefined): string {
  return v ? REGISTRY_SAFETY_LV[v] : "";
}

function techRows(car: AutoparksCar, v2: AutoparksCarV2): Array<{ label: string; value: string }> {
  const b = autoparksV2Basics(car, v2);
  const r = car.registry;
  const rows: Array<[string, string]> = [
    ["Gads", b.year],
    ["Krāsa", b.color],
    ["Numurzīme", b.plate],
    ["Nobraukums", fmtKm(b.mileageKm.value)],
    ["Dzinējs", b.engine.value],
    ["Tilpums", fmtCm3(b.displacementCm3.value)],
    ["Degviela", r?.fuel ?? ""],
    ["Jauda", fmtKw(b.powerKw.value)],
    ["Ātrumkārba", b.gearbox.value],
    ["TL veids", r?.vehicleType ?? ""],
    ["Sēdvietas", r?.seats ? String(r.seats) : ""],
    ["1. reģistrācija", fmtDateLv(b.firstRegDate.value)],
    ["Pilna masa", r?.grossMassKg ? `${group(r.grossMassKg)} kg` : ""],
    ["CO2", r?.co2GKm ? `${group(r.co2GKm)} g/km` : ""],
    ["Riepas", b.tyreSize.value],
    ["ABS", safety(r?.abs)],
    ["ESP", safety(r?.esp)],
    ["EPS", safety(r?.eps)],
    ["Drošības spilveni", safety(r?.airbags)],
  ];
  return rows
    .map(([label, value]) => ({ label, value: (value ?? "").trim() }))
    .filter((x) => x.value && x.value !== "-");
}

export function buildServisaLapa(input: {
  car: AutoparksCar;
  v2: AutoparksCarV2;
  /** Servisa skata `diag.files` (dzēstie jau izlaisti), secībā kā skenēti. */
  diagFiles: readonly V2ServissFile[];
  now: Date;
}): ServisaLapa {
  const { car, v2 } = input;
  const b = autoparksV2Basics(car, v2);
  const problems = v2.service.problems
    .filter((p) => p.text.trim())
    .map((p, i): ServisaLapaProblem => ({ n: i + 1, text: p.text.trim(), done: p.fixedByService }));
  const doneCount = problems.filter((p) => p.done).length;
  return {
    carId: car.id,
    owner: b.owner,
    ownerName: b.ownerLabel,
    ownerRegNo: SERVISA_LAPA_OWNER_REG_NO[b.owner],
    printedAt: fmtRigaDateTime(input.now),
    statusLabel: b.statusLabel,
    title: b.title,
    vin: b.vin,
    tech: techRows(car, v2),
    problems,
    doneCount,
    openCount: problems.length - doneCount,
    notes: v2.service.notes.trim(),
    diag: input.diagFiles.length > 0 ? input.diagFiles[input.diagFiles.length - 1]! : null,
  };
}

/** Lapu skaits: 1 + CSDD diagnostikas lapas (0, ja skenējuma nav). */
export function servisaLapaPageCount(s: Pick<ServisaLapa, "diag">, diagPages: number): number {
  return 1 + (s.diag ? Math.max(1, diagPages) : 0);
}

/** "1 izdarīta, 3 atlikušas" (latviešu skaitļa forma pēc pēdējā cipara). */
export function servisaLapaCounts(done: number, open: number): string {
  const one = (n: number) => n % 10 === 1 && n % 100 !== 11;
  return `${done} ${one(done) ? "izdarīta" : "izdarītas"}, ${open} ${one(open) ? "atlikusi" : "atlikušas"}`;
}
