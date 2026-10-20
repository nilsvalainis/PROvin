export const IRISS_OVERVIEW_SAVED = "Saglabāts";
export const IRISS_OVERVIEW_EDITING = "Labo...";
export const IRISS_OVERVIEW_ADD = "pievienot";
export const IRISS_OVERVIEW_OPEN_SEARCH = "Atvērt Meklētāju";
export const IRISS_ADVANCE_RECEIVED = "Saņemts";
export const IRISS_ADVANCE_NOT_RECEIVED = "Nav saņemts";
export const IRISS_ADVANCE_MARK_RECEIVED = "Atzīmēt avansu saņemtu";

export const IRISS_DEAL_WORKFLOW_STATUSES = [
  { id: "jauns", label: "Jauns" },
  { id: "meklejam", label: "Meklējam" },
  { id: "piedavats", label: "Piedāvāts" },
  { id: "avanss_sanemts", label: "Avanss saņemts" },
  { id: "nopirkts", label: "Nopirkts" },
  { id: "transporta", label: "Transportā" },
  { id: "nodots", label: "Nodots" },
  { id: "atcelts", label: "Atcelts" },
] as const;

export type IrissDealWorkflowStatus = (typeof IRISS_DEAL_WORKFLOW_STATUSES)[number]["id"];

const DEAL_IDS = new Set<string>(IRISS_DEAL_WORKFLOW_STATUSES.map((s) => s.id));

export function parseIrissDealWorkflowStatus(raw: unknown): IrissDealWorkflowStatus | undefined {
  if (typeof raw !== "string") return undefined;
  const id = raw.trim();
  return DEAL_IDS.has(id) ? (id as IrissDealWorkflowStatus) : undefined;
}

export function irissDealWorkflowStatusOf(raw: unknown): IrissDealWorkflowStatus {
  return parseIrissDealWorkflowStatus(raw) ?? "jauns";
}

export function irissDealWorkflowLabel(id: IrissDealWorkflowStatus): string {
  return IRISS_DEAL_WORKFLOW_STATUSES.find((s) => s.id === id)?.label ?? "Jauns";
}

export function formatIrissOverviewSavedCapsule(time: string): string {
  const t = time.trim();
  return t ? `${IRISS_OVERVIEW_SAVED} ${t}` : IRISS_OVERVIEW_SAVED;
}

export function irissOverviewEmailDisplay(email: string): string {
  const t = email.trim();
  return t || IRISS_OVERVIEW_ADD;
}

export function formatIrissOverviewFinancingChip(percent: number, orderDate: string): string | null {
  if (!Number.isFinite(percent) || percent <= 0) return null;
  const m = orderDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = m ? `${m[3]}.${m[2]}` : "";
  return date ? `Klienta finansējums ${percent}% · ${date}` : `Klienta finansējums ${percent}%`;
}

export function irissOverviewAdvanceReceived(paidAt: string | undefined): boolean {
  return Boolean((paidAt ?? "").trim());
}

export function formatIrissOverviewPlatformsLine(labels: readonly string[]): string {
  const clean = labels.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "Nav izvēlētu platformu";
  return `Platformas: ${clean.join(", ")}`;
}
