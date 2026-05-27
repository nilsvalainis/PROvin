/**
 * Serializē workspace persist pa sessionId — novērš client-side race.
 */
import type { PersistWorkspaceStateResult } from "@/lib/admin-workspace-persist-client";

type PersistJob = () => Promise<PersistWorkspaceStateResult>;

const chains = new Map<string, Promise<PersistWorkspaceStateResult>>();

export function enqueueWorkspacePersist(
  sessionId: string,
  job: PersistJob,
): Promise<PersistWorkspaceStateResult> {
  const prev = chains.get(sessionId);
  const run = async (): Promise<PersistWorkspaceStateResult> => {
    if (prev) {
      try {
        await prev;
      } catch {
        /* prior failure should not block next */
      }
    }
    return job();
  };
  const next = run();
  chains.set(sessionId, next);
  void next.finally(() => {
    if (chains.get(sessionId) === next) chains.delete(sessionId);
  });
  return next;
}

export function clearWorkspacePersistQueue(sessionId: string): void {
  chains.delete(sessionId);
}
