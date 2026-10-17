import {
  IRISS_GENERATED_DOCUMENT_KIND_LV,
  IRISS_GENERATED_DOCUMENT_KINDS,
  type IrissGeneratedDocument,
  type IrissGeneratedDocumentKind,
} from "@/lib/iriss-pasutijumi-types";

export function isIrissGeneratedDocumentKind(v: unknown): v is IrissGeneratedDocumentKind {
  return v === "contract" || v === "cost_estimate";
}

export function generatedDocumentKindLabel(kind: IrissGeneratedDocumentKind): string {
  return IRISS_GENERATED_DOCUMENT_KIND_LV[kind];
}

export function formatGeneratedDocumentWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" }).format(new Date(t));
}

export function formatGeneratedDocumentSize(bytes: number): string {
  const n = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function sortGeneratedDocumentsNewestFirst(docs: readonly IrissGeneratedDocument[]): IrissGeneratedDocument[] {
  return [...docs].sort((a, b) => {
    const bt = Date.parse(b.createdAt) || 0;
    const at = Date.parse(a.createdAt) || 0;
    if (bt !== at) return bt - at;
    return b.id.localeCompare(a.id);
  });
}

export function mergeGeneratedDocuments(
  local: readonly IrissGeneratedDocument[] | undefined,
  server: readonly IrissGeneratedDocument[] | undefined,
): IrissGeneratedDocument[] {
  const byId = new Map<string, IrissGeneratedDocument>();
  for (const d of [...(server ?? []), ...(local ?? [])]) {
    if (!d?.id) continue;
    byId.set(d.id, d);
  }
  return sortGeneratedDocumentsNewestFirst([...byId.values()]);
}

export function normalizeGeneratedDocuments(raw: unknown): IrissGeneratedDocument[] {
  if (!Array.isArray(raw)) return [];
  const out: IrissGeneratedDocument[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const kind = o.kind;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const mimeType = typeof o.mimeType === "string" ? o.mimeType.trim() : "application/pdf";
    const blobPath = typeof o.blobPath === "string" ? o.blobPath.trim() : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt.trim() : "";
    const blobUrl = typeof o.blobUrl === "string" ? o.blobUrl.trim() : "";
    const sizeRaw = typeof o.size === "number" ? o.size : Number.parseInt(String(o.size ?? "0"), 10);
    const size = Number.isFinite(sizeRaw) ? Math.max(0, Math.min(sizeRaw, 40_000_000)) : 0;
    if (!id || !name || !blobPath || !isIrissGeneratedDocumentKind(kind)) continue;
    out.push({
      id,
      kind,
      name: name.slice(0, 180),
      mimeType: mimeType.slice(0, 120) || "application/pdf",
      size,
      createdAt: createdAt.slice(0, 64),
      blobPath: blobPath.slice(0, 400),
      ...(blobUrl ? { blobUrl: blobUrl.slice(0, 800) } : {}),
    });
  }
  return sortGeneratedDocumentsNewestFirst(out).slice(0, 80);
}

export function generatedDocumentRelativePath(orderId: string, docId: string): string {
  return `docs/${orderId}/${docId}.pdf`;
}

export function generatedDocumentBlobPath(orderId: string, docId: string, blobPrefix = "iriss-pasutijumi/"): string {
  return `${blobPrefix}${generatedDocumentRelativePath(orderId, docId)}`;
}

export const IRISS_GENERATED_DOCUMENT_HEADER = "x-iriss-generated-document";

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToUtf8(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function generatedDocumentResponseHeader(
  doc: IrissGeneratedDocument,
  workspaceRevision?: number,
): Record<string, string> {
  const payload = workspaceRevision != null ? { ...doc, workspaceRevision } : doc;
  return { [IRISS_GENERATED_DOCUMENT_HEADER]: utf8ToBase64Url(JSON.stringify(payload)) };
}

export function readGeneratedDocumentFromResponseHeader(
  header: string | null,
): { doc: IrissGeneratedDocument; workspaceRevision?: number } | null {
  const raw = (header ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(base64UrlToUtf8(raw)) as unknown;
    const docs = normalizeGeneratedDocuments([parsed]);
    const doc = docs[0];
    if (!doc) return null;
    const rev =
      parsed && typeof parsed === "object" && typeof (parsed as { workspaceRevision?: unknown }).workspaceRevision === "number"
        ? (parsed as { workspaceRevision: number }).workspaceRevision
        : undefined;
    return { doc, workspaceRevision: rev };
  } catch {
    return null;
  }
}

export function newGeneratedDocument(input: {
  id: string;
  kind: IrissGeneratedDocumentKind;
  name: string;
  size: number;
  createdAt: string;
  blobPath: string;
  blobUrl?: string;
}): IrissGeneratedDocument {
  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    mimeType: "application/pdf",
    size: input.size,
    createdAt: input.createdAt,
    blobPath: input.blobPath,
    ...(input.blobUrl ? { blobUrl: input.blobUrl } : {}),
  };
}

export { IRISS_GENERATED_DOCUMENT_KINDS };
