/**
 * Piedāvājuma "Apraksti" cilnes sākuma dati no Autoparka servisa datiem (V2Service: problēmas,
 * piezīmes, rēķini) un aprīkojuma rindas. Tīra loģika - lietotājs pēc tam var visu labot formā.
 * Avots vienmēr IRISS servisa pārbaudes pieraksti (latviski), nevis Auto1 sludinājuma teksts -
 * tas netiek glabāts strukturēti nevienam Autoparka auto.
 */
import type { OfferDraft } from "@/lib/iriss-offer-draft";

export type OfferAprakstiSeedFields = Partial<
  Pick<
    OfferDraft,
    | "damageGrade"
    | "keyCount"
    | "visualAssessment"
    | "technicalAssessment"
    | "summary"
    | "hasFullServiceHistory"
    | "hasFactoryPaint"
    | "hasNoRustBody"
    | "hasSecondWheelSet"
  >
>;

export type OfferAprakstiSeedProblem = { text: string; fixedByService: boolean };

export type OfferAprakstiSeedInput = {
  problems?: readonly OfferAprakstiSeedProblem[];
  notes?: string;
  invoiceCount?: number;
  equipmentLine?: string;
};

const RUST_RE = /\brūs/i;
const REPAINT_RE = /pārkrāsot|no jauna krāsot|lakot no jauna/i;
const KEY_COUNT_RE = /(\d+)\s*atslēg/i;

function shortJoin(texts: readonly string[], max = 220): string {
  const joined = texts.map((t) => t.trim()).filter(Boolean).join("; ");
  return joined.length > max ? `${joined.slice(0, max - 1).trimEnd()}…` : joined;
}

/** Autoparka servisa datu (tīra loģika) pārvēršana uz Apraksti cilnes lauku priekšaizpildi. */
export function offerAprakstiSeedFromAuto1(input: OfferAprakstiSeedInput): OfferAprakstiSeedFields {
  const problems = input.problems ?? [];
  const notes = (input.notes ?? "").trim();
  const invoiceCount = input.invoiceCount ?? 0;
  const equipmentLine = (input.equipmentLine ?? "").trim();
  const open = problems.filter((p) => !p.fixedByService);
  const fixed = problems.filter((p) => p.fixedByService);
  const haystack = `${notes} ${problems.map((p) => p.text).join(" ")}`;

  const out: OfferAprakstiSeedFields = {};

  if (problems.length > 0) {
    out.damageGrade =
      open.length === 0
        ? "Bez atklātām problēmām - servisā novērsts"
        : `Zināmas problēmas (${open.length}): ${shortJoin(open.map((p) => p.text), 120)}`;
  }

  if (open.length > 0) {
    out.technicalAssessment = `Servisā konstatēts, nav novērsts: ${shortJoin(open.map((p) => p.text))}`;
  }

  const keyMatch = haystack.match(KEY_COUNT_RE);
  if (keyMatch) out.keyCount = keyMatch[1];

  if (problems.length > 0 || notes) {
    out.hasNoRustBody = !RUST_RE.test(haystack);
    out.hasFactoryPaint = !REPAINT_RE.test(haystack);
  }
  if (invoiceCount > 0) out.hasFullServiceHistory = true;

  const summaryParts: string[] = [];
  if (invoiceCount > 0) summaryParts.push(`servisā ${invoiceCount} ${invoiceCount === 1 ? "rēķins" : "rēķini"}`);
  if (fixed.length > 0) summaryParts.push(`${fixed.length} ${fixed.length === 1 ? "problēma novērsta" : "problēmas novērstas"}`);
  if (open.length > 0) summaryParts.push(`${open.length} ${open.length === 1 ? "zināma problēma" : "zināmas problēmas"} vēl atklāta${open.length === 1 ? "" : "s"}`);
  if (equipmentLine) summaryParts.push(`aprīkojums: ${equipmentLine}`);
  if (summaryParts.length > 0) out.summary = `${summaryParts.join(", ")}.`;

  return out;
}
