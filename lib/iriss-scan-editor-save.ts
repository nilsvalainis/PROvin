import { irissScanWorkspaceRevision } from "@/lib/iriss-scan-save-safety";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export function irissScanSaveRequest(rec: IrissScanRecord, persistId: string): {
  isCreate: boolean;
  method: "POST" | "PATCH";
  url: string;
  body: unknown;
} {
  const isCreate = !persistId.trim();
  if (isCreate) {
    return { isCreate: true, method: "POST", url: "/api/admin/iriss-scan", body: { record: rec } };
  }
  return {
    isCreate: false,
    method: "PATCH",
    url: `/api/admin/iriss-scan/${encodeURIComponent(rec.id)}`,
    body: { ...rec, expectedWorkspaceRevision: irissScanWorkspaceRevision(rec) },
  };
}

export function irissScanEditorHref(id: string): string {
  return `/admin/iriss/scan/${encodeURIComponent(id)}`;
}

export function irissScanSaveFailureMessage(status: number, error?: string): string {
  if (error === "empty_record") return "Nav ko saglabāt. Ieraksti VIN, marku vai saiti.";
  if (status === 409) return "Konflikts: cita cilne jau saglabāja jaunāku ierakstu.";
  if (status <= 0) return "Tīkla kļūda";
  return `Kļūda ${status}`;
}

export type IrissScanSaveApply =
  | {
      ok: true;
      rec: IrissScanRecord;
      persistId: string;
      href: string;
      message: "Saglabāts";
      conflict: null;
    }
  | {
      ok: false;
      rec: IrissScanRecord;
      persistId: string;
      href: null;
      message: string;
      conflict: IrissScanRecord | null;
    };

/** Kļūda nekad neizdzēš lokālo formu. Veiksmīgs create atgriež href uz saglabāto id. */
export function applyIrissScanSaveResult(input: {
  rec: IrissScanRecord;
  persistId: string;
  status: number;
  body: { record?: IrissScanRecord; id?: string; error?: string };
}): IrissScanSaveApply {
  const persistId = input.persistId.trim();
  if (input.status === 409 && input.body.record) {
    return {
      ok: false,
      rec: input.rec,
      persistId,
      href: null,
      message: irissScanSaveFailureMessage(409, input.body.error),
      conflict: input.body.record,
    };
  }
  if (input.status < 200 || input.status >= 300) {
    return {
      ok: false,
      rec: input.rec,
      persistId,
      href: null,
      message: irissScanSaveFailureMessage(input.status, input.body.error),
      conflict: null,
    };
  }
  const saved = input.body.record;
  const id = saved?.id || (typeof input.body.id === "string" ? input.body.id : "") || persistId || input.rec.id;
  const rec = saved ?? input.rec;
  return {
    ok: true,
    rec,
    persistId: id,
    href: irissScanEditorHref(id),
    message: "Saglabāts",
    conflict: null,
  };
}
