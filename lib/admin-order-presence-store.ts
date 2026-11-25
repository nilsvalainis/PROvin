import "server-only";

/**
 * Pasūtījuma klātbūtne: kurš pārlūks/ierīce šo pasūtījumu ir atvēris (heartbeat ik ~20 s).
 * Blob `<prefix>_presence/<sid>.json` (serverless instancēm kopīgs); bez Blob - atmiņā (lokāli).
 * Glabā tikai nejaušu ierīces id, īsu pārlūka nosaukumu un laiku - nav personas datu.
 */
import { get, put } from "@vercel/blob";

export const PRESENCE_ACTIVE_MS = 60_000;
const PRESENCE_KEEP_MS = 5 * 60_000;

export type PresenceEntry = { at: number; label: string };
export type PresenceDoc = { clients: Record<string, PresenceEntry> };
export type PresenceOther = { clientId: string; label: string; secondsAgo: number };

type PresenceBlobConfig = { token: string; prefix: string };

const memory = new Map<string, PresenceDoc>();

/** Tikai testiem. */
export function resetPresenceMemoryForTests(): void {
  memory.clear();
}

export function isSafePresenceClientId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

export function sanitizePresenceLabel(label: unknown): string {
  if (typeof label !== "string") return "";
  return label.replace(/[^\p{L}\p{N} ._()/-]/gu, "").trim().slice(0, 40);
}

/** Tīra funkcija: atjauno savu ierakstu, izmet vecos, atgriež citus aktīvos. */
export function applyPresenceHeartbeat(
  doc: PresenceDoc | null,
  clientId: string,
  label: string,
  nowMs: number,
): { doc: PresenceDoc; others: PresenceOther[] } {
  const clients: Record<string, PresenceEntry> = {};
  for (const [id, e] of Object.entries(doc?.clients ?? {})) {
    if (!e || typeof e.at !== "number") continue;
    if (nowMs - e.at > PRESENCE_KEEP_MS) continue;
    clients[id] = { at: e.at, label: typeof e.label === "string" ? e.label : "" };
  }
  clients[clientId] = { at: nowMs, label };
  const others: PresenceOther[] = [];
  for (const [id, e] of Object.entries(clients)) {
    if (id === clientId) continue;
    if (nowMs - e.at > PRESENCE_ACTIVE_MS) continue;
    others.push({ clientId: id, label: e.label, secondsAgo: Math.max(0, Math.round((nowMs - e.at) / 1000)) });
  }
  others.sort((a, b) => a.secondsAgo - b.secondsAgo);
  return { doc: { clients }, others };
}

function presencePathname(cfg: PresenceBlobConfig, sessionId: string): string {
  return `${cfg.prefix}_presence/${sessionId}.json`;
}

async function readPresenceDoc(cfg: PresenceBlobConfig, sessionId: string): Promise<PresenceDoc | null> {
  const res = await get(presencePathname(cfg, sessionId), {
    access: "private",
    token: cfg.token,
    useCache: false,
  }).catch(() => null);
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  try {
    const p = JSON.parse(await new Response(res.stream).text()) as PresenceDoc;
    return p && typeof p === "object" && p.clients && typeof p.clients === "object" ? p : null;
  } catch {
    return null;
  }
}

export async function recordOrderPresence(
  cfg: PresenceBlobConfig | null,
  sessionId: string,
  clientId: string,
  label: string,
  nowMs = Date.now(),
): Promise<PresenceOther[]> {
  if (!cfg) {
    const r = applyPresenceHeartbeat(memory.get(sessionId) ?? null, clientId, label, nowMs);
    memory.set(sessionId, r.doc);
    return r.others;
  }
  const r = applyPresenceHeartbeat(await readPresenceDoc(cfg, sessionId), clientId, label, nowMs);
  // Bez ifMatch: sacensībā var pazust cita ieraksts uz vienu ciklu - nākamais heartbeat to atjauno.
  await put(presencePathname(cfg, sessionId), JSON.stringify(r.doc), {
    access: "private",
    token: cfg.token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return r.others;
}
