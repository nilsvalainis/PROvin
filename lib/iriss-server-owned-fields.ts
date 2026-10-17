import { mergeGeneratedDocuments } from "@/lib/iriss-generated-documents";
import type { IrissGeneratedDocument, IrissGoogleContactStatus, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

type ServerOwnedSlice = {
  workspaceRevision?: number;
  generatedDocuments?: IrissGeneratedDocument[];
  googleContactResourceName?: string;
  googleContactStatus?: IrissGoogleContactStatus;
  googleContactUpdatedAt?: string;
  googleContactError?: string;
};

/** Autosaglabāšana nedrīkst pazaudēt servera PDF un Google kontaktu laukus. */
export function mergeServerOwnedIrissFields<T extends ServerOwnedSlice>(local: T, server: T | null | undefined): T {
  if (!server) return local;
  const next: T = {
    ...local,
    workspaceRevision: server.workspaceRevision ?? local.workspaceRevision,
    generatedDocuments: mergeGeneratedDocuments(local.generatedDocuments, server.generatedDocuments),
  };
  if (server.googleContactResourceName) next.googleContactResourceName = server.googleContactResourceName;
  else if (local.googleContactResourceName) next.googleContactResourceName = local.googleContactResourceName;
  if (server.googleContactStatus) next.googleContactStatus = server.googleContactStatus;
  else if (local.googleContactStatus) next.googleContactStatus = local.googleContactStatus;
  if (server.googleContactUpdatedAt) next.googleContactUpdatedAt = server.googleContactUpdatedAt;
  else if (local.googleContactUpdatedAt) next.googleContactUpdatedAt = local.googleContactUpdatedAt;
  if (server.googleContactError) next.googleContactError = server.googleContactError;
  else if (
    server.googleContactStatus === "saved" ||
    server.googleContactStatus === "unconfigured" ||
    server.googleContactStatus === "skipped"
  ) {
    delete next.googleContactError;
  } else if (local.googleContactError) {
    next.googleContactError = local.googleContactError;
  }
  return next;
}

export function retainGoogleContactFields(
  existing: IrissPasutijumsRecord | null,
  next: IrissPasutijumsRecord,
): IrissPasutijumsRecord {
  if (!existing) return next;
  let out = next;
  if (!out.googleContactResourceName && existing.googleContactResourceName) {
    out = { ...out, googleContactResourceName: existing.googleContactResourceName };
  }
  if (!out.googleContactStatus && existing.googleContactStatus) {
    out = { ...out, googleContactStatus: existing.googleContactStatus };
  }
  if (!out.googleContactUpdatedAt && existing.googleContactUpdatedAt) {
    out = { ...out, googleContactUpdatedAt: existing.googleContactUpdatedAt };
  }
  if (!out.googleContactError && existing.googleContactError) {
    out = { ...out, googleContactError: existing.googleContactError };
  }
  return out;
}
