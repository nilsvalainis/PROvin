import type { AtraFactRow } from "@/lib/atra-parbaude-facts";
import { createDefaultSourceBlocks, type CsddFormFields } from "@/lib/admin-source-blocks";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { parseDetailedRatingBlockFromRaw, type CsddInspectionDefectRow } from "@/lib/csdd-extended-parse";

/**
 * VIN SCAN v4: e.csdd.lv (Smart-ID, 2. solis) teksts -> fakti kopsavilkumam.
 * 26.11 (Nils): e.csdd ielasīts, bet «Galvenā informācija» rādīja «Nav datu» - kopsavilkums lasīja tikai
 * VIN SCAN rindas un CSDD API. Šeit tas pats parseris, ko pasūtījuma CSDD bloks (`applyCsddPasteToForm`).
 */

export const ECSDD_FACT_ROW_ID = "ecsdd_smartid";
export const ECSDD_FACT_LABEL = "e.csdd";

export type EcsddInspectionFact = {
  /** «24.02.2026». */
  date: string;
  type: string;
  rating: string;
  odometer: string;
  defects: CsddInspectionDefectRow[];
};

export type VinScanEcsddFacts = {
  /** Rinda, ko pievieno VIN SCAN rindām faktu aprēķinam (nobraukums, apskates, CSNg). */
  row: AtraFactRow;
  registrationStatus: string;
  /** true - «Uzskaitē» / «Reģistrēts»; false - noņemts / izvests; null - nav zināms. */
  registeredLv: boolean | null;
  plate: string;
  ownerCount: string;
  /** «Nākamās apskates datums» ISO. */
  nextInspectionIso: string;
  /** Jaunākā apskate (galva + «Detalizētais vērtējums») un iepriekšējās. */
  inspections: EcsddInspectionFact[];
  /** CSNg: policija / apdrošinātāji. `checked` - sadaļa bija tekstā. */
  csng: { checked: boolean; items: string[] };
};

const DEREGISTERED_RE = /no[nņ]emts|izvest|noraks|likvid|izsl[eē]gt|nav\s+uzskait|deregist/i;
const REGISTERED_RE = /uzskait[eē]|re[gģ]istr[eē]ts/i;

export function ecsddRegisteredLv(status: string): boolean | null {
  const s = status.trim();
  if (!s) return null;
  if (DEREGISTERED_RE.test(s)) return false;
  return REGISTERED_RE.test(s) ? true : null;
}

/** e.csdd teksts -> CSDD bloka lauki (tas pats parseris kā pasūtījumā). */
export function parseEcsddRawToCsdd(rawText: string): CsddFormFields {
  return applyCsddPasteToForm(createDefaultSourceBlocks().csdd, rawText, parseCsddPaste(rawText));
}

function parseCsng(raw: string): VinScanEcsddFacts["csng"] {
  const m = /Būtiski\s+bojājumi\s+CSNg([\s\S]*?)(?=\n\s*\n|\n\s*(?:Nobraukuma|Transportlīdzekļa|Iepriekšējās|Informācija\s+sagatavota)|$)/i.exec(raw);
  if (!m) return { checked: false, items: [] };
  const items: string[] = [];
  let head = "";
  for (const line of m[1]!.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (/^Informācija\s+no\s+(policijas|apdrošinātājiem)/i.test(line)) {
      head = /policijas/i.test(line) ? "Policija" : "Apdrošinātāji";
      continue;
    }
    if (/^nav\.?$/i.test(line)) continue;
    items.push(head ? `${head}: ${line}` : line);
  }
  return { checked: true, items };
}

function toLvDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function buildEcsddFacts(rawText: string | null | undefined): VinScanEcsddFacts | null {
  const raw = String(rawText ?? "").trim();
  if (!raw) return null;
  const form = parseEcsddRawToCsdd(raw);
  const mileage = (form.mileageHistory ?? [])
    .filter((r) => r.date?.trim() && r.odometer?.trim())
    .map((r) => {
      const iso = countryLabelToIso2(r.country ?? "") ?? "";
      return { date: r.date, odometer: r.odometer, source: ECSDD_FACT_LABEL, ...(iso ? { country: iso } : {}) };
    });

  const inspections: EcsddInspectionFact[] = [];
  const head = parseDetailedRatingBlockFromRaw(raw);
  if (head.inspectionDateText || head.ratingLabel || head.defects.length) {
    inspections.push({
      date: head.inspectionDateText,
      type: head.inspectionType,
      rating: head.ratingLabel,
      odometer: head.odometer,
      defects: head.defects,
    });
  }
  for (const r of form.technicalInspectionHistory ?? []) {
    if (inspections.some((i) => i.date && i.date === r.date)) continue;
    inspections.push({ date: r.date, type: r.inspectionType ?? "", rating: r.ratingLabel ?? "", odometer: "", defects: r.defects ?? [] });
  }
  const prev = form.prevInspectionBlock;
  if (prev?.inspectionDateText && !inspections.some((i) => i.date === prev.inspectionDateText)) {
    inspections.push({ date: prev.inspectionDateText, type: prev.inspectionType, rating: prev.ratingLabel, odometer: prev.odometer, defects: prev.defects ?? [] });
  }

  const csng = parseCsng(raw);
  const status = String(form.registrationStatus ?? "").trim();
  const nextInspectionIso = String(form.nextInspectionDate ?? "").trim();
  const row: AtraFactRow = {
    id: ECSDD_FACT_ROW_ID,
    label: ECSDD_FACT_LABEL,
    country: "LV",
    status: "found",
    summary: "e.csdd dati (Smart-ID)",
    mileage,
    inspections: inspections
      .filter((i) => i.date)
      .map((i) => ({ date: i.date, result: i.rating, ...(i.odometer ? { odometer: i.odometer } : {}) })),
    incidents: csng.items.map((summary) => ({ summary })),
    flags: { registrationCountry: "LV" },
  };
  return {
    row,
    registrationStatus: status,
    registeredLv: ecsddRegisteredLv(status),
    plate: String(form.registrationNumber ?? "").trim(),
    ownerCount: String(form.ownerCountLatvia ?? "").trim(),
    nextInspectionIso: /^\d{4}-\d{2}-\d{2}/.test(nextInspectionIso) ? nextInspectionIso.slice(0, 10) : "",
    inspections,
    csng,
  };
}

/** «Tehniskā apskate» kartītes apakšteksts: jaunākā apskate + defektu skaits. */
export function ecsddInspectionLine(f: VinScanEcsddFacts | null): string {
  const i = f?.inspections[0];
  if (!i) return "";
  const n = i.defects.length;
  return [i.date, i.rating, n ? `${n} ${n === 1 ? "defekts" : "defekti"}` : ""].filter(Boolean).join(" · ");
}

export { toLvDate as ecsddIsoToLvDate };

/** VIN SCAN rindas + e.csdd rinda (ja ielasīts) - faktu kartītēm visās VIN SCAN vietās. */
export function withEcsddFactRow<T extends AtraFactRow>(rows: readonly T[], rawText: string | null | undefined): (T | AtraFactRow)[] {
  const f = buildEcsddFacts(rawText);
  return f ? [...rows.filter((r) => r.id !== ECSDD_FACT_ROW_ID), f.row] : [...rows];
}
