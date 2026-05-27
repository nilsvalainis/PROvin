/**
 * Strukturēti darba zonas lifecycle logi (pārlūka konsole + servera stdout).
 */
export type WorkspaceDebugSource =
  | "pdf_import"
  | "ai_extract"
  | "client_patch"
  | "autosave"
  | "hydrate"
  | "localStorage"
  | "server_ssr"
  | "server_fetch"
  | "unknown";

export type WorkspaceDebugPayload = {
  sessionId?: string;
  source?: WorkspaceDebugSource;
  changedKeys?: string[];
  payloadBytes?: number;
  fillScore?: number;
  storageBackend?: string;
  durable?: boolean;
  error?: string;
  detail?: string;
  /** Papildu konteksts bez sensitīva satura. */
  extra?: Record<string, unknown>;
};

function payloadBytesOf(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function workspaceDebugLog(
  event:
    | "import_received"
    | "merge_start"
    | "persist_start"
    | "persist_ok"
    | "persist_failed"
    | "hydrate_start"
    | "hydrate_source"
    | "localstorage_restore"
    | "overwrite_detected"
    | "server_fetch"
    | "server_response",
  data: WorkspaceDebugPayload = {},
): void {
  const line = {
    ts: new Date().toISOString(),
    event: `workspace:${event}`,
    ...data,
  };
  if (event === "persist_failed" || event === "overwrite_detected") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export function workspaceDebugPayloadMeta(body: unknown): Pick<WorkspaceDebugPayload, "payloadBytes" | "changedKeys"> {
  return {
    payloadBytes: payloadBytesOf(body),
    changedKeys:
      body && typeof body === "object" ?
        Object.keys(body as Record<string, unknown>).filter((k) => k !== "sourceBlocks").slice(0, 12)
      : [],
  };
}
