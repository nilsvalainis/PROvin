/**
 * Serviss (T3-T5, T7): 5 posmi - numuru salīdzināšanas akts, CSDD diagnostika, problēmas, servisa piezīmes, rēķini.
 * Tīra loģika (skats + izmaiņas), bez servera atkarībām - testējama. Summas un AI ieteikumu atdod tikai ar Summām.
 */
import type { AutoparksFile } from "@/lib/iriss-autoparks";
import type { AutoparksCarV2, V2Invoice, V2InvoiceAi, V2Problem } from "@/lib/iriss-autoparks-v2";

export type V2ServissFile = { id: string; date: string; contentType: string; title: string };

export type V2ServissInvoiceView = {
  id: string;
  date: string;
  pages: number;
  files: V2ServissFile[];
  /** null bez Summām (servisa kolēģis summu neredz un neievada - 20:17). */
  amountEur: number | null;
  ai: Pick<V2InvoiceAi, "amountEur" | "withVat" | "confidence" | "error"> | null;
};

export type V2ServissView = {
  numberCheck: { files: V2ServissFile[]; date: string };
  diag: { files: V2ServissFile[]; date: string };
  problems: V2Problem[];
  notes: string;
  invoices: V2ServissInvoiceView[];
  totalEur: number | null;
  canSums: boolean;
  canConfirm: boolean;
};

export type ServissScanTarget = "number_check" | "diag" | "invoice" | "invoice_page" | "problem_photo";

export const SERVISS_SCAN_TITLE: Record<Exclude<ServissScanTarget, "invoice_page">, string> = {
  problem_photo: "Problēmas foto",
  number_check: "Numuru salīdzināšanas akts",
  diag: "CSDD diagnostika",
  invoice: "Servisa rēķins",
};

export function isServissScanTarget(v: unknown): v is ServissScanTarget {
  return v === "number_check" || v === "diag" || v === "invoice" || v === "invoice_page" || v === "problem_photo";
}

function fileView(files: ReadonlyMap<string, AutoparksFile>, id: string): V2ServissFile | null {
  const f = files.get(id);
  if (!f || f.deletedAt) return null;
  return { id: f.id, date: f.createdAt.slice(0, 10), contentType: f.contentType, title: f.title };
}

function filesOf(files: ReadonlyMap<string, AutoparksFile>, ids: readonly string[]): V2ServissFile[] {
  return ids.map((id) => fileView(files, id)).filter((x): x is V2ServissFile => x !== null);
}

/** Visi faila id, kas pieder Servisam (failu proxy atļauj tikai šos). */
export function servissFileIds(v2: AutoparksCarV2): Set<string> {
  const ids = new Set<string>();
  if (v2.numberCheck.fileId) ids.add(v2.numberCheck.fileId);
  for (const id of v2.numberCheck.extraFileIds) ids.add(id);
  for (const id of v2.service.diagFileIds) ids.add(id);
  for (const inv of v2.service.invoices) {
    if (inv.fileId) ids.add(inv.fileId);
    for (const id of inv.extraFileIds) ids.add(id);
  }
  for (const p of v2.service.problems) for (const id of p.photoIds) ids.add(id);
  return ids;
}

export function servissView(
  v2: AutoparksCarV2,
  v1Files: readonly AutoparksFile[],
  opts: { canSums: boolean; canConfirm: boolean },
): V2ServissView {
  const byId = new Map(v1Files.map((f) => [f.id, f]));
  const nc = filesOf(byId, [v2.numberCheck.fileId, ...v2.numberCheck.extraFileIds].filter(Boolean));
  const diag = filesOf(byId, v2.service.diagFileIds);
  const invoices = [...v2.service.invoices]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((inv): V2ServissInvoiceView => ({
      id: inv.id,
      date: inv.date,
      pages: inv.pages,
      files: filesOf(byId, [inv.fileId, ...inv.extraFileIds]),
      amountEur: opts.canSums ? inv.amountEur : null,
      ai: opts.canSums && inv.ai ? { amountEur: inv.ai.amountEur, withVat: inv.ai.withVat, confidence: inv.ai.confidence, error: inv.ai.error } : null,
    }));
  const total = invoices.reduce((s, i) => s + (i.amountEur ?? 0), 0);
  return {
    numberCheck: { files: nc, date: v2.numberCheck.scannedAt.slice(0, 10) || nc[0]?.date || "" },
    diag: { files: diag, date: diag[0]?.date ?? "" },
    problems: v2.service.problems,
    notes: v2.service.notes,
    invoices,
    totalEur: opts.canSums ? Math.round(total * 100) / 100 : null,
    canSums: opts.canSums,
    canConfirm: opts.canConfirm,
  };
}

/** Problēmu posma skaitītājs "1 / 2": cik ir gan novērstas, gan apstiprinātas. */
export function problemsDone(problems: readonly V2Problem[]): { done: number; total: number } {
  const live = problems.filter((p) => p.text.trim());
  return { done: live.filter((p) => p.fixedByService && p.confirmedByUs).length, total: live.length };
}

export type ProblemPatch = { id?: string; text?: string; fixedByService?: boolean; confirmedByUs?: boolean; remove?: boolean };

/**
 * Problēmas izmaiņa. "Mēs apstiprinām" drīkst tikai `canConfirm` (IETEIKUMI 7.3 - līdz Nila lēmumam tikai Nils);
 * citādi ķeksis netiek mainīts.
 */
export function applyProblemPatch(
  problems: V2Problem[],
  patch: ProblemPatch,
  ctx: { canConfirm: boolean; actorName: string; now: string; newId: () => string },
): { problems: V2Problem[]; history: Array<{ field: string; from: unknown; to: unknown }> } {
  const out = problems.map((p) => ({ ...p }));
  const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
  let idx = patch.id ? out.findIndex((p) => p.id === patch.id) : -1;
  if (idx < 0) {
    if (patch.remove || !patch.text?.trim()) return { problems: out, history: hist };
    out.push({ id: ctx.newId(), text: "", fixedByService: false, confirmedByUs: false, confirmedBy: "", at: ctx.now, photoIds: [] });
    idx = out.length - 1;
  }
  const p = out[idx]!;
  if (patch.remove) {
    hist.push({ field: "service.problem", from: p.text, to: "" });
    out.splice(idx, 1);
    return { problems: out, history: hist };
  }
  if (typeof patch.text === "string") {
    const text = patch.text.replace(/\r\n/g, "\n").slice(0, 4000).trim();
    hist.push({ field: "service.problem", from: p.text, to: text });
    p.text = text;
  }
  if (typeof patch.fixedByService === "boolean") {
    hist.push({ field: "service.problem.fixed", from: p.fixedByService ? "jā" : "nē", to: patch.fixedByService ? "jā" : "nē" });
    p.fixedByService = patch.fixedByService;
  }
  if (typeof patch.confirmedByUs === "boolean" && ctx.canConfirm) {
    hist.push({ field: "service.problem.confirmed", from: p.confirmedByUs ? "jā" : "nē", to: patch.confirmedByUs ? "jā" : "nē" });
    p.confirmedByUs = patch.confirmedByUs;
    p.confirmedBy = patch.confirmedByUs ? ctx.actorName : "";
  }
  p.at = ctx.now;
  return { problems: out, history: hist };
}

export function emptyInvoice(id: string, fileId: string, pages: number, date: string): V2Invoice {
  return { id, fileId, extraFileIds: [], pages, date, amountEur: null, amountBy: "", amountAt: "", ai: null };
}
